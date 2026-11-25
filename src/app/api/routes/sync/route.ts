import { db } from "@/db";
import { routes, routeStops, collectionLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const syncPayloadSchema = z.object({
  updates: z
    .array(
      z.object({
        queueId: z.string(),
        routeId: z.coerce.number().int().positive(),
        stopId: z.coerce.number().int().positive(),
        status: z.enum(["collected", "skipped", "blocked"]),
        reason: z.string().trim().max(400).optional().default(""),
        photoUrl: z.string().trim().max(400).optional().default(""),
        clientUpdatedAt: z.string(),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const auth = await requireAuth(["collector", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = syncPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid offline sync payload." },
        { status: 400 }
      );
    }

    const syncedQueueIds: string[] = [];
    const touchedRoutes = new Set<number>();

    for (const item of parsed.data.updates) {
      const [routeRow] = await db
        .select()
        .from(routes)
        .where(eq(routes.id, item.routeId))
        .limit(1);

      if (!routeRow) continue;
      if (auth.user.roleCode === "collector" && routeRow.driverId !== auth.user.id) {
        continue;
      }

      const [updatedStop] = await db
        .update(routeStops)
        .set({
          status: item.status,
          reason: item.reason,
          photoUrl: item.photoUrl || "",
          updatedBy: auth.user.id,
          updatedAt: new Date(),
          clientUpdatedAt: new Date(item.clientUpdatedAt),
        })
        .where(
          and(eq(routeStops.id, item.stopId), eq(routeStops.routeId, item.routeId))
        )
        .returning();

      if (updatedStop) {
        await db.insert(collectionLogs).values({
          routeId: item.routeId,
          routeStopId: item.stopId,
          collectorId: auth.user.id,
          actionStatus: item.status,
          reason: item.reason,
          photoUrl: item.photoUrl || "",
          lat: updatedStop.lat,
          lng: updatedStop.lng,
          syncedFromOffline: true,
          loggedAt: new Date(item.clientUpdatedAt),
        });
        syncedQueueIds.push(item.queueId);
        touchedRoutes.add(item.routeId);
      }
    }

    for (const rId of touchedRoutes) {
      const allStops = await db
        .select()
        .from(routeStops)
        .where(eq(routeStops.routeId, rId));
      const done = allStops.filter((s) => s.status !== "pending").length;
      const nextStatus =
        done === 0 ? "planned" : done === allStops.length ? "completed" : "in_progress";
      await db
        .update(routes)
        .set({
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(routes.id, rId));
    }

    if (syncedQueueIds.length > 0) {
      await logAudit({
        actor: auth.user,
        action: "OFFLINE_SYNC",
        entityType: "route_stop",
        entityId: String(syncedQueueIds.length),
        summary: `Synced ${syncedQueueIds.length} queued offline collector update(s).`,
      });
    }

    return Response.json({
      ok: true,
      syncedCount: syncedQueueIds.length,
      syncedQueueIds,
    });
  } catch (err) {
    console.error("Offline sync error:", err);
    return Response.json({ error: "Offline sync failed." }, { status: 500 });
  }
}
