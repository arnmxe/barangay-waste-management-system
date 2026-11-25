import { db } from "@/db";
import {
  schedules,
  routes,
  routeStops,
  missedReports,
  complianceRecords,
  puroks,
  households,
  auditLogs,
  users,
  trucks,
} from "@/db/schema";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { addDaysToDateStr, getTodayDateStr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const today = getTodayDateStr();
    const weekEnd = addDaysToDateStr(today, 6);
    const role = auth.user.roleCode;

    // Resident personalized dashboard
    if (role === "resident") {
      const mySchedules = auth.user.purokId
        ? await db
            .select({
              id: schedules.id,
              title: schedules.title,
              wasteType: schedules.wasteType,
              scheduledDate: schedules.scheduledDate,
              startTime: schedules.startTime,
              endTime: schedules.endTime,
              status: schedules.status,
              truckName: trucks.name,
            })
            .from(schedules)
            .leftJoin(trucks, eq(schedules.truckId, trucks.id))
            .where(
              and(
                eq(schedules.purokId, auth.user.purokId),
                gte(schedules.scheduledDate, today),
                lte(schedules.scheduledDate, weekEnd),
                ne(schedules.status, "cancelled")
              )
            )
            .orderBy(asc(schedules.scheduledDate), asc(schedules.startTime))
        : [];

      const myReports = await db
        .select()
        .from(missedReports)
        .where(eq(missedReports.residentId, auth.user.id))
        .orderBy(desc(missedReports.createdAt))
        .limit(5);

      const myCompliance = auth.user.householdId
        ? await db
            .select()
            .from(complianceRecords)
            .where(eq(complianceRecords.householdId, auth.user.householdId))
            .orderBy(desc(complianceRecords.inspectionDate))
            .limit(5)
        : [];

      return Response.json({
        role,
        today,
        residentData: {
          upcomingSchedules: mySchedules,
          recentReports: myReports,
          recentCompliance: myCompliance,
        },
      });
    }

    // Collector dashboard
    if (role === "collector") {
      const assignedRoutes = await db
        .select({
          id: routes.id,
          name: routes.name,
          routeDate: routes.routeDate,
          wasteType: routes.wasteType,
          status: routes.status,
          estimatedDistanceKm: routes.estimatedDistanceKm,
          purokName: puroks.name,
          truckName: trucks.name,
        })
        .from(routes)
        .innerJoin(puroks, eq(routes.purokId, puroks.id))
        .leftJoin(trucks, eq(routes.truckId, trucks.id))
        .where(eq(routes.driverId, auth.user.id))
        .orderBy(desc(routes.routeDate), desc(routes.id));

      const allStops = await db.select().from(routeStops);
      const routesWithProgress = assignedRoutes.map((r) => {
        const st = allStops.filter((s) => s.routeId === r.id);
        const done = st.filter((s) => s.status !== "pending").length;
        return {
          ...r,
          totalStops: st.length,
          doneStops: done,
          progressPct: st.length > 0 ? Math.round((done / st.length) * 100) : 0,
        };
      });

      const assignedReports = await db
        .select({
          id: missedReports.id,
          ticketNumber: missedReports.ticketNumber,
          wasteType: missedReports.wasteType,
          address: missedReports.address,
          status: missedReports.status,
          missedDate: missedReports.missedDate,
        })
        .from(missedReports)
        .where(eq(missedReports.assignedCollectorId, auth.user.id))
        .orderBy(desc(missedReports.createdAt));

      return Response.json({
        role,
        today,
        collectorData: {
          assignedRoutes: routesWithProgress,
          assignedReports,
        },
      });
    }

    // Admin & Official Executive Dashboard
    const [
      todaySchedules,
      todayRoutes,
      allStops,
      allReports,
      allCompliance,
      allPuroks,
      repeatHouseholds,
      recentAudit,
      pendingUsers,
    ] = await Promise.all([
      db
        .select({
          id: schedules.id,
          title: schedules.title,
          wasteType: schedules.wasteType,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
          status: schedules.status,
          purokName: puroks.name,
        })
        .from(schedules)
        .innerJoin(puroks, eq(schedules.purokId, puroks.id))
        .where(and(eq(schedules.scheduledDate, today), ne(schedules.status, "cancelled"))),
      db
        .select({
          id: routes.id,
          name: routes.name,
          status: routes.status,
          routeDate: routes.routeDate,
          wasteType: routes.wasteType,
          purokName: puroks.name,
          driverName: users.fullName,
        })
        .from(routes)
        .innerJoin(puroks, eq(routes.purokId, puroks.id))
        .leftJoin(users, eq(routes.driverId, users.id))
        .where(eq(routes.routeDate, today)),
      db.select().from(routeStops),
      db
        .select({
          id: missedReports.id,
          ticketNumber: missedReports.ticketNumber,
          status: missedReports.status,
          wasteType: missedReports.wasteType,
          address: missedReports.address,
          lat: missedReports.lat,
          lng: missedReports.lng,
          purokName: puroks.name,
          createdAt: missedReports.createdAt,
        })
        .from(missedReports)
        .innerJoin(puroks, eq(missedReports.purokId, puroks.id)),
      db
        .select({
          purokId: complianceRecords.purokId,
          purokName: puroks.name,
          inspectionDate: complianceRecords.inspectionDate,
          status: complianceRecords.status,
          wasteType: complianceRecords.wasteType,
        })
        .from(complianceRecords)
        .innerJoin(puroks, eq(complianceRecords.purokId, puroks.id)),
      db.select().from(puroks).orderBy(asc(puroks.code)),
      db
        .select({
          id: households.id,
          householdCode: households.householdCode,
          headName: households.headName,
          address: households.address,
          lat: households.lat,
          lng: households.lng,
          purokName: puroks.name,
        })
        .from(households)
        .innerJoin(puroks, eq(households.purokId, puroks.id))
        .where(eq(households.isRepeatViolator, true)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12),
      db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(eq(users.status, "pending")),
    ]);

    const todayRouteIds = new Set(todayRoutes.map((r) => r.id));
    const todayStops = allStops.filter((s) => todayRouteIds.has(s.routeId));
    const todayStopsDone = todayStops.filter((s) => s.status !== "pending").length;
    const routeProgressPct =
      todayStops.length > 0
        ? Math.round((todayStopsDone / todayStops.length) * 100)
        : 0;

    const nowMs = Date.now();
    const openReports = allReports.filter(
      (r) => r.status !== "resolved" && r.status !== "rejected"
    );
    const overdueReports = openReports.filter(
      (r) => nowMs - new Date(r.createdAt).getTime() > 48 * 60 * 60 * 1000
    );

    const totalComp = allCompliance.length;
    const compliantCount = allCompliance.filter((c) => c.status === "compliant").length;
    const complianceRate =
      totalComp > 0 ? Math.round((compliantCount / totalComp) * 100) : 0;

    // Compliance by purok
    const byPurok = allPuroks.map((p) => {
      const items = allCompliance.filter((c) => c.purokId === p.id);
      const ok = items.filter((c) => c.status === "compliant").length;
      const partial = items.filter((c) => c.status === "partially_compliant").length;
      const non = items.filter((c) => c.status === "non_compliant").length;
      return {
        purokCode: p.code,
        purokName: p.name.replace(" – ", " "),
        rate: items.length > 0 ? Math.round((ok / items.length) * 100) : 0,
        compliant: ok,
        partial,
        nonCompliant: non,
      };
    });

    // Monthly compliance trend
    const mMap = new Map<string, { month: string; total: number; compliant: number; nonCompliant: number }>();
    for (const c of allCompliance) {
      const ym = c.inspectionDate.slice(0, 7);
      const curr = mMap.get(ym) ?? { month: ym, total: 0, compliant: 0, nonCompliant: 0 };
      curr.total++;
      if (c.status === "compliant") curr.compliant++;
      if (c.status === "non_compliant") curr.nonCompliant++;
      mMap.set(ym, curr);
    }
    const monthlyTrend = Array.from(mMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        rate: m.total > 0 ? Math.round((m.compliant / m.total) * 100) : 0,
      }));

    // Problem area pins for map (open missed reports + repeat violator households)
    const problemPins = [
      ...openReports.map((r) => ({
        id: `report-${r.id}`,
        kind: "missed_report" as const,
        label: `${r.ticketNumber} (${r.wasteType})`,
        detail: `${r.address} • Status: ${r.status}`,
        lat: r.lat,
        lng: r.lng,
      })),
      ...repeatHouseholds.map((h) => ({
        id: `violator-${h.id}`,
        kind: "repeat_violator" as const,
        label: `Repeat Violator: ${h.householdCode}`,
        detail: `${h.headName} • ${h.address}`,
        lat: h.lat,
        lng: h.lng,
      })),
    ];

    const liveRoutes = todayRoutes.map((r) => {
      const st = allStops.filter((s) => s.routeId === r.id);
      const done = st.filter((s) => s.status !== "pending").length;
      return {
        ...r,
        totalStops: st.length,
        doneStops: done,
        progressPct: st.length > 0 ? Math.round((done / st.length) * 100) : 0,
      };
    });

    return Response.json({
      role,
      today,
      kpis: {
        todaysCollections: todaySchedules.length,
        routeProgressPct,
        todayStopsDone,
        todayStopsTotal: todayStops.length,
        openReportsCount: openReports.length,
        overdueReportsCount: overdueReports.length,
        complianceRate,
        pendingApprovalsCount: pendingUsers.length,
        repeatViolatorsCount: repeatHouseholds.length,
      },
      todaySchedules,
      liveRoutes,
      byPurok,
      monthlyTrend,
      problemPins,
      recentAudit,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return Response.json({ error: "Failed to load dashboard." }, { status: 500 });
  }
}
