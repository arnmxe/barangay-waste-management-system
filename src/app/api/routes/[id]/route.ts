import { db } from "@/db";
import { routes, routeStops } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { computeRouteDistanceKm, suggestNearestNeighborOrder } from "@/lib/geo";
import { logAudit, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

const stopSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  label: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
  householdId: z.coerce.number().int().positive().nullable().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  status: z.enum(["pending", "collected", "skipped", "blocked"]).optional(),
  reason: z.string().optional(),
  photoUrl: z.string().optional(),
});

const updateRouteSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
  purokId: z.coerce.number().int().positive().optional(),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]).optional(),
  routeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  truckId: z.coerce.number().int().positive().nullable().optional(),
  driverId: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["planned", "in_progress", "completed"]).optional(),
  autoOptimize: z.boolean().optional(),
  stops: z.array(stopSchema).min(1).optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["collector", "admin", "official"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const routeId = Number(id);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    return Response.json({ error: "Invalid route ID." }, { status: 400 });
  }

  const [routeRow] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
  if (!routeRow) {
    return Response.json({ error: "Route not found." }, { status: 404 });
  }
  if (auth.user.roleCode === "collector" && routeRow.driverId !== auth.user.id) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const stops = await db
    .select()
    .from(routeStops)
    .where(eq(routeStops.routeId, routeId))
    .orderBy(asc(routeStops.stopOrder));

  return Response.json({ route: { ...routeRow, stops } });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const routeId = Number(id);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      return Response.json({ error: "Invalid route ID." }, { status: 400 });
    }

    const [existing] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
    if (!existing) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateRouteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid route update." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    let estDist = existing.estimatedDistanceKm;

    if (data.stops) {
      let ordered = data.stops;
      if (data.autoOptimize) {
        const opt = suggestNearestNeighborOrder(ordered);
        ordered = opt.ordered;
        estDist = opt.estimatedDistanceKm;
      } else {
        estDist = computeRouteDistanceKm(ordered, true);
      }

      // Replace stops cleanly preserving existing statuses where supplied
      await db.delete(routeStops).where(eq(routeStops.routeId, routeId));
      await db.insert(routeStops).values(
        ordered.map((s, idx) => ({
          routeId,
          stopOrder: idx + 1,
          label: s.label,
          address: s.address,
          householdId: s.householdId ?? null,
          lat: s.lat,
          lng: s.lng,
          status: s.status ?? "pending",
          reason: s.reason ?? "",
          photoUrl: s.photoUrl ?? "",
        }))
      );
    }

    const nextDriverId =
      data.driverId !== undefined ? data.driverId : existing.driverId;

    const [updated] = await db
      .update(routes)
      .set({
        name: data.name ?? existing.name,
        purokId: data.purokId ?? existing.purokId,
        wasteType: data.wasteType ?? existing.wasteType,
        routeDate: data.routeDate ?? existing.routeDate,
        truckId: data.truckId !== undefined ? data.truckId : existing.truckId,
        driverId: nextDriverId,
        status: data.status ?? existing.status,
        estimatedDistanceKm: estDist,
        updatedAt: new Date(),
      })
      .where(eq(routes.id, routeId))
      .returning();

    if (nextDriverId && nextDriverId !== existing.driverId) {
      await notifyUser({
        userId: nextDriverId,
        purokId: updated.purokId,
        title: `Route Reassigned: ${updated.name}`,
        message: `You have been assigned to "${updated.name}" for ${updated.routeDate}.`,
        category: "change",
        link: "/app/collector",
      });
    }

    const stops = await db
      .select()
      .from(routeStops)
      .where(eq(routeStops.routeId, routeId))
      .orderBy(asc(routeStops.stopOrder));

    await logAudit({
      actor: auth.user,
      action: "UPDATE_ROUTE",
      entityType: "route",
      entityId: routeId,
      summary: `Updated route "${updated.name}" (${stops.length} stops, ${estDist} km straight-line estimate).`,
    });

    return Response.json({ ok: true, route: { ...updated, stops } });
  } catch (err) {
    console.error("PATCH route error:", err);
    return Response.json({ error: "Failed to update route." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const routeId = Number(id);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    return Response.json({ error: "Invalid route ID." }, { status: 400 });
  }

  const [deleted] = await db.delete(routes).where(eq(routes.id, routeId)).returning();
  if (!deleted) {
    return Response.json({ error: "Route not found." }, { status: 404 });
  }

  await logAudit({
    actor: auth.user,
    action: "DELETE_ROUTE",
    entityType: "route",
    entityId: routeId,
    summary: `Deleted route "${deleted.name}".`,
  });

  return Response.json({ ok: true });
}
