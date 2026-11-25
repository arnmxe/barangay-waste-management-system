import { db } from "@/db";
import { complianceRecords, households, puroks, users } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { logAudit, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createComplianceSchema = z.object({
  householdId: z.coerce.number().int().positive("Please select a household."),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]),
  status: z.enum(["compliant", "partially_compliant", "non_compliant"]),
  violationType: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(600).optional().default(""),
  photoUrl: z.string().trim().max(400).optional().default(""),
  noticeType: z.enum(["none", "education", "warning"]).optional().default("none"),
});

export async function recalculateRepeatViolator(householdId: number): Promise<boolean> {
  const recs = await db
    .select({ status: complianceRecords.status, contestStatus: complianceRecords.contestStatus })
    .from(complianceRecords)
    .where(eq(complianceRecords.householdId, householdId));

  const activeViolations = recs.filter(
    (r) => r.status === "non_compliant" && r.contestStatus !== "upheld"
  ).length;

  const isRepeat = activeViolations >= 2;
  await db
    .update(households)
    .set({ isRepeatViolator: isRepeat })
    .where(eq(households.id, householdId));
  return isRepeat;
}

export async function GET(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const purokFilter = searchParams.get("purokId");
    const statusFilter = searchParams.get("status");
    const householdFilter = searchParams.get("householdId");

    const isResident = auth.user.roleCode === "resident";

    // Fetch all records for aggregate barangay analytics (non-PII aggregate percentages)
    const allForStats = await db
      .select({
        purokId: complianceRecords.purokId,
        purokName: puroks.name,
        inspectionDate: complianceRecords.inspectionDate,
        status: complianceRecords.status,
      })
      .from(complianceRecords)
      .innerJoin(puroks, eq(complianceRecords.purokId, puroks.id));

    // Aggregate by Purok
    const purokMap = new Map<
      number,
      { purokId: number; purokName: string; total: number; compliant: number; partial: number; nonCompliant: number }
    >();
    const monthMap = new Map<
      string,
      { month: string; total: number; compliant: number; partial: number; nonCompliant: number }
    >();

    for (const r of allForStats) {
      const pEntry = purokMap.get(r.purokId) ?? {
        purokId: r.purokId,
        purokName: r.purokName,
        total: 0,
        compliant: 0,
        partial: 0,
        nonCompliant: 0,
      };
      pEntry.total++;
      if (r.status === "compliant") pEntry.compliant++;
      else if (r.status === "partially_compliant") pEntry.partial++;
      else pEntry.nonCompliant++;
      purokMap.set(r.purokId, pEntry);

      const ym = r.inspectionDate.slice(0, 7);
      const mEntry = monthMap.get(ym) ?? {
        month: ym,
        total: 0,
        compliant: 0,
        partial: 0,
        nonCompliant: 0,
      };
      mEntry.total++;
      if (r.status === "compliant") mEntry.compliant++;
      else if (r.status === "partially_compliant") mEntry.partial++;
      else mEntry.nonCompliant++;
      monthMap.set(ym, mEntry);
    }

    const byPurok = Array.from(purokMap.values()).map((p) => ({
      ...p,
      rate: p.total > 0 ? Math.round((p.compliant / p.total) * 100) : 0,
    }));

    const byMonth = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        rate: m.total > 0 ? Math.round((m.compliant / m.total) * 100) : 0,
      }));

    // Build filtered detailed records — strict RA 10173 isolation for residents!
    const conditions = [];
    if (isResident) {
      if (auth.user.householdId) {
        conditions.push(eq(complianceRecords.householdId, auth.user.householdId));
      } else {
        // Resident not yet linked to household sees 0 records
        return Response.json({
          records: [],
          byPurok,
          byMonth,
          repeatViolators: [],
          puroks: await db.select().from(puroks).orderBy(asc(puroks.code)),
          households: [],
        });
      }
    } else {
      if (purokFilter && purokFilter !== "all") {
        const pid = Number(purokFilter);
        if (Number.isInteger(pid) && pid > 0) {
          conditions.push(eq(complianceRecords.purokId, pid));
        }
      }
      if (householdFilter && householdFilter !== "all") {
        const hid = Number(householdFilter);
        if (Number.isInteger(hid) && hid > 0) {
          conditions.push(eq(complianceRecords.householdId, hid));
        }
      }
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "contested") {
        conditions.push(eq(complianceRecords.contested, true));
      } else {
        conditions.push(eq(complianceRecords.status, statusFilter));
      }
    }

    const records = await db
      .select({
        id: complianceRecords.id,
        householdId: complianceRecords.householdId,
        householdCode: households.householdCode,
        headName: households.headName,
        address: households.address,
        isRepeatViolator: households.isRepeatViolator,
        purokId: complianceRecords.purokId,
        purokName: puroks.name,
        inspectorId: complianceRecords.inspectorId,
        inspectorName: users.fullName,
        inspectionDate: complianceRecords.inspectionDate,
        wasteType: complianceRecords.wasteType,
        status: complianceRecords.status,
        violationType: complianceRecords.violationType,
        notes: complianceRecords.notes,
        photoUrl: complianceRecords.photoUrl,
        noticeType: complianceRecords.noticeType,
        noticeSentAt: complianceRecords.noticeSentAt,
        contested: complianceRecords.contested,
        contestReason: complianceRecords.contestReason,
        contestStatus: complianceRecords.contestStatus,
        contestResponse: complianceRecords.contestResponse,
        createdAt: complianceRecords.createdAt,
      })
      .from(complianceRecords)
      .innerJoin(households, eq(complianceRecords.householdId, households.id))
      .innerJoin(puroks, eq(complianceRecords.purokId, puroks.id))
      .leftJoin(users, eq(complianceRecords.inspectorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complianceRecords.inspectionDate), desc(complianceRecords.id));

    const allPuroks = await db.select().from(puroks).orderBy(asc(puroks.code));

    // Never leak other households' PII or repeat violator lists to residents!
    const allHouseholds = isResident
      ? []
      : await db
          .select({
            id: households.id,
            householdCode: households.householdCode,
            headName: households.headName,
            address: households.address,
            purokId: households.purokId,
            purokName: puroks.name,
            isRepeatViolator: households.isRepeatViolator,
          })
          .from(households)
          .innerJoin(puroks, eq(households.purokId, puroks.id))
          .orderBy(asc(households.householdCode));

    const repeatViolators = allHouseholds.filter((h) => h.isRepeatViolator);

    return Response.json({
      records,
      byPurok,
      byMonth,
      repeatViolators,
      puroks: allPuroks,
      households: allHouseholds,
    });
  } catch (err) {
    console.error("GET compliance error:", err);
    return Response.json({ error: "Failed to load compliance records." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["collector", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = createComplianceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid inspection entry." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    if (data.status !== "compliant" && data.violationType.length < 2) {
      return Response.json(
        { error: "Please select or specify a violation type for non-compliant or partially compliant entries." },
        { status: 400 }
      );
    }

    const [hh] = await db
      .select()
      .from(households)
      .where(eq(households.id, data.householdId))
      .limit(1);

    if (!hh) {
      return Response.json({ error: "Household not found." }, { status: 404 });
    }

    const noticeType =
      data.status === "compliant" ? "none" : data.noticeType ?? "education";

    const [created] = await db
      .insert(complianceRecords)
      .values({
        householdId: hh.id,
        purokId: hh.purokId,
        inspectorId: auth.user.id,
        inspectionDate: data.inspectionDate,
        wasteType: data.wasteType,
        status: data.status,
        violationType: data.status === "compliant" ? "" : data.violationType,
        notes: data.notes,
        photoUrl: data.photoUrl,
        noticeType,
        noticeSentAt: noticeType !== "none" ? new Date() : null,
        contested: false,
        contestStatus: "none",
      })
      .returning();

    const isRepeat = await recalculateRepeatViolator(hh.id);

    // Notify linked resident(s) — education or warning only, NEVER automatic fines
    const linkedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.householdId, hh.id));

    for (const u of linkedUsers) {
      await notifyUser({
        userId: u.id,
        purokId: hh.purokId,
        title:
          noticeType === "warning"
            ? "RA 9003 Segregation Warning Notice"
            : noticeType === "education"
            ? "RA 9003 Segregation Education Reminder"
            : "Segregation Inspection Recorded",
        message:
          data.status === "compliant"
            ? `Thank you! Your household (${hh.householdCode}) was recorded as Compliant on ${data.inspectionDate}.`
            : `Your household (${hh.householdCode}) was marked ${data.status.replace("_", " ")} (${data.violationType}). No fines are imposed automatically — you may review or contest this record.`,
        category: "compliance",
        link: "/app/compliance",
      });
    }

    await logAudit({
      actor: auth.user,
      action: "CREATE_COMPLIANCE_RECORD",
      entityType: "compliance_record",
      entityId: created.id,
      summary: `Recorded ${data.status} inspection for ${hh.householdCode} (${hh.headName}).${
        isRepeat ? " Flagged as repeat violator." : ""
      }`,
    });

    return Response.json(
      { ok: true, record: created, isRepeatViolator: isRepeat },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST compliance error:", err);
    return Response.json({ error: "Failed to save compliance record." }, { status: 500 });
  }
}
