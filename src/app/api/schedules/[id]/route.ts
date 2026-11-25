import { db } from "@/db";
import { schedules, puroks } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { logAudit, notifyPurokResidents, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

const patchScheduleSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  purokId: z.coerce.number().int().positive().optional(),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  truckId: z.coerce.number().int().positive().nullable().optional(),
  driverId: z.coerce.number().int().positive().nullable().optional(),
  crewNames: z.string().trim().max(300).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "delayed", "cancelled"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const schedId = Number(id);
    if (!Number.isInteger(schedId) || schedId <= 0) {
      return Response.json({ error: "Invalid schedule ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, schedId))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Schedule not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update data." },
        { status: 400 }
      );
    }

    const next = {
      title: parsed.data.title ?? existing.title,
      purokId: parsed.data.purokId ?? existing.purokId,
      wasteType: parsed.data.wasteType ?? existing.wasteType,
      scheduledDate: parsed.data.scheduledDate ?? existing.scheduledDate,
      startTime: parsed.data.startTime ?? existing.startTime,
      endTime: parsed.data.endTime ?? existing.endTime,
      truckId: parsed.data.truckId !== undefined ? parsed.data.truckId : existing.truckId,
      driverId: parsed.data.driverId !== undefined ? parsed.data.driverId : existing.driverId,
      crewNames: parsed.data.crewNames ?? existing.crewNames,
      status: parsed.data.status ?? existing.status,
      notes: parsed.data.notes ?? existing.notes,
    };

    if (next.startTime >= next.endTime) {
      return Response.json(
        { error: "End time must be later than start time." },
        { status: 400 }
      );
    }

    // Check conflicts unless schedule is being cancelled
    if (next.status !== "cancelled") {
      const sameDay = await db
        .select({
          id: schedules.id,
          title: schedules.title,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
          truckId: schedules.truckId,
          driverId: schedules.driverId,
          purokName: puroks.name,
        })
        .from(schedules)
        .innerJoin(puroks, eq(schedules.purokId, puroks.id))
        .where(
          and(
            eq(schedules.scheduledDate, next.scheduledDate),
            ne(schedules.id, schedId),
            ne(schedules.status, "cancelled")
          )
        );

      for (const ex of sameDay) {
        if (!timesOverlap(next.startTime, next.endTime, ex.startTime, ex.endTime)) continue;
        if (next.truckId && ex.truckId === next.truckId) {
          return Response.json(
            {
              error: `Truck conflict on ${next.scheduledDate} (${ex.startTime}–${ex.endTime}) with "${ex.title}" (${ex.purokName}).`,
            },
            { status: 409 }
          );
        }
        if (next.driverId && ex.driverId === next.driverId) {
          return Response.json(
            {
              error: `Driver conflict on ${next.scheduledDate} (${ex.startTime}–${ex.endTime}) with "${ex.title}" (${ex.purokName}).`,
            },
            { status: 409 }
          );
        }
      }
    }

    const [updated] = await db
      .update(schedules)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(schedules.id, schedId))
      .returning();

    // Send notifications on delay, cancellation, or time/date change
    const isDelay = next.status === "delayed" && existing.status !== "delayed";
    const isCancelled = next.status === "cancelled" && existing.status !== "cancelled";
    const timeChanged =
      next.scheduledDate !== existing.scheduledDate ||
      next.startTime !== existing.startTime ||
      next.endTime !== existing.endTime;

    if (isDelay || isCancelled || timeChanged) {
      const notifCat = isDelay ? "delay" : "change";
      const notifTitle = isCancelled
        ? `Schedule Cancelled: ${updated.title}`
        : isDelay
        ? `Collection Delayed: ${updated.title}`
        : `Schedule Updated: ${updated.title}`;
      const notifMsg = isCancelled
        ? `The pickup on ${updated.scheduledDate} has been cancelled. ${updated.notes}`
        : `Pickup on ${updated.scheduledDate} (${updated.startTime}–${updated.endTime}) is marked ${updated.status}. ${updated.notes}`;

      await notifyPurokResidents({
        purokId: updated.purokId,
        title: notifTitle,
        message: notifMsg,
        category: notifCat,
        link: "/app/schedules",
      });

      if (updated.driverId) {
        await notifyUser({
          userId: updated.driverId,
          purokId: updated.purokId,
          title: notifTitle,
          message: notifMsg,
          category: notifCat,
          link: "/app/schedules",
        });
      }
    }

    await logAudit({
      actor: auth.user,
      action: isCancelled ? "CANCEL_SCHEDULE" : "UPDATE_SCHEDULE",
      entityType: "schedule",
      entityId: updated.id,
      summary: `Updated schedule "${updated.title}" (${updated.scheduledDate}) — status: ${updated.status}.`,
    });

    return Response.json({ ok: true, schedule: updated });
  } catch (err) {
    console.error("PATCH schedule error:", err);
    return Response.json({ error: "Failed to update schedule." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const schedId = Number(id);
    if (!Number.isInteger(schedId) || schedId <= 0) {
      return Response.json({ error: "Invalid schedule ID." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(schedules)
      .where(eq(schedules.id, schedId))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Schedule not found." }, { status: 404 });
    }

    await logAudit({
      actor: auth.user,
      action: "DELETE_SCHEDULE",
      entityType: "schedule",
      entityId: deleted.id,
      summary: `Deleted schedule "${deleted.title}" (${deleted.scheduledDate}).`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE schedule error:", err);
    return Response.json({ error: "Failed to delete schedule." }, { status: 500 });
  }
}
