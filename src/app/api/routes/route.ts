import { db } from "@/db";
import { routes, routeStops, puroks, trucks, users, households } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { computeRouteDistanceKm, suggestNearestNeighborOrder } from "@/lib/geo";
import { logAudit, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

const stopInputSchema = z.object({
  label: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
  householdId: z.coerce.number().int().positive().nullable().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const createRouteSchema = z.object({
  name: z.string().trim().min(3, "Route name is required.").max(160),
  purokId: z.coerce.number().int().positive(),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]),
  routeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  truckId: z.coerce.number().int().positive().nullable().optional(),
  driverId: z.coerce.number().int().positive().nullable().optional(),
  scheduleId: z.coerce.number().int().positive().nullable().optional(),
  autoOptimize: z.boolean().optional().default(false),
  stops: z.array(stopInputSchema).min(1, "Please add at least one stop on the map."),
});

export async function GET(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["collector", "admin", "official"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get("date");

    const conditions = [];
    // Strict RBAC: Collectors ONLY see routes assigned to them!
    if (auth.user.roleCode === "collector") {
      conditions.push(eq(routes.driverId, auth.user.id));
    }
    if (dateFilter) {
      conditions.push(eq(routes.routeDate, dateFilter));
    }

    const routeRows = await db
      .select({
        id: routes.id,
        name: routes.name,
        scheduleId: routes.scheduleId,
        purokId: routes.purokId,
        purokName: puroks.name,
        wasteType: routes.wasteType,
        routeDate: routes.routeDate,
        truckId: routes.truckId,
        truckName: trucks.name,
        truckCode: trucks.code,
        driverId: routes.driverId,
        driverName: users.fullName,
        status: routes.status,
        estimatedDistanceKm: routes.estimatedDistanceKm,
        distanceNote: routes.distanceNote,
        startedAt: routes.startedAt,
        completedAt: routes.completedAt,
        createdAt: routes.createdAt,
      })
      .from(routes)
      .innerJoin(puroks, eq(routes.purokId, puroks.id))
      .leftJoin(trucks, eq(routes.truckId, trucks.id))
      .leftJoin(users, eq(routes.driverId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(routes.routeDate), desc(routes.id));

    const allStops = await db
      .select()
      .from(routeStops)
      .orderBy(asc(routeStops.stopOrder));

    const stopsByRoute = new Map<number, typeof allStops>();
    for (const s of allStops) {
      const list = stopsByRoute.get(s.routeId) ?? [];
      list.push(s);
      stopsByRoute.set(s.routeId, list);
    }

    const enriched = routeRows.map((r) => {
      const stops = stopsByRoute.get(r.id) ?? [];
      const collected = stops.filter((s) => s.status === "collected").length;
      const skipped = stops.filter((s) => s.status === "skipped").length;
      const blocked = stops.filter((s) => s.status === "blocked").length;
      const done = collected + skipped + blocked;
      const progressPct = stops.length > 0 ? Math.round((done / stops.length) * 100) : 0;
      return {
        ...r,
        stops,
        progress: {
          total: stops.length,
          collected,
          skipped,
          blocked,
          pending: stops.length - done,
          done,
          progressPct,
        },
      };
    });

    const [allPuroks, allTrucks, allCollectors, allHouseholds] = await Promise.all([
      db.select().from(puroks).orderBy(asc(puroks.code)),
      db.select().from(trucks).orderBy(asc(trucks.code)),
      db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(and(eq(users.roleCode, "collector"), eq(users.status, "approved"))),
      db
        .select({
          id: households.id,
          householdCode: households.householdCode,
          headName: households.headName,
          address: households.address,
          purokId: households.purokId,
          lat: households.lat,
          lng: households.lng,
        })
        .from(households)
        .orderBy(asc(households.householdCode)),
    ]);

    return Response.json({
      routes: enriched,
      puroks: allPuroks,
      trucks: allTrucks,
      collectors: allCollectors,
      households: allHouseholds,
    });
  } catch (err) {
    console.error("GET routes error:", err);
    return Response.json({ error: "Failed to load routes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = createRouteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid route payload." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    let orderedStops = data.stops;
    let estDist = computeRouteDistanceKm(orderedStops, true);

    if (data.autoOptimize) {
      const opt = suggestNearestNeighborOrder(orderedStops);
      orderedStops = opt.ordered;
      estDist = opt.estimatedDistanceKm;
    }

    const [createdRoute] = await db
      .insert(routes)
      .values({
        name: data.name,
        scheduleId: data.scheduleId ?? null,
        purokId: data.purokId,
        wasteType: data.wasteType,
        routeDate: data.routeDate,
        truckId: data.truckId ?? null,
        driverId: data.driverId ?? null,
        status: "planned",
        estimatedDistanceKm: estDist,
        distanceNote: "Estimate based on straight-line distance",
        createdBy: auth.user.id,
      })
      .returning();

    const createdStops = await db
      .insert(routeStops)
      .values(
        orderedStops.map((s, idx) => ({
          routeId: createdRoute.id,
          stopOrder: idx + 1,
          label: s.label,
          address: s.address,
          householdId: s.householdId ?? null,
          lat: s.lat,
          lng: s.lng,
          status: "pending",
          reason: "",
        }))
      )
      .returning();

    if (data.driverId) {
      await notifyUser({
        userId: data.driverId,
        purokId: data.purokId,
        title: `New Route Assigned: ${data.name}`,
        message: `${createdStops.length} stops assigned for ${data.routeDate} (~${estDist} km straight-line estimate).`,
        category: "reminder",
        link: "/app/collector",
      });
    }

    await logAudit({
      actor: auth.user,
      action: "CREATE_ROUTE",
      entityType: "route",
      entityId: createdRoute.id,
      summary: `Created route "${data.name}" with ${createdStops.length} stops (${estDist} km straight-line estimate).`,
    });

    return Response.json(
      { ok: true, route: { ...createdRoute, stops: createdStops } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST route error:", err);
    return Response.json({ error: "Failed to create route." }, { status: 500 });
  }
}
