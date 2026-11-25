import crypto from "crypto";
import { db } from "@/db";
import { schedules, puroks, trucks, users } from "@/db/schema";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { addDaysToDateStr } from "@/lib/i18n";
import { logAudit, notifyPurokResidents, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

const createScheduleSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  purokId: z.coerce.number().int().positive(),
  wasteType: z.enum(["biodegradable", "recyclable", "residual", "special"]),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid start time (HH:MM)."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid end time (HH:MM)."),
  truckId: z.coerce.number().int().positive().nullable().optional(),
  driverId: z.coerce.number().int().positive().nullable().optional(),
  crewNames: z.string().trim().max(300).optional().default(""),
  recurrence: z.enum(["none", "weekly", "biweekly"]).default("none"),
  repeatCount: z.coerce.number().int().min(1).max(8).optional().default(4),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function GET(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const purokId = searchParams.get("purokId");
    const wasteType = searchParams.get("wasteType");
    const status = searchParams.get("status");

    const conditions = [];
    if (from) conditions.push(gte(schedules.scheduledDate, from));
    if (to) conditions.push(lte(schedules.scheduledDate, to));
    if (purokId && purokId !== "all") {
      const pid = Number(purokId);
      if (Number.isInteger(pid) && pid > 0) conditions.push(eq(schedules.purokId, pid));
    }
    if (wasteType && wasteType !== "all") {
      conditions.push(eq(schedules.wasteType, wasteType));
    }
    if (status && status !== "all") {
      conditions.push(eq(schedules.status, status));
    }

    // Collector sees all schedules or filtered; let's allow collectors to see schedules assigned to them if mine=true
    if (searchParams.get("mine") === "true" && auth.user.roleCode === "collector") {
      conditions.push(eq(schedules.driverId, auth.user.id));
    }

    const rows = await db
      .select({
        id: schedules.id,
        title: schedules.title,
        purokId: schedules.purokId,
        purokName: puroks.name,
        purokCode: puroks.code,
        wasteType: schedules.wasteType,
        scheduledDate: schedules.scheduledDate,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        truckId: schedules.truckId,
        truckName: trucks.name,
        truckCode: trucks.code,
        driverId: schedules.driverId,
        driverName: users.fullName,
        crewNames: schedules.crewNames,
        recurrence: schedules.recurrence,
        recurrenceGroupId: schedules.recurrenceGroupId,
        status: schedules.status,
        notes: schedules.notes,
        createdAt: schedules.createdAt,
      })
      .from(schedules)
      .innerJoin(puroks, eq(schedules.purokId, puroks.id))
      .leftJoin(trucks, eq(schedules.truckId, trucks.id))
      .leftJoin(users, eq(schedules.driverId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schedules.scheduledDate), asc(schedules.startTime));

    const [allPuroks, allTrucks, allCollectors] = await Promise.all([
      db.select().from(puroks).orderBy(asc(puroks.code)),
      db.select().from(trucks).orderBy(asc(trucks.code)),
      db
        .select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users)
        .where(and(eq(users.roleCode, "collector"), eq(users.status, "approved"))),
    ]);

    return Response.json({
      schedules: rows,
      puroks: allPuroks,
      trucks: allTrucks,
      collectors: allCollectors,
    });
  } catch (err) {
    console.error("GET schedules error:", err);
    return Response.json({ error: "Failed to load schedules." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSeeded();
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid schedule inputs." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.startTime >= data.endTime) {
      return Response.json(
        { error: "End time must be later than start time." },
        { status: 400 }
      );
    }

    const stepDays = data.recurrence === "weekly" ? 7 : data.recurrence === "biweekly" ? 14 : 0;
    const countOccurrences = stepDays > 0 ? data.repeatCount : 1;
    const datesToCreate: string[] = [];
    for (let i = 0; i < countOccurrences; i++) {
      datesToCreate.push(addDaysToDateStr(data.scheduledDate, i * stepDays));
    }

    // Strict double-booking detection for truck or driver/crew across all planned dates
    for (const dt of datesToCreate) {
      const existingOnDate = await db
        .select({
          id: schedules.id,
          title: schedules.title,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
          truckId: schedules.truckId,
          driverId: schedules.driverId,
          crewNames: schedules.crewNames,
          purokName: puroks.name,
        })
        .from(schedules)
        .innerJoin(puroks, eq(schedules.purokId, puroks.id))
        .where(and(eq(schedules.scheduledDate, dt), ne(schedules.status, "cancelled")));

      for (const ex of existingOnDate) {
        if (!timesOverlap(data.startTime, data.endTime, ex.startTime, ex.endTime)) {
          continue;
        }
        if (data.truckId && ex.truckId === data.truckId) {
          return Response.json(
            {
              error: `Truck double-booking detected on ${dt} (${ex.startTime}–${ex.endTime}): already assigned to "${ex.title}" (${ex.purokName}).`,
              conflictType: "truck",
              conflictScheduleId: ex.id,
            },
            { status: 409 }
          );
        }
        if (data.driverId && ex.driverId === data.driverId) {
          return Response.json(
            {
              error: `Driver/Crew double-booking detected on ${dt} (${ex.startTime}–${ex.endTime}): driver is already assigned to "${ex.title}" (${ex.purokName}).`,
              conflictType: "driver",
              conflictScheduleId: ex.id,
            },
            { status: 409 }
          );
        }
        if (
          data.crewNames &&
          ex.crewNames &&
          data.crewNames.toLowerCase().trim() === ex.crewNames.toLowerCase().trim()
        ) {
          return Response.json(
            {
              error: `Crew double-booking detected on ${dt} (${ex.startTime}–${ex.endTime}): crew "${ex.crewNames}" is already assigned to "${ex.title}".`,
              conflictType: "crew",
              conflictScheduleId: ex.id,
            },
            { status: 409 }
          );
        }
      }
    }

    const groupId =
      stepDays > 0 ? `rec-${crypto.randomBytes(6).toString("hex")}` : null;

    const created = await db
      .insert(schedules)
      .values(
        datesToCreate.map((dt) => ({
          title: data.title,
          purokId: data.purokId,
          wasteType: data.wasteType,
          scheduledDate: dt,
          startTime: data.startTime,
          endTime: data.endTime,
          truckId: data.truckId ?? null,
          driverId: data.driverId ?? null,
          crewNames: data.crewNames,
          recurrence: data.recurrence,
          recurrenceGroupId: groupId,
          status: "scheduled",
          notes: data.notes,
          createdBy: auth.user.id,
        }))
      )
      .returning();

    await notifyPurokResidents({
      purokId: data.purokId,
      title: `New Collection Schedule: ${data.title}`,
      message: `Scheduled for ${data.scheduledDate} (${data.startTime}–${data.endTime})${
        countOccurrences > 1 ? ` and ${countOccurrences - 1} recurring dates` : ""
      }.`,
      category: "reminder",
      link: "/app/schedules",
    });

    if (data.driverId) {
      await notifyUser({
        userId: data.driverId,
        purokId: data.purokId,
        title: `Assigned Collection Schedule: ${data.title}`,
        message: `You are assigned on ${data.scheduledDate} (${data.startTime}–${data.endTime}).`,
        category: "reminder",
        link: "/app/schedules",
      });
    }

    await logAudit({
      actor: auth.user,
      action: "CREATE_SCHEDULE",
      entityType: "schedule",
      entityId: created[0].id,
      summary: `Created ${created.length} schedule(s) for "${data.title}" starting ${data.scheduledDate}.`,
      details: { dates: datesToCreate, wasteType: data.wasteType },
    });

    return Response.json({ ok: true, created, count: created.length }, { status: 201 });
  } catch (err) {
    console.error("POST schedule error:", err);
    return Response.json({ error: "Failed to create schedule." }, { status: 500 });
  }
}
