import { db } from "@/db";
import {
  schedules,
  missedReports,
  complianceRecords,
  puroks,
  households,
  trucks,
  users,
  auditLogs,
} from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["admin", "official"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get("dataset") ?? "compliance"; // schedules | reports | compliance | audit
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const purokId = searchParams.get("purokId");

    const pid = purokId && purokId !== "all" ? Number(purokId) : null;

    if (dataset === "schedules") {
      const conds = [];
      if (from) conds.push(gte(schedules.scheduledDate, from));
      if (to) conds.push(lte(schedules.scheduledDate, to));
      if (pid) conds.push(eq(schedules.purokId, pid));

      const rows = await db
        .select({
          date: schedules.scheduledDate,
          time: schedules.startTime,
          endTime: schedules.endTime,
          purok: puroks.name,
          wasteType: schedules.wasteType,
          title: schedules.title,
          truck: trucks.name,
          driver: users.fullName,
          status: schedules.status,
        })
        .from(schedules)
        .innerJoin(puroks, eq(schedules.purokId, puroks.id))
        .leftJoin(trucks, eq(schedules.truckId, trucks.id))
        .leftJoin(users, eq(schedules.driverId, users.id))
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schedules.scheduledDate));

      return Response.json({
        title: "Barangay San Isidro – Waste Collection Schedules Report",
        columns: ["Date", "Window", "Purok", "Waste Type", "Truck", "Driver", "Status"],
        rows: rows.map((r) => [
          r.date,
          `${r.time}-${r.endTime}`,
          r.purok,
          r.wasteType,
          r.truck ?? "Unassigned",
          r.driver ?? "Unassigned",
          r.status,
        ]),
      });
    }

    if (dataset === "reports") {
      const conds = [];
      if (from) conds.push(gte(missedReports.missedDate, from));
      if (to) conds.push(lte(missedReports.missedDate, to));
      if (pid) conds.push(eq(missedReports.purokId, pid));

      const rows = await db
        .select({
          ticket: missedReports.ticketNumber,
          missedDate: missedReports.missedDate,
          purok: puroks.name,
          wasteType: missedReports.wasteType,
          address: missedReports.address,
          status: missedReports.status,
          confirmed: missedReports.residentConfirmed,
        })
        .from(missedReports)
        .innerJoin(puroks, eq(missedReports.purokId, puroks.id))
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(missedReports.createdAt));

      return Response.json({
        title: "Barangay San Isidro – Missed Pickup Reports Summary",
        columns: ["Ticket #", "Missed Date", "Purok", "Waste Type", "Address", "Status", "Resident Confirmed"],
        rows: rows.map((r) => [
          r.ticket,
          r.missedDate,
          r.purok,
          r.wasteType,
          r.address,
          r.status,
          r.confirmed ? "Yes" : "No",
        ]),
      });
    }

    if (dataset === "audit") {
      const rows = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(200);

      return Response.json({
        title: "Barangay San Isidro – System Audit Log",
        columns: ["Timestamp", "Actor", "Role", "Action", "Entity", "Summary"],
        rows: rows.map((r) => [
          new Date(r.createdAt).toISOString().slice(0, 19).replace("T", " "),
          r.actorName,
          r.actorRole,
          r.action,
          r.entityType,
          r.summary,
        ]),
      });
    }

    // Default: compliance
    const conds = [];
    if (from) conds.push(gte(complianceRecords.inspectionDate, from));
    if (to) conds.push(lte(complianceRecords.inspectionDate, to));
    if (pid) conds.push(eq(complianceRecords.purokId, pid));

    const rows = await db
      .select({
        date: complianceRecords.inspectionDate,
        householdCode: households.householdCode,
        purok: puroks.name,
        wasteType: complianceRecords.wasteType,
        status: complianceRecords.status,
        violationType: complianceRecords.violationType,
        noticeType: complianceRecords.noticeType,
        contested: complianceRecords.contested,
      })
      .from(complianceRecords)
      .innerJoin(households, eq(complianceRecords.householdId, households.id))
      .innerJoin(puroks, eq(complianceRecords.purokId, puroks.id))
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(complianceRecords.inspectionDate));

    return Response.json({
      title: "Barangay San Isidro – RA 9003 Segregation Compliance Report",
      columns: ["Date", "Household Code", "Purok", "Waste Type", "Status", "Violation", "Notice", "Contested"],
      rows: rows.map((r) => [
        r.date,
        r.householdCode,
        r.purok,
        r.wasteType,
        r.status,
        r.violationType || "None",
        r.noticeType,
        r.contested ? "Yes" : "No",
      ]),
    });
  } catch (err) {
    console.error("Export error:", err);
    return Response.json({ error: "Failed to generate export." }, { status: 500 });
  }
}
