"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  AlertOctagon,
  Truck,
  CheckCircle2,
  MapPin,
  Megaphone,
  Clock,
  ArrowRight,
  ShieldCheck,
  Leaf,
  Recycle,
  Trash2,
  AlertTriangle,
  Phone,
  Loader2,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import { useApp } from "@/components/AppProviders";
import { BARANGAY_INFO, WASTE_META, WasteType, formatDateStr } from "@/lib/i18n";

interface PublicOverview {
  today: string;
  weekEnd: string;
  puroks: Array<{ id: number; code: string; name: string; zoneLabel: string }>;
  schedules: Array<{
    id: number;
    title: string;
    purokId: number;
    purokName: string;
    wasteType: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    status: string;
    notes: string;
    truckName: string | null;
  }>;
  announcements: Array<{
    id: number;
    title: string;
    titleFil: string;
    body: string;
    bodyFil: string;
    category: string;
    isPinned: boolean;
    createdAt: string;
  }>;
  stats: {
    puroksCount: number;
    householdsCount: number;
    activeTrucksCount: number;
    complianceRate: number;
  };
}

export default function HomePage() {
  const { user, lang, tr } = useApp();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPurok, setSelectedPurok] = useState("all");
  const [selectedWaste, setSelectedWaste] = useState("all");

  useEffect(() => {
    let active = true;
    async function fetchOverview() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedPurok !== "all") params.set("purokId", selectedPurok);
        if (selectedWaste !== "all") params.set("wasteType", selectedWaste);
        const res = await fetch(`/api/public/overview?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch schedule");
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setError("Unable to load barangay schedules right now.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchOverview();
    return () => {
      active = false;
    };
  }, [selectedPurok, selectedWaste]);

  const wasteCards: Array<{
    type: WasteType;
    icon: React.ComponentType<{ className?: string }>;
    accentBorder: string;
  }> = [
    { type: "biodegradable", icon: Leaf, accentBorder: "border-t-4 border-t-green-700" },
    { type: "recyclable", icon: Recycle, accentBorder: "border-t-4 border-t-blue-700" },
    { type: "residual", icon: Trash2, accentBorder: "border-t-4 border-t-slate-600" },
    { type: "special", icon: AlertTriangle, accentBorder: "border-t-4 border-t-red-700" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-[#166534] via-[#14532d] to-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs sm:text-sm font-semibold text-amber-300 backdrop-blur-xs">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  {BARANGAY_INFO.name}, {BARANGAY_INFO.city}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                {tr("heroTitle")}
              </h1>
              <p className="text-base sm:text-lg text-green-100 leading-relaxed max-w-2xl">
                {tr("heroSubtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="#weekly-schedule"
                  className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-6 py-3 text-base font-bold text-slate-950 hover:bg-amber-400 shadow-md transition"
                >
                  <CalendarDays className="h-5 w-5" />
                  <span>{tr("checkSchedule")}</span>
                </a>
                <Link
                  href={user ? "/app/reports" : "/login"}
                  className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/80 bg-white/10 px-6 py-3 text-base font-bold text-white hover:bg-white/20 transition"
                >
                  <AlertOctagon className="h-5 w-5" />
                  <span>{tr("reportMissed")}</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border-4 border-white/20 bg-white shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero-barangay.png"
                  alt="Clean Barangay San Isidro street with 4 color-coded waste segregation bins and eco collection truck"
                  className="w-full h-64 sm:h-80 object-cover"
                />
                <div className="bg-white p-4 text-slate-900 flex items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm font-semibold text-slate-700">
                    {tr("ra9003Banner")}
                  </div>
                  <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    RA 9003
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Barangay Stats Strip */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 -mt-6 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Puroks Covered
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#166534]">
                {data?.stats.puroksCount ?? 5}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registered Households
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
                {data?.stats.householdsCount ?? 50}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active Eco-Trucks
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
                {data?.stats.activeTrucksCount ?? 2}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {tr("complianceRate")}
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#166534]">
                {data?.stats.complianceRate ?? 75}%
              </div>
            </div>
          </div>
        </section>

        {/* This Week's Collection Schedule by Purok */}
        <section id="weekly-schedule" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {tr("thisWeekSchedule")}
              </h2>
              <p className="mt-1 text-sm sm:text-base text-slate-600">
                {lang === "fil"
                  ? "Piliin ang inyong purok para makita kung kailan dadaan ang trak ngayong linggo."
                  : "Pick your purok below to see exact collection dates, times, and waste types."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label htmlFor="public-purok-filter" className="sr-only">
                  {tr("selectPurok")}
                </label>
                <select
                  id="public-purok-filter"
                  value={selectedPurok}
                  onChange={(e) => setSelectedPurok(e.target.value)}
                  className="min-h-[46px] w-full sm:w-56 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  <option value="all">{tr("allPuroks")}</option>
                  {(data?.puroks ?? []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="public-waste-filter" className="sr-only">
                  {tr("allWasteTypes")}
                </label>
                <select
                  id="public-waste-filter"
                  value={selectedWaste}
                  onChange={(e) => setSelectedWaste(e.target.value)}
                  className="min-h-[46px] w-full sm:w-52 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  <option value="all">{tr("allWasteTypes")}</option>
                  <option value="biodegradable">
                    {lang === "fil" ? "Nabubulok (Berde)" : "Biodegradable (Green)"}
                  </option>
                  <option value="recyclable">
                    {lang === "fil" ? "Nareresiklo (Asul)" : "Recyclable (Blue)"}
                  </option>
                  <option value="residual">
                    {lang === "fil" ? "Di-Nabubulok (Abo)" : "Residual (Gray)"}
                  </option>
                  <option value="special">
                    {lang === "fil" ? "Espesyal (Pula)" : "Special / Hazardous (Red)"}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
              <span>{tr("loading")}</span>
            </div>
          ) : !data || data.schedules.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
              {tr("noSchedulesFound")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.schedules.map((sched) => {
                const isToday = sched.scheduledDate === data.today;
                return (
                  <div
                    key={sched.id}
                    className={`rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                      isToday ? "border-[#166534] ring-2 ring-green-100" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <WasteBadge wasteType={sched.wasteType} lang={lang} />
                      <div className="flex items-center gap-1.5">
                        {isToday && (
                          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-slate-950">
                            {lang === "fil" ? "NGAYON" : "TODAY"}
                          </span>
                        )}
                        <StatusBadge status={sched.status} />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{sched.purokName}</h3>
                    <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                      <div className="flex items-center gap-2 font-medium">
                        <CalendarDays className="h-4 w-4 text-[#166534] shrink-0" />
                        <span>{formatDateStr(sched.scheduledDate, lang)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>
                          {sched.startTime} – {sched.endTime}
                        </span>
                      </div>
                      {sched.truckName && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-500 shrink-0" />
                          <span>{sched.truckName}</span>
                        </div>
                      )}
                    </div>
                    {sched.notes && (
                      <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
                        {sched.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* RA 9003 Segregation Guide Preview */}
        <section className="bg-white border-y border-slate-200 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {tr("segregationGuide")} (RA 9003)
                </h2>
                <p className="mt-1 text-slate-600">
                  {lang === "fil"
                    ? "Paghiwalayin ang basura sa apat na malinaw na kulay at label bago ilabas."
                    : "Sort household waste into 4 clearly labeled bins before setting it outside."}
                </p>
              </div>
              <Link
                href="/segregation-guide"
                className="min-h-[44px] inline-flex items-center gap-2 text-sm font-bold text-[#166534] hover:underline"
              >
                <span>{lang === "fil" ? "Buong Gabay sa Pagbubukod" : "Read Full Guide"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {wasteCards.map(({ type, accentBorder }) => {
                const meta = WASTE_META[type];
                return (
                  <div
                    key={type}
                    className={`rounded-2xl border border-slate-200 bg-slate-50 p-5 ${accentBorder}`}
                  >
                    <WasteBadge wasteType={type} lang={lang} />
                    <div className="mt-3 text-sm font-bold text-slate-900">
                      {lang === "fil" ? meta.binColorFil : meta.binColorEn}
                    </div>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {lang === "fil" ? meta.examplesFil : meta.examplesEn}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-600 bg-white rounded-lg p-2.5 border border-slate-200">
                      <CheckCircle2 className="inline h-3.5 w-3.5 text-[#166534] mr-1 -mt-0.5" />
                      {lang === "fil" ? meta.tipsFil : meta.tipsEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Announcements & Barangay Contact */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <Megaphone className="h-6 w-6 text-[#166534]" />
                <span>{tr("announcements")}</span>
              </h2>
              <Link
                href="/announcements"
                className="text-sm font-bold text-[#166534] hover:underline"
              >
                View All →
              </Link>
            </div>

            <div className="space-y-4">
              {(data?.announcements ?? []).slice(0, 3).map((ann) => (
                <article
                  key={ann.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {ann.isPinned && (
                      <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                        Pinned
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-600">
                      {ann.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {lang === "fil" && ann.titleFil ? ann.titleFil : ann.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                    {lang === "fil" && ann.bodyFil ? ann.bodyFil : ann.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-slate-900">
              {tr("contact")}
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">Barangay Hall & MRF</div>
                  <div className="text-sm text-slate-600">{BARANGAY_INFO.address}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">Eco-Collection Hotline</div>
                  <div className="text-sm text-slate-600">{BARANGAY_INFO.hotline}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">Office Hours</div>
                  <div className="text-sm text-slate-600">{BARANGAY_INFO.officeHours}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <Link
                  href="/register"
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#166534] px-4 text-sm font-bold text-white hover:bg-[#14532d]"
                >
                  {tr("register")}
                </Link>
                <Link
                  href="/login"
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 hover:bg-slate-100"
                >
                  {tr("login")} (Demo Roles Available)
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
