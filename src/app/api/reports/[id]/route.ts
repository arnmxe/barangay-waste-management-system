import { db } from "@/db";
import { missedReports, reportUpdates } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { logAudit, notifyAdmins, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

const patchReportSchema = z.object({
  status: z
    .enum(["submitted", "verified", "assigned", "resolved", "rejected"])
    .optional(),
  rejectionReason: z.string().trim().max(500).optional(),
  assignedCollectorId: z.coerce.number().int().positive().nullable().optional(),
  assignedTruckId: z.coerce.number().int().positive().nullable().optional(),
  comment: z.string().trim().max(800).optional(),
  confirmResolution: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return Response.json({ error: "Invalid report ID." }, { status: 400 });
  }

  const [report] = await db
    .select()
    .from(missedReports)
    .where(eq(missedReports.id, reportId))
    .limit(1);

  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  // Resident privacy isolation
  if (auth.user.roleCode === "resident" && report.residentId !== auth.user.id) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (
    auth.user.roleCode === "collector" &&
    report.assignedCollectorId !== auth.user.id
  ) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const updates = await db
    .select()
    .from(reportUpdates)
    .where(eq(reportUpdates.reportId, reportId))
    .orderBy(asc(reportUpdates.createdAt));

  return Response.json({ report, updates });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["resident", "collector", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return Response.json({ error: "Invalid report ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(missedReports)
      .where(eq(missedReports.id, reportId))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchReportSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Resident actions: confirm resolution OR add comment on own report only
    if (auth.user.roleCode === "resident") {
      if (existing.residentId !== auth.user.id) {
        return Response.json({ error: "Forbidden." }, { status: 403 });
      }
      if (data.confirmResolution) {
        if (existing.status !== "resolved") {
          return Response.json(
            { error: "You can only confirm resolution after the report is marked Resolved." },
            { status: 400 }
          );
        }
        const [updated] = await db
          .update(missedReports)
          .set({
            residentConfirmed: true,
            residentConfirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(missedReports.id, reportId))
          .returning();

        await db.insert(reportUpdates).values({
          reportId,
          authorId: auth.user.id,
          authorName: auth.user.fullName,
          authorRole: "resident",
          fromStatus: "resolved",
          toStatus: "resolved",
          comment:
            data.comment && data.comment.length > 0
              ? `Resident confirmed pickup resolved: ${data.comment}`
              : "Resident confirmed that the missed pickup has been resolved.",
        });

        await notifyAdmins({
          title: `Resolution Confirmed: ${existing.ticketNumber}`,
          message: `${auth.user.fullName} confirmed that missed pickup ${existing.ticketNumber} was collected.`,
          category: "report",
          link: "/app/reports",
        });

        await logAudit({
          actor: auth.user,
          action: "CONFIRM_REPORT_RESOLUTION",
          entityType: "missed_report",
          entityId: reportId,
          summary: `Resident confirmed resolution of ticket ${existing.ticketNumber}.`,
        });

        return Response.json({ ok: true, report: updated });
      }

      if (data.comment && data.comment.length > 0) {
        await db.insert(reportUpdates).values({
          reportId,
          authorId: auth.user.id,
          authorName: auth.user.fullName,
          authorRole: "resident",
          fromStatus: existing.status,
          toStatus: existing.status,
          comment: data.comment,
        });
        await notifyAdmins({
          title: `New Comment on ${existing.ticketNumber}`,
          message: `${auth.user.fullName}: ${data.comment.slice(0, 140)}`,
          category: "report",
          link: "/app/reports",
        });
        return Response.json({ ok: true, report: existing });
      }

      return Response.json({ error: "No resident action provided." }, { status: 400 });
    }

    // Collector can comment or mark assigned report as resolved
    if (auth.user.roleCode === "collector") {
      if (existing.assignedCollectorId !== auth.user.id) {
        return Response.json({ error: "Forbidden." }, { status: 403 });
      }
      if (data.status && data.status !== "resolved") {
        return Response.json(
          { error: "Collectors can only mark assigned reports as Resolved." },
          { status: 403 }
        );
      }
    }

    // Admin (or collector marking resolved)
    const nextStatus = data.status ?? existing.status;
    if (nextStatus === "rejected") {
      const rejReason = (data.rejectionReason ?? "").trim();
      if (rejReason.length < 5) {
        return Response.json(
          { error: "Please enter a clear rejection reason (at least 5 characters)." },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(missedReports)
      .set({
        status: nextStatus,
        rejectionReason:
          nextStatus === "rejected"
            ? data.rejectionReason ?? existing.rejectionReason
            : existing.rejectionReason,
        assignedCollectorId:
          data.assignedCollectorId !== undefined
            ? data.assignedCollectorId
            : existing.assignedCollectorId,
        assignedTruckId:
          data.assignedTruckId !== undefined
            ? data.assignedTruckId
            : existing.assignedTruckId,
        resolvedAt: nextStatus === "resolved" ? new Date() : existing.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(missedReports.id, reportId))
      .returning();

    const statusChanged = nextStatus !== existing.status;
    const commentText =
      (data.comment && data.comment.trim()) ||
      (nextStatus === "rejected"
        ? `Rejected: ${data.rejectionReason}`
        : statusChanged
        ? `Status updated from ${existing.status} to ${nextStatus}.`
        : "Updated report details.");

    await db.insert(reportUpdates).values({
      reportId,
      authorId: auth.user.id,
      authorName: auth.user.fullName,
      authorRole: auth.user.roleCode,
      fromStatus: existing.status,
      toStatus: nextStatus,
      comment: commentText,
    });

    // Notify resident
    await notifyUser({
      userId: existing.residentId,
      purokId: existing.purokId,
      title: `Ticket ${existing.ticketNumber} Updated: ${nextStatus.toUpperCase()}`,
      message:
        nextStatus === "resolved"
          ? `Your missed pickup report was marked Resolved. Please open Missed Pickups to confirm resolution.`
          : commentText,
      category: "report",
      link: "/app/reports",
    });

    if (
      updated.assignedCollectorId &&
      updated.assignedCollectorId !== existing.assignedCollectorId
    ) {
      await notifyUser({
        userId: updated.assignedCollectorId,
        purokId: existing.purokId,
        title: `Makeup Pickup Assigned: ${existing.ticketNumber}`,
        message: `Assigned missed ${existing.wasteType} pickup at ${existing.address}.`,
        category: "report",
        link: "/app/reports",
      });
    }

    await logAudit({
      actor: auth.user,
      action: "UPDATE_REPORT",
      entityType: "missed_report",
      entityId: reportId,
      summary: `Updated ticket ${existing.ticketNumber} (${existing.status} → ${nextStatus}).`,
    });

    return Response.json({ ok: true, report: updated });
  } catch (err) {
    console.error("PATCH report error:", err);
    return Response.json({ error: "Failed to update report." }, { status: 500 });
  }
}
