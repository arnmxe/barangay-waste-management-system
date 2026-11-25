"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Truck,
  AlertOctagon,
  ClipboardCheck,
  Activity,
  ArrowRight,
  Loader2,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useApp } from "@/components/AppProviders";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import { LeafletMap, MapPin } from "@/components/LeafletMap";
import { formatDateStr } from "@/lib/i18n";

interface DashboardResponse {
  role: string;
  today: string;
  kpis?: {
    todaysCollections: number;
    routeProgressPct: number;
    todayStopsDone: number;
    todayStopsTotal: number;
    openReportsCount: number;
    overdueReportsCount: number;
    complianceRate: number;
    pendingApprovalsCount: number;
    repeatViolatorsCount: number;
  };
  liveRoutes?: Array<{
    id: number;
    name: string;
    status: string;
    wasteType: string;
    purokName: string;
    driverName: string | null;
    totalStops: number;
    doneStops: number;
    progressPct: number;
  }>;
  byPurok?: Array<{
    purokCode: string;
    purokName: string;
    rate: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
  }>;
  monthlyTrend?: Array<{
    month: string;
    rate: number;
    total: number;
  }>;
  problemPins?: Array<{
    id: string;
    kind: "missed_report" | "repeat_violator";
    label: string;
    detail: string;
    lat: number;
    lng: number;
  }>;
  recentAudit?: Array<{
    id: number;
    actorName: string;
    actorRole: string;
    action: string;
    summary: string;
    createdAt: string;
  }>;
  residentData?: {
    upcomingSchedules: Array<{
      id: number;
      title: string;
      wasteType: string;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      status: string;
      truckName: string | null;
    }>;
    recentReports: Array<{
      id: number;
      ticketNumber: string;
      missedDate: string;
      wasteType: string;
      status: string;
      residentConfirmed: boolean;
    }>;
    recentCompliance: Array<{
      id: number;
      inspectionDate: string;
      wasteType: string;
      status: string;
      violationType: string;
      noticeType: string;
      contested: boolean;
    }>;
  };
  collectorData?: {
    assignedRoutes: Array<{
      id: number;
      name: string;
      routeDate: string;
      wasteType: string;
      status: string;
      estimatedDistanceKm: number;
      purokName: string;
      truckName: string | null;
      totalStops: number;
      doneStops: number;
      progressPct: number;
    }>;
    assignedReports: Array<{
      id: number;
      ticketNumber: string;
      wasteType: string;
      address: string;
      status: string;
      missedDate: string;
    }>;
  };
}

