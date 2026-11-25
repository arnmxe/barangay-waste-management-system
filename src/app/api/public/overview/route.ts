import { db } from "@/db";
import {
  puroks,
  schedules,
  trucks,
  announcements,
  households,
  complianceRecords,
} from "@/db/schema";
import { and, asc, count, desc, eq, gte, lte, ne } from "drizzle-orm";
import { ensureSeeded } from "@/db/seed";
import { addDaysToDateStr, getTodayDateStr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const purokIdParam = searchParams.get("purokId");
    const wasteTypeParam = searchParams.get("wasteType");

    const today = getTodayDateStr();
    const weekEnd = addDaysToDateStr(today, 6);

    const allPuroks = await db.select().from(puroks).orderBy(asc(puroks.code));

    const conditions = [
      gte(schedules.scheduledDate, today),
      lte(schedules.scheduledDate, weekEnd),
      ne(schedules.status, "cancelled"),
    ];
    if (purokIdParam && purokIdParam !== "all") {
      const pid = Number(purokIdParam);
      if (Number.isInteger(pid) && pid > 0) {
        conditions.push(eq(schedules.purokId, pid));
      }
    }
    if (wasteTypeParam && wasteTypeParam !== "all") {
      conditions.push(eq(schedules.wasteType, wasteTypeParam));
    }

    const weekSchedules = await db
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
        status: schedules.status,
        notes: schedules.notes,
        truckName: trucks.name,
        truckCode: trucks.code,
      })
      .from(schedules)
      .innerJoin(puroks, eq(schedules.purokId, puroks.id))
      .leftJoin(trucks, eq(schedules.truckId, trucks.id))
      .where(and(...conditions))
      .orderBy(asc(schedules.scheduledDate), asc(schedules.startTime));

    const publishedAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.published, true))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));

    const [hhCount] = await db.select({ total: count() }).from(households);
    const [truckCount] = await db
      .select({ total: count() })
      .from(trucks)
      .where(eq(trucks.status, "active"));
    const [compTotal] = await db.select({ total: count() }).from(complianceRecords);
    const [compOk] = await db
      .select({ total: count() })
      .from(complianceRecords)
      .where(eq(complianceRecords.status, "compliant"));

    const complianceRate =
      (compTotal?.total ?? 0) > 0
        ? Math.round(((compOk?.total ?? 0) / (compTotal?.total ?? 1)) * 100)
        : 0;

    return Response.json({
      today,
      weekEnd,
      puroks: allPuroks,
      schedules: weekSchedules,
      announcements: publishedAnnouncements,
      stats: {
        puroksCount: allPuroks.length,
        householdsCount: hhCount?.total ?? 0,
        activeTrucksCount: truckCount?.total ?? 0,
        complianceRate,
      },
    });
  } catch (err) {
    console.error("Public overview error:", err);
    return Response.json(
      { error: "Unable to load barangay schedule data." },
      { status: 500 }
    );
  }
}
