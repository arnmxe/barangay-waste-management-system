import { db } from "@/db";
import { complianceRecords, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { logAudit, notifyAdmins, notifyUser } from "@/lib/audit";
import { recalculateRepeatViolator } from "../route";

export const dynamic = "force-dynamic";

const patchComplianceSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("contest"),
    contestReason: z
      .string()
      .trim()
      .min(8, "Please explain why you are contesting this record (at least 8 characters).")
      .max(600),
  }),
  z.object({
    action: z.literal("send_notice"),
    noticeType: z.enum(["education", "warning"]),
  }),
  z.object({
    action: z.literal("resolve_contest"),
    contestStatus: z.enum(["upheld", "dismissed"]),
    contestResponse: z.string().trim().min(4, "Please provide a brief response.").max(600),
  }),
]);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["resident", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const recId = Number(id);
    if (!Number.isInteger(recId) || recId <= 0) {
      return Response.json({ error: "Invalid compliance record ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(complianceRecords)
      .where(eq(complianceRecords.id, recId))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Compliance record not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchComplianceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid compliance update." },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.action === "contest") {
      if (
        auth.user.roleCode === "resident" &&
        existing.householdId !== auth.user.householdId
      ) {
        return Response.json({ error: "You may only contest your own household's record." }, { status: 403 });
      }

      const [updated] = await db
        .update(complianceRecords)
        .set({
          contested: true,
          contestReason: payload.contestReason,
          contestStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(complianceRecords.id, recId))
        .returning();

      await notifyAdmins({
        title: `Compliance Record Contested (#${recId})`,
        message: `${auth.user.fullName} contested an inspection from ${existing.inspectionDate}: "${payload.contestReason.slice(0, 120)}"`,
        category: "compliance",
        link: "/app/compliance",
      });

      await logAudit({
        actor: auth.user,
        action: "CONTEST_COMPLIANCE",
        entityType: "compliance_record",
        entityId: recId,
        summary: `${auth.user.fullName} contested compliance record #${recId}.`,
      });

      return Response.json({ ok: true, record: updated });
    }

    // Admin-only actions
    if (auth.user.roleCode !== "admin") {
      return Response.json({ error: "Only Barangay Admin can perform this action." }, { status: 403 });
    }

    if (payload.action === "send_notice") {
      const [updated] = await db
        .update(complianceRecords)
        .set({
          noticeType: payload.noticeType,
          noticeSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(complianceRecords.id, recId))
        .returning();

      const linkedUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, existing.householdId));

      for (const u of linkedUsers) {
        await notifyUser({
          userId: u.id,
          purokId: existing.purokId,
          title:
            payload.noticeType === "warning"
              ? "Official Segregation Warning Notice (RA 9003)"
              : "Segregation Education Notice (RA 9003)",
          message:
            payload.noticeType === "warning"
              ? `A formal written warning was issued for your ${existing.inspectionDate} inspection. No automatic fine is imposed; please follow our Segregation Guide.`
              : `Please review our RA 9003 Segregation Guide to help keep Barangay San Isidro clean.`,
          category: "compliance",
          link: "/app/compliance",
        });
      }

      await logAudit({
        actor: auth.user,
        action: "SEND_COMPLIANCE_NOTICE",
        entityType: "compliance_record",
        entityId: recId,
        summary: `Issued ${payload.noticeType} notice for compliance record #${recId}.`,
      });

      return Response.json({ ok: true, record: updated });
    }

    if (payload.action === "resolve_contest") {
      const nextStatus =
        payload.contestStatus === "upheld" ? "compliant" : existing.status;

      const [updated] = await db
        .update(complianceRecords)
        .set({
          status: nextStatus,
          contestStatus: payload.contestStatus,
          contestResponse: payload.contestResponse,
          updatedAt: new Date(),
        })
        .where(eq(complianceRecords.id, recId))
        .returning();

      await recalculateRepeatViolator(existing.householdId);

      const linkedUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, existing.householdId));

      for (const u of linkedUsers) {
        await notifyUser({
          userId: u.id,
          purokId: existing.purokId,
          title: `Compliance Contest ${payload.contestStatus.toUpperCase()}`,
          message: `Barangay Admin reviewed your contest for ${existing.inspectionDate}: ${payload.contestResponse}`,
          category: "compliance",
          link: "/app/compliance",
        });
      }

      await logAudit({
        actor: auth.user,
        action: "RESOLVE_COMPLIANCE_CONTEST",
        entityType: "compliance_record",
        entityId: recId,
        summary: `Marked contest on record #${recId} as ${payload.contestStatus}.`,
      });

      return Response.json({ ok: true, record: updated });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    console.error("PATCH compliance error:", err);
    return Response.json({ error: "Failed to update compliance record." }, { status: 500 });
  }
}
