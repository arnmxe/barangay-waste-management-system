import { db } from "@/db";
import { routes, routeStops, collectionLogs, schedules } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const stopUpdateSchema = z.object({
  status: z.enum(["pending", "collected", "skipped", "blocked"]),
  reason: z.string().trim().max(400).optional().default(""),
  photoUrl: z.string().trim().max(400).optional().default(""),
  syncedFromOffline: z.boolean().optional().default(false),
  clientUpdatedAt: z.string().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; stopId: string }> }
) {
  const auth = await requireAuth(["collector", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id, stopId } = await context.params;
    const routeId = Number(id);
    const sId = Number(stopId);
    if (!Number.isInteger(routeId) || !Number.isInteger(sId)) {
      return Response.json({ error: "Invalid IDs." }, { status: 400 });
    }

    const [routeRow] = await db
      .select()
      .from(routes)
      .where(eq(routes.id, routeId))
      .limit(1);

    if (!routeRow) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    if (auth.user.roleCode === "collector" && routeRow.driverId !== auth.user.id) {
      return Response.json(
        { error: "You can only update stops on routes assigned to you." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = stopUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid stop update." },
        { status: 400 }
      );
    }

    const { status, reason, photoUrl, syncedFromOffline, clientUpdatedAt } = parsed.data;

    if ((status === "skipped" || status === "blocked") && reason.length < 3) {
      return Response.json(
        { error: "Please provide a brief reason when marking a stop as Skipped or Blocked." },
        { status: 400 }
      );
    }

    const [updatedStop] = await db
      .update(routeStops)
      .set({
        status,
        reason,
        photoUrl: photoUrl || "",
        updatedBy: auth.user.id,
        updatedAt: new Date(),
        clientUpdatedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
      })
      .where(and(eq(routeStops.id, sId), eq(routeStops.routeId, routeId)))
      .returning();

    if (!updatedStop) {
      return Response.json({ error: "Route stop not found." }, { status: 404 });
    }

    if (status !== "pending") {
      await db.insert(collectionLogs).values({
        routeId,
        routeStopId: sId,
        collectorId: auth.user.id,
        actionStatus: status,
        reason,
        photoUrl: photoUrl || "",
        lat: updatedStop.lat,
        lng: updatedStop.lng,
        syncedFromOffline,
        loggedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
      });
    }

    // Recalculate parent route status
    const allStops = await db
      .select()
      .from(routeStops)
      .where(eq(routeStops.routeId, routeId));

    const doneCount = allStops.filter((s) => s.status !== "pending").length;
    const nextRouteStatus =
      doneCount === 0
        ? "planned"
        : doneCount === allStops.length
        ? "completed"
        : "in_progress";

    await db
      .update(routes)
      .set({
        status: nextRouteStatus,
        startedAt:
          routeRow.startedAt ?? (doneCount > 0 ? new Date() : null),
        completedAt: nextRouteStatus === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(routes.id, routeId));

    if (routeRow.scheduleId && nextRouteStatus !== "planned") {
      await db
        .update(schedules)
        .set({
          status: nextRouteStatus === "completed" ? "completed" : "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, routeRow.scheduleId));
    }

    await logAudit({
      actor: auth.user,
      action: "UPDATE_STOP_STATUS",
      entityType: "route_stop",
      entityId: sId,
      summary: `Marked stop "${updatedStop.label}" as ${status}${
        syncedFromOffline ? " (synced from offline queue)" : ""
      }.`,
    });

    return Response.json({
      ok: true,
      stop: updatedStop,
      routeStatus: nextRouteStatus,
    });
  } catch (err) {
    console.error("PATCH stop error:", err);
    return Response.json({ error: "Failed to update stop status." }, { status: 500 });
  }
}
