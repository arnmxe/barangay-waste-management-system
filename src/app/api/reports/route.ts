import crypto from "crypto";
import { db } from "@/db";
import {
  missedReports,
  reportUpdates,
  puroks,
  users,
  trucks,
  households,
} from "@/db/schema";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { logAudit, notifyAdmins } from "@/lib/audit";

export const dynamic = "force-dynamic";

const OVERDUE_MS = 48 * 60 * 60 * 1000;

const createReportSchema = z.object({
  missedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]),
  purokId: z.coerce.number().int().positive().optional(),
  address: z.string().trim().min(5, "Please provide the street address.").max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  notes: z.string().trim().min(5, "Please describe the missed pickup.").max(800),
  photoUrl: z.string().trim().max(400).optional().default(""),
});

export async function GET(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const purokFilter = searchParams.get("purokId");

    const conditions = [];
    // Privacy enforcement (RA 10173): Residents ONLY see their own reports!
    if (auth.user.roleCode === "resident") {
      conditions.push(eq(missedReports.residentId, auth.user.id));
    } else if (auth.user.roleCode === "collector") {
      conditions.push(eq(missedReports.assignedCollectorId, auth.user.id));
    }

    if (statusFilter && statusFilter !== "all" && statusFilter !== "overdue") {
      conditions.push(eq(missedReports.status, statusFilter));
    }
    if (purokFilter && purokFilter !== "all") {
      const pid = Number(purokFilter);
      if (Number.isInteger(pid) && pid > 0) {
        conditions.push(eq(missedReports.purokId, pid));
      }
    }

    const rows = await db
      .select({
        id: missedReports.id,
        ticketNumber: missedReports.ticketNumber,
        residentId: missedReports.residentId,
        residentName: users.fullName,
        householdId: missedReports.householdId,
        purokId: missedReports.purokId,
        purokName: puroks.name,
        missedDate: missedReports.missedDate,
        wasteType: missedReports.wasteType,
        address: missedReports.address,
        lat: missedReports.lat,
        lng: missedReports.lng,
        notes: missedReports.notes,
        photoUrl: missedReports.photoUrl,
        status: missedReports.status,
        rejectionReason: missedReports.rejectionReason,
        assignedCollectorId: missedReports.assignedCollectorId,
        assignedTruckId: missedReports.assignedTruckId,
        truckName: trucks.name,
        residentConfirmed: missedReports.residentConfirmed,
        residentConfirmedAt: missedReports.residentConfirmedAt,
        resolvedAt: missedReports.resolvedAt,
        createdAt: missedReports.createdAt,
        updatedAt: missedReports.updatedAt,
      })
      .from(missedReports)
      .innerJoin(users, eq(missedReports.residentId, users.id))
      .innerJoin(puroks, eq(missedReports.purokId, puroks.id))
      .leftJoin(trucks, eq(missedReports.assignedTruckId, trucks.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(missedReports.createdAt));

    const allCollectors = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.roleCode, "collector"), eq(users.status, "approved")));
    const collectorMap = new Map(allCollectors.map((c) => [c.id, c.fullName]));

    const nowMs = Date.now();
    let enriched = rows.map((r) => {
      const ageMs = nowMs - new Date(r.createdAt).getTime();
      const isOpen = r.status !== "resolved" && r.status !== "rejected";
      const isOverdue = isOpen && ageMs > OVERDUE_MS;
      return {
        ...r,
        assignedCollectorName: r.assignedCollectorId
          ? collectorMap.get(r.assignedCollectorId) ?? null
          : null,
        isOverdue,
        hoursOpen: Math.floor(ageMs / (1000 * 60 * 60)),
      };
    });

    if (statusFilter === "overdue") {
      enriched = enriched.filter((r) => r.isOverdue);
    }

    const [allPuroks, allTrucks, residentHousehold] = await Promise.all([
      db.select().from(puroks).orderBy(asc(puroks.code)),
      db.select().from(trucks).orderBy(asc(trucks.code)),
      auth.user.householdId
        ? db
            .select()
            .from(households)
            .where(eq(households.id, auth.user.householdId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return Response.json({
      reports: enriched,
      puroks: allPuroks,
      trucks: allTrucks,
      collectors: allCollectors,
      userHousehold: residentHousehold[0] ?? null,
    });
  } catch (err) {
    console.error("GET reports error:", err);
    return Response.json({ error: "Failed to load missed pickup reports." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["resident", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid missed pickup details." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const targetPurokId =
      auth.user.roleCode === "resident"
        ? auth.user.purokId ?? data.purokId
        : data.purokId ?? auth.user.purokId;

    if (!targetPurokId) {
      return Response.json({ error: "Please select a Purok." }, { status: 400 });
    }

    // Prevent duplicate active report for same resident/household + date + waste type
    const duplicate = await db
      .select({ id: missedReports.id, ticketNumber: missedReports.ticketNumber })
      .from(missedReports)
      .where(
        and(
          eq(missedReports.residentId, auth.user.id),
          eq(missedReports.missedDate, data.missedDate),
          eq(missedReports.wasteType, data.wasteType),
          ne(missedReports.status, "rejected")
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      return Response.json(
        {
          error: `Duplicate report prevented: Ticket ${duplicate[0].ticketNumber} already exists for ${data.wasteType} on ${data.missedDate}.`,
          existingTicket: duplicate[0].ticketNumber,
        },
        { status: 409 }
      );
    }

    const dateTag = data.missedDate.replace(/-/g, "");
    const randDigits = String(crypto.randomInt(1000, 9999));
    const ticketNumber = `MPR-${dateTag}-${randDigits}`;

    const [created] = await db
      .insert(missedReports)
      .values({
        ticketNumber,
        residentId: auth.user.id,
        householdId: auth.user.householdId ?? null,
        purokId: targetPurokId,
        missedDate: data.missedDate,
        wasteType: data.wasteType,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        notes: data.notes,
        photoUrl: data.photoUrl,
        status: "submitted",
      })
      .returning();

    await db.insert(reportUpdates).values({
      reportId: created.id,
      authorId: auth.user.id,
      authorName: auth.user.fullName,
      authorRole: auth.user.roleCode,
      fromStatus: null,
      toStatus: "submitted",
      comment: `Missed pickup report submitted: ${data.notes}`,
    });

    await notifyAdmins({
      title: `New Missed Pickup Report: ${ticketNumber}`,
      message: `${auth.user.fullName} reported a missed ${data.wasteType} pickup at ${data.address}.`,
      category: "report",
      link: "/app/reports",
    });

    await logAudit({
      actor: auth.user,
      action: "CREATE_REPORT",
      entityType: "missed_report",
      entityId: created.id,
      summary: `Submitted missed pickup ticket ${ticketNumber} (${data.wasteType} on ${data.missedDate}).`,
    });

    return Response.json({ ok: true, report: created }, { status: 201 });
  } catch (err) {
    console.error("POST report error:", err);
    return Response.json({ error: "Failed to submit report." }, { status: 500 });
  }
}