export default function DashboardPage() {
  const { user, lang, tr } = useApp();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("Could not load dashboard metrics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-[#166534]" />
        <span>{tr("loading")}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-800">
        {error || "No dashboard data."}
      </div>
    );
  }

  // RESIDENT DASHBOARD
  if (data.role === "resident" && data.residentData) {
    const { upcomingSchedules, recentReports, recentCompliance } = data.residentData;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-[#166534] to-[#14532d] p-6 text-white shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            {lang === "fil" ? `Magandang araw, ${user?.fullName}!` : `Welcome, ${user?.fullName}`}
          </h1>
          <p className="mt-1 text-green-100 text-sm sm:text-base">
            {user?.purokName ?? "Barangay San Isidro"} • {user?.address}
            {user?.householdCode ? ` (${user.householdCode})` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/app/reports"
              className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              <AlertOctagon className="h-4 w-4" />
              <span>{tr("reportMissed")}</span>
            </Link>
            <Link
              href="/app/schedules"
              className="min-h-[46px] inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/10 px-5 text-sm font-bold text-white hover:bg-white/20"
            >
              <CalendarDays className="h-4 w-4" />
              <span>View Full Calendar</span>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {tr("thisWeekSchedule")} ({user?.purokName})
              </h2>
              <Link href="/app/schedules" className="text-xs font-bold text-[#166534] hover:underline">
                All →
              </Link>
            </div>
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming schedules this week.</p>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {formatDateStr(s.scheduledDate, lang)}
                      </div>
                      <div className="text-xs text-slate-600">
                        {s.startTime} – {s.endTime} {s.truckName ? `• ${s.truckName}` : ""}
                      </div>
                    </div>
                    <WasteBadge wasteType={s.wasteType} lang={lang} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">My Missed Pickup Reports</h2>
                <Link href="/app/reports" className="text-xs font-bold text-[#166534] hover:underline">
                  Manage →
                </Link>
              </div>
              {recentReports.length === 0 ? (
                <p className="text-sm text-slate-500">You have not filed any missed pickup reports.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentReports.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">{r.ticketNumber}</div>
                        <div className="text-xs text-slate-600">
                          Missed on {r.missedDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <WasteBadge wasteType={r.wasteType} lang={lang} size="sm" />
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">My Household Compliance</h2>
                <Link href="/app/compliance" className="text-xs font-bold text-[#166534] hover:underline">
                  View History →
                </Link>
              </div>
              {recentCompliance.length === 0 ? (
                <p className="text-sm text-slate-500">No household inspection records yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentCompliance.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">{c.inspectionDate}</div>
                        <div className="text-xs text-slate-600">
                          {c.violationType || "Properly segregated"}
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COLLECTOR DASHBOARD
  if (data.role === "collector" && data.collectorData) {
    const { assignedRoutes, assignedReports } = data.collectorData;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#166534] p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">Collector Dashboard — {user?.fullName}</h1>
            <p className="text-green-100 text-sm mt-1">
              You see only routes and makeup pickups assigned to you.
            </p>
          </div>
          <Link
            href="/app/collector"
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-6 text-sm font-bold text-slate-950 hover:bg-amber-400"
          >
            <Truck className="h-5 w-5" />
            <span>Open Active Route View</span>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {assignedRoutes.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <WasteBadge wasteType={r.wasteType} lang={lang} size="sm" />
                <StatusBadge status={r.status} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{r.name}</h2>
              <div className="text-xs text-slate-600">
                {r.routeDate} • {r.purokName} • ~{r.estimatedDistanceKm} km (straight-line estimate)
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>
                    Progress: {r.doneStops}/{r.totalStops} stops
                  </span>
                  <span>{r.progressPct}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#166534] transition-all"
                    style={{ width: `${r.progressPct}%` }}
                  />
                </div>
              </div>
              <Link
                href={`/app/collector?routeId=${r.id}`}
                className="min-h-[44px] inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
              >
                <span>Start / Continue Route</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        {assignedReports.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Assigned Missed Pickup Tickets</h2>
            {assignedReports.map((rep) => (
              <div
                key={rep.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">{rep.ticketNumber}</div>
                  <div className="text-xs text-slate-600">{rep.address}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={rep.status} />
                  <Link
                    href="/app/reports"
                    className="min-h-[40px] inline-flex items-center rounded-lg bg-green-50 px-3 text-xs font-bold text-[#166534]"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ADMIN & CAPTAIN / OFFICIAL DASHBOARD
  const kpis = data.kpis!;
  const mapPins: MapPin[] = (data.problemPins ?? []).map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: p.label,
    detail: p.detail,
    color: p.kind === "missed_report" ? "red" : "amber",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {tr("dashboard")} — Barangay San Isidro
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Live operations overview for {formatDateStr(data.today, lang)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kpis.pendingApprovalsCount > 0 && (
            <Link
              href="/app/admin"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900 hover:bg-amber-100"
            >
              <UserCheck className="h-4 w-4" />
              <span>{kpis.pendingApprovalsCount} Pending Approval</span>
            </Link>
          )}
          <Link
            href="/app/admin?tab=exports"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#166534] px-4 text-sm font-bold text-white hover:bg-[#14532d]"
          >
            <span>CSV / PDF Reports</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/app/schedules"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#166534] transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {tr("todaysCollections")}
            </span>
            <CalendarDays className="h-5 w-5 text-[#166534]" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {kpis.todaysCollections}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active schedules today</div>
        </Link>

        <Link
          href="/app/routes"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#166534] transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {tr("routeProgress")}
            </span>
            <Truck className="h-5 w-5 text-[#166534]" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-[#166534]">
            {kpis.routeProgressPct}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {kpis.todayStopsDone} of {kpis.todayStopsTotal} stops updated today
          </div>
        </Link>

        <Link
          href="/app/reports"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#166534] transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {tr("openReports")}
            </span>
            <AlertOctagon className="h-5 w-5 text-red-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {kpis.openReportsCount}
            </span>
            {kpis.overdueReportsCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                <AlertTriangle className="h-3 w-3" />
                {kpis.overdueReportsCount} {tr("overdue")}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">Unresolved missed pickups</div>
        </Link>

        <Link
          href="/app/compliance"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#166534] transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {tr("complianceRate")}
            </span>
            <ClipboardCheck className="h-5 w-5 text-[#166534]" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-[#166534]">
            {kpis.complianceRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {kpis.repeatViolatorsCount} repeat-violator household(s) flagged
          </div>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            RA 9003 Segregation Compliance by Purok (%)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPurok ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="purokCode" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="rate" name="Compliance %" fill="#166534" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Monthly Segregation Compliance Trend (%)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Compliance %"
                  stroke="#166534"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#F59E0B", stroke: "#166534", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Problem Area Map + Live Routes & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Problem Areas Map (Open Missed Pickups & Repeat Violators)
            </h2>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-red-700">
                <span className="h-2.5 w-2.5 rounded-full bg-red-700" /> Open Report
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Repeat Violator
              </span>
            </div>
          </div>
          <LeafletMap pins={mapPins} includeDepot heightClass="h-[340px]" />
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Live Route Progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Today&apos;s Live Routes</h2>
              <Link href="/app/routes" className="text-xs font-bold text-[#166534] hover:underline">
                Manage →
              </Link>
            </div>
            {(data.liveRoutes ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No routes assigned for today yet.</p>
            ) : (
              <div className="space-y-3">
                {(data.liveRoutes ?? []).map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{r.name}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-slate-600">
                      Driver: {r.driverName ?? "Unassigned"} • {r.doneStops}/{r.totalStops} stops ({r.progressPct}%)
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#166534]"
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-[#166534]" />
                <span>Recent Activity</span>
              </h2>
              <Link href="/app/admin?tab=audit" className="text-xs font-bold text-[#166534] hover:underline">
                Audit Log →
              </Link>
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {(data.recentAudit ?? []).slice(0, 6).map((a) => (
                <div key={a.id} className="border-l-2 border-[#166534] pl-3 py-0.5">
                  <div className="text-xs font-semibold text-slate-900">{a.summary}</div>
                  <div className="text-[11px] text-slate-500">
                    {a.actorName} ({a.actorRole}) •{" "}
                    {new Date(a.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
