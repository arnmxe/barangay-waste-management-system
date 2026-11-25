"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Truck,
  User,
  Edit,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import {
  addDaysToDateStr,
  formatDateStr,
  getTodayDateStr,
  WASTE_META,
  WasteType,
} from "@/lib/i18n";

interface ScheduleItem {
  id: number;
  title: string;
  purokId: number;
  purokName: string;
  purokCode: string;
  wasteType: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  truckId: number | null;
  truckName: string | null;
  driverId: number | null;
  driverName: string | null;
  crewNames: string;
  recurrence: string;
  status: string;
  notes: string;
}

interface RefOption {
  id: number;
  name?: string;
  fullName?: string;
  code?: string;
  crewNames?: string;
  assignedDriverId?: number | null;
}

export default function SchedulesPage() {
  const { user, lang, tr, toast, confirm } = useApp();
  const isAdmin = user?.roleCode === "admin";

  const [viewMode, setViewMode] = useState<"week" | "month" | "list">("week");
  const [anchorDate, setAnchorDate] = useState(getTodayDateStr());
  const [purokFilter, setPurokFilter] = useState("all");
  const [wasteFilter, setWasteFilter] = useState("all");

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [puroks, setPuroks] = useState<RefOption[]>([]);
  const [trucks, setTrucks] = useState<RefOption[]>([]);
  const [collectors, setCollectors] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    purokId: "",
    wasteType: "biodegradable" as WasteType,
    scheduledDate: getTodayDateStr(),
    startTime: "06:00",
    endTime: "08:00",
    truckId: "",
    driverId: "",
    crewNames: "",
    recurrence: "none" as "none" | "weekly" | "biweekly",
    repeatCount: 4,
    status: "scheduled",
    notes: "",
  });

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (purokFilter !== "all") params.set("purokId", purokFilter);
      if (wasteFilter !== "all") params.set("wasteType", wasteFilter);
      const res = await fetch(`/api/schedules?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setSchedules(d.schedules ?? []);
      setPuroks(d.puroks ?? []);
      setTrucks(d.trucks ?? []);
      setCollectors(d.collectors ?? []);
    } catch {
      setError("Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, [purokFilter, wasteFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSchedules();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSchedules]);

  function openCreateModal() {
    setEditing(null);
    setFormError("");
    const firstPurok = puroks[0];
    const firstTruck = trucks[0];
    const firstCol = collectors[0];
    setForm({
      title: `Biodegradable Collection – ${firstPurok?.name ?? "Purok 1"}`,
      purokId: firstPurok ? String(firstPurok.id) : "",
      wasteType: "biodegradable",
      scheduledDate: getTodayDateStr(),
      startTime: "09:00",
      endTime: "11:00",
      truckId: firstTruck ? String(firstTruck.id) : "",
      driverId: firstCol ? String(firstCol.id) : "",
      crewNames: firstTruck?.crewNames ?? "",
      recurrence: "none",
      repeatCount: 4,
      status: "scheduled",
      notes: "Please set out segregated bins 15 minutes before pickup.",
    });
    setModalOpen(true);
  }

  function openEditModal(item: ScheduleItem) {
    setEditing(item);
    setFormError("");
    setForm({
      title: item.title,
      purokId: String(item.purokId),
      wasteType: item.wasteType as WasteType,
      scheduledDate: item.scheduledDate,
      startTime: item.startTime,
      endTime: item.endTime,
      truckId: item.truckId ? String(item.truckId) : "",
      driverId: item.driverId ? String(item.driverId) : "",
      crewNames: item.crewNames,
      recurrence: (item.recurrence as "none" | "weekly" | "biweekly") || "none",
      repeatCount: 1,
      status: item.status,
      notes: item.notes,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        purokId: Number(form.purokId),
        wasteType: form.wasteType,
        scheduledDate: form.scheduledDate,
        startTime: form.startTime,
        endTime: form.endTime,
        truckId: form.truckId ? Number(form.truckId) : null,
        driverId: form.driverId ? Number(form.driverId) : null,
        crewNames: form.crewNames,
        recurrence: form.recurrence,
        repeatCount: Number(form.repeatCount),
        status: form.status,
        notes: form.notes,
      };

      const res = await fetch(
        editing ? `/api/schedules/${editing.id}` : "/api/schedules",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Could not save schedule.");
        return;
      }
      setModalOpen(false);
      toast(
        "success",
        editing
          ? "Schedule updated and notifications sent."
          : `Created ${data.count ?? 1} schedule(s) successfully!`
      );
      await loadSchedules();
    } catch {
      setFormError("Network error while saving schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSchedule(item: ScheduleItem) {
    const ok = await confirm({
      title: "Cancel Collection Schedule?",
      message: `Are you sure you want to cancel "${item.title}" on ${item.scheduledDate}? Residents in ${item.purokName} will receive a cancellation notification.`,
      confirmLabel: "Yes, Cancel Schedule",
      destructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/schedules/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) {
      toast("success", "Schedule cancelled and residents notified.");
      await loadSchedules();
    } else {
      toast("error", "Could not cancel schedule.");
    }
  }

  async function handleMarkDelayed(item: ScheduleItem) {
    const ok = await confirm({
      title: "Mark Collection as Delayed?",
      message: `Mark "${item.title}" on ${item.scheduledDate} as Delayed and alert residents in ${item.purokName}?`,
      confirmLabel: "Mark Delayed",
    });
    if (!ok) return;

    const res = await fetch(`/api/schedules/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "delayed",
        notes: `${item.notes} [Delay advisory sent by Barangay Admin]`.trim(),
      }),
    });
    if (res.ok) {
      toast("success", "Schedule marked delayed and alert sent.");
      await loadSchedules();
    } else {
      toast("error", "Failed to update schedule.");
    }
  }

  // Week days starting from anchorDate
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(anchorDate, i));
  }, [anchorDate]);

  // Month calendar cells
  const monthGrid = useMemo(() => {
    const [y, m] = anchorDate.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ dateStr: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        dayNum: d,
      });
    }
    return {
      monthLabel: first.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
      cells,
    };
  }, [anchorDate]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const s of schedules) {
      const list = map.get(s.scheduledDate) ?? [];
      list.push(s);
      map.set(s.scheduledDate, list);
    }
    return map;
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <CalendarDays className="h-7 w-7 text-[#166534]" />
            <span>{tr("schedules")}</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Month, Week, and List collection schedules with automatic truck & driver double-booking checks.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-sm font-bold text-white hover:bg-[#14532d] shadow-xs"
          >
            <Plus className="h-5 w-5" />
            <span>New Schedule</span>
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["week", "month", "list"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-bold capitalize transition ${
                viewMode === m
                  ? "bg-[#166534] text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {m}
            </button>
          ))}

          {viewMode !== "list" && (
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() =>
                  setAnchorDate(addDaysToDateStr(anchorDate, viewMode === "week" ? -7 : -30))
                }
                aria-label="Previous period"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate(getTodayDateStr())}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setAnchorDate(addDaysToDateStr(anchorDate, viewMode === "week" ? 7 : 30))
                }
                aria-label="Next period"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            aria-label="Filter by Purok"
            value={purokFilter}
            onChange={(e) => setPurokFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            <option value="all">{tr("allPuroks")}</option>
            {puroks.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by Waste Type"
            value={wasteFilter}
            onChange={(e) => setWasteFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            <option value="all">{tr("allWasteTypes")}</option>
            <option value="biodegradable">Biodegradable</option>
            <option value="recyclable">Recyclable</option>
            <option value="residual">Residual</option>
            <option value="special">Special / Hazardous</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : viewMode === "week" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {weekDates.map((d) => {
            const items = schedulesByDate.get(d) ?? [];
            const isToday = d === getTodayDateStr();
            return (
              <div
                key={d}
                className={`rounded-2xl border bg-white p-3.5 space-y-2.5 ${
                  isToday ? "border-[#166534] ring-2 ring-green-100" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="text-xs font-bold text-slate-900">
                    {formatDateStr(d, lang)}
                  </div>
                  {isToday && (
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                      TODAY
                    </span>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No pickups</p>
                ) : (
                  items.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-1.5"
                    >
                      <WasteBadge wasteType={s.wasteType} lang={lang} size="sm" />
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {s.purokName}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {s.startTime}–{s.endTime}
                      </div>
                      <StatusBadge status={s.status} />
                      {isAdmin && s.status !== "cancelled" && (
                        <div className="flex gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="flex-1 rounded-lg border border-slate-300 bg-white py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelSchedule(s)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "month" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 overflow-x-auto">
          <h2 className="text-lg font-bold text-slate-900 mb-3">{monthGrid.monthLabel}</h2>
          <div className="grid grid-cols-7 gap-1 min-w-[680px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
              <div
                key={wd}
                className="py-2 text-center text-xs font-bold uppercase text-slate-500"
              >
                {wd}
              </div>
            ))}
            {monthGrid.cells.map((cell, idx) => {
              const dayItems = cell.dateStr ? schedulesByDate.get(cell.dateStr) ?? [] : [];
              const isToday = cell.dateStr === getTodayDateStr();
              return (
                <div
                  key={idx}
                  className={`min-h-[104px] rounded-xl border p-2 ${
                    cell.dateStr
                      ? isToday
                        ? "border-[#166534] bg-green-50/40"
                        : "border-slate-200 bg-white"
                      : "border-transparent bg-slate-50/50"
                  }`}
                >
                  {cell.dayNum && (
                    <>
                      <div className="text-xs font-bold text-slate-700 mb-1">
                        {cell.dayNum}
                      </div>
                      <div className="space-y-1">
                        {dayItems.slice(0, 3).map((s) => {
                          const meta =
                            WASTE_META[s.wasteType as WasteType] ?? WASTE_META.residual;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => (isAdmin ? openEditModal(s) : undefined)}
                              className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText} ${
                                s.status === "cancelled" ? "line-through opacity-60" : ""
                              }`}
                            >
                              {s.startTime} {s.purokCode}
                            </button>
                          );
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] font-semibold text-slate-500">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              {tr("noSchedulesFound")}
            </div>
          ) : (
            schedules.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <WasteBadge wasteType={s.wasteType} lang={lang} size="sm" />
                    <StatusBadge status={s.status} />
                    {s.recurrence !== "none" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 capitalize">
                        Repeats {s.recurrence}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <CalendarDays className="h-3.5 w-3.5 text-[#166534]" />
                      {formatDateStr(s.scheduledDate, lang)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {s.startTime} – {s.endTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" />
                      {s.truckName ?? "No truck"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {s.driverName ?? "No driver"}
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(s)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </button>
                    {s.status !== "delayed" && s.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => handleMarkDelayed(s)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                      >
                        <AlertTriangle className="h-4 w-4" /> Delay
                      </button>
                    )}
                    {s.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => handleCancelSchedule(s)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Admin Create / Edit Schedule Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-xl font-extrabold text-slate-900">
                {editing ? "Edit Collection Schedule" : "Create Collection Schedule"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-semibold text-red-800 flex items-start gap-2"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Schedule Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Purok
                  </label>
                  <select
                    required
                    value={form.purokId}
                    onChange={(e) => setForm({ ...form, purokId: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    {puroks.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Waste Type
                  </label>
                  <select
                    value={form.wasteType}
                    onChange={(e) =>
                      setForm({ ...form, wasteType: e.target.value as WasteType })
                    }
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="biodegradable">Biodegradable (Green)</option>
                    <option value="recyclable">Recyclable (Blue)</option>
                    <option value="residual">Residual (Gray)</option>
                    <option value="special">Special / Hazardous (Red)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Assigned Truck
                  </label>
                  <select
                    value={form.truckId}
                    onChange={(e) => {
                      const tObj = trucks.find((x) => String(x.id) === e.target.value);
                      setForm({
                        ...form,
                        truckId: e.target.value,
                        driverId: tObj?.assignedDriverId
                          ? String(tObj.assignedDriverId)
                          : form.driverId,
                        crewNames: tObj?.crewNames ?? form.crewNames,
                      });
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">— Unassigned —</option>
                    {trucks.map((tk) => (
                      <option key={tk.id} value={String(tk.id)}>
                        {tk.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Assigned Driver / Collector
                  </label>
                  <select
                    value={form.driverId}
                    onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">— Unassigned —</option>
                    {collectors.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Crew Names
                </label>
                <input
                  type="text"
                  value={form.crewNames}
                  onChange={(e) => setForm({ ...form, crewNames: e.target.value })}
                  placeholder="Driver and helpers"
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              {!editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Repeat Schedule
                    </label>
                    <select
                      value={form.recurrence}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recurrence: e.target.value as "none" | "weekly" | "biweekly",
                        })
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="none">One-time only</option>
                      <option value="weekly">Repeat Weekly</option>
                      <option value="biweekly">Repeat Every 2 Weeks</option>
                    </select>
                  </div>
                  {form.recurrence !== "none" && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Occurrences (1–8)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={8}
                        value={form.repeatCount}
                        onChange={(e) =>
                          setForm({ ...form, repeatCount: Number(e.target.value) })
                        }
                        className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes / Resident Instructions
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700"
                >
                  {tr("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#166534] px-6 text-sm font-bold text-white hover:bg-[#14532d] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{tr("save")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
