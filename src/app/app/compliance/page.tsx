"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  X,
  Send,
  Flag,
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
import { PhotoUploader } from "@/components/PhotoUploader";
import { getTodayDateStr, WasteType } from "@/lib/i18n";

interface ComplianceItem {
  id: number;
  householdId: number;
  householdCode: string;
  headName: string;
  address: string;
  isRepeatViolator: boolean;
  purokId: number;
  purokName: string;
  inspectorName: string | null;
  inspectionDate: string;
  wasteType: string;
  status: string;
  violationType: string;
  notes: string;
  photoUrl: string;
  noticeType: string;
  contested: boolean;
  contestReason: string;
  contestStatus: string;
  contestResponse: string;
}

interface HouseholdOption {
  id: number;
  householdCode: string;
  headName: string;
  address: string;
  purokId: number;
  purokName: string;
  isRepeatViolator: boolean;
}

const VIOLATION_PRESETS = [
  "Mixed biodegradable & residual waste",
  "Unclean/unrinsed recyclables",
  "Unlabeled hazardous/special items",
  "Improper open container / loose trash",
  "Missed designated bin color",
];

export default function CompliancePage() {
  const { user, lang, tr, toast } = useApp();
  const isAdmin = user?.roleCode === "admin";
  const isCollector = user?.roleCode === "collector";
  const isResident = user?.roleCode === "resident";
  const canRecord = isAdmin || isCollector;

  const [records, setRecords] = useState<ComplianceItem[]>([]);
  const [byPurok, setByPurok] = useState<Array<{ purokName: string; rate: number }>>([]);
  const [byMonth, setByMonth] = useState<Array<{ month: string; rate: number }>>([]);
  const [repeatViolators, setRepeatViolators] = useState<HouseholdOption[]>([]);
  const [puroks, setPuroks] = useState<Array<{ id: number; name: string }>>([]);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);
  const [purokFilter, setPurokFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [householdFilter, setHouseholdFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Record Inspection Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    householdId: "",
    inspectionDate: getTodayDateStr(),
    wasteType: "biodegradable" as WasteType,
    status: "compliant" as "compliant" | "partially_compliant" | "non_compliant",
    violationType: VIOLATION_PRESETS[0],
    notes: "",
    photoUrl: "",
    noticeType: "education" as "none" | "education" | "warning",
  });

  // Resident Contest Modal
  const [contestTarget, setContestTarget] = useState<ComplianceItem | null>(null);
  const [contestReason, setContestReason] = useState("");

  // Admin Resolve Contest Modal
  const [reviewTarget, setReviewTarget] = useState<ComplianceItem | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"upheld" | "dismissed">("upheld");
  const [reviewResponse, setReviewResponse] = useState("");

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (purokFilter !== "all") params.set("purokId", purokFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (householdFilter !== "all") params.set("householdId", householdFilter);
      const res = await fetch(`/api/compliance?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setRecords(d.records ?? []);
      setByPurok(d.byPurok ?? []);
      setByMonth(d.byMonth ?? []);
      setRepeatViolators(d.repeatViolators ?? []);
      setPuroks(d.puroks ?? []);
      setHouseholds(d.households ?? []);
      if (!form.householdId && d.households?.length > 0) {
        setForm((prev) => ({ ...prev, householdId: String(d.households[0].id) }));
      }
    } catch {
      toast("error", "Could not load compliance data.");
    } finally {
      setLoading(false);
    }
  }, [form.householdId, householdFilter, purokFilter, statusFilter, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCompliance();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purokFilter, statusFilter, householdFilter]);

  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: Number(form.householdId),
          inspectionDate: form.inspectionDate,
          wasteType: form.wasteType,
          status: form.status,
          violationType: form.status === "compliant" ? "" : form.violationType,
          notes: form.notes,
          photoUrl: form.photoUrl,
          noticeType: form.status === "compliant" ? "none" : form.noticeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Failed to save inspection.");
        return;
      }
      setCreateOpen(false);
      setForm((prev) => ({ ...prev, notes: "", photoUrl: "" }));
      toast(
        "success",
        data.isRepeatViolator
          ? "Inspection saved! Household flagged as Repeat Violator."
          : "Inspection recorded and charts updated!"
      );
      await loadCompliance();
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNotice(recId: number, noticeType: "education" | "warning") {
    const res = await fetch(`/api/compliance/${recId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_notice", noticeType }),
    });
    if (res.ok) {
      toast(
        "success",
        `${noticeType === "warning" ? "Warning" : "Education"} notice sent to household (no fine imposed).`
      );
      await loadCompliance();
    } else {
      toast("error", "Failed to send notice.");
    }
  }

  async function handleContestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contestTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/${contestTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "contest", contestReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Could not submit contest.");
        return;
      }
      setContestTarget(null);
      setContestReason("");
      toast("success", "Your contest explanation has been sent to Barangay Admin for review.");
      await loadCompliance();
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewContest(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/${reviewTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_contest",
          contestStatus: reviewDecision,
          contestResponse: reviewResponse,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Could not resolve contest.");
        return;
      }
      setReviewTarget(null);
      setReviewResponse("");
      toast("success", `Contest marked as ${reviewDecision}.`);
      await loadCompliance();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ClipboardCheck className="h-7 w-7 text-[#166534]" />
            <span>{tr("compliance")} (RA 9003)</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {isResident
              ? "View your own household's segregation inspection history and contest any record if needed."
              : "Monitor household segregation compliance, issue education or warning notices, and track barangay trends."}
          </p>
        </div>

        {canRecord && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-sm font-bold text-white hover:bg-[#14532d]"
          >
            <Plus className="h-5 w-5" />
            <span>Record Inspection</span>
          </button>
        )}
      </div>

      {/* Strict No-Auto-Fine Policy Banner */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3 text-sm text-green-950">
        <ShieldCheck className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />
        <span>
          <strong>RA 9003 Fair Compliance Policy:</strong> {tr("noFinePolicy")}
        </span>
      </div>

      {/* Trend Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Compliance Rate by Purok (%)
          </h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPurok}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="purokName"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.split("–")[0].trim()}
                />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="rate" name="Compliant %" fill="#166534" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Monthly Compliance Trend (%)
          </h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Compliant %"
                  stroke="#166534"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#F59E0B", stroke: "#166534", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Repeat Violator Alert Box (Hidden from Residents for RA 10173 privacy!) */}
      {!isResident && repeatViolators.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              <span>
                Flagged Repeat Violator Households ({repeatViolators.length}) — Priority for Education Visits
              </span>
            </h2>
            {householdFilter !== "all" && (
              <button
                type="button"
                onClick={() => setHouseholdFilter("all")}
                className="text-xs font-bold text-[#166534] underline"
              >
                Clear Household Filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {repeatViolators.map((hh) => (
              <button
                key={hh.id}
                type="button"
                onClick={() => setHouseholdFilter(String(hh.id))}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  householdFilter === String(hh.id)
                    ? "border-[#166534] bg-[#166534] text-white"
                    : "border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                }`}
              >
                {hh.householdCode} • {hh.headName} ({hh.purokName.split("–")[0].trim()})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "compliant", "partially_compliant", "non_compliant", "contested"].map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[42px] rounded-xl px-3.5 text-xs sm:text-sm font-bold capitalize ${
                  statusFilter === st
                    ? "bg-[#166534] text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            )
          )}
        </div>

        {!isResident && (
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by Purok"
              value={purokFilter}
              onChange={(e) => setPurokFilter(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
            >
              <option value="all">{tr("allPuroks")}</option>
              {puroks.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by Household History"
              value={householdFilter}
              onChange={(e) => setHouseholdFilter(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold max-w-[220px]"
            >
              <option value="all">All Households</option>
              {households.map((h) => (
                <option key={h.id} value={String(h.id)}>
                  {h.householdCode} – {h.headName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex justify-center py-12 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          No segregation compliance records found.
        </div>
      ) : (
        <div className="space-y-3">
          {records.slice(0, 40).map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-slate-900">
                      {rec.householdCode}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{rec.headName}</span>
                    <StatusBadge status={rec.status} />
                    <WasteBadge wasteType={rec.wasteType} lang={lang} size="sm" />
                    {rec.isRepeatViolator && !isResident && (
                      <span className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[11px] font-bold text-red-800">
                        Repeat Violator
                      </span>
                    )}
                    {rec.noticeType !== "none" && (
                      <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900 capitalize">
                        {rec.noticeType} Notice Sent
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    {rec.inspectionDate} • {rec.purokName} • {rec.address}
                    {rec.inspectorName ? ` • Inspector: ${rec.inspectorName}` : ""}
                  </div>
                  {rec.violationType && (
                    <div className="text-sm font-semibold text-red-800">
                      Issue: {rec.violationType}
                    </div>
                  )}
                  {rec.notes && <p className="text-xs text-slate-600">{rec.notes}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {rec.photoUrl && (
                    <a
                      href={rec.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#166534] underline"
                    >
                      Photo
                    </a>
                  )}

                  {isResident && rec.status !== "compliant" && !rec.contested && (
                    <button
                      type="button"
                      onClick={() => {
                        setContestTarget(rec);
                        setContestReason("");
                      }}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 px-3.5 text-xs font-bold text-amber-950 hover:bg-amber-100"
                    >
                      <Flag className="h-3.5 w-3.5" /> Contest Record
                    </button>
                  )}

                  {isAdmin && rec.status !== "compliant" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendNotice(rec.id, "education")}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-green-300 bg-green-50 px-3 text-xs font-bold text-green-900 hover:bg-green-100"
                      >
                        <Send className="h-3.5 w-3.5" /> Education Notice
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendNotice(rec.id, "warning")}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-950 hover:bg-amber-100"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Warning Notice
                      </button>
                    </>
                  )}
                </div>
              </div>

              {rec.contested && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-indigo-950">
                      Resident Contest ({rec.contestStatus.toUpperCase()})
                    </span>
                    {isAdmin && rec.contestStatus === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget(rec);
                          setReviewDecision("upheld");
                          setReviewResponse("");
                        }}
                        className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-800"
                      >
                        Review Contest
                      </button>
                    )}
                  </div>
                  <p className="text-indigo-900">
                    <strong>Resident Explanation:</strong> {rec.contestReason}
                  </p>
                  {rec.contestResponse && (
                    <p className="text-slate-800">
                      <strong>Barangay Decision:</strong> {rec.contestResponse}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record Inspection Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-xl font-extrabold text-slate-900">
                Record Household Segregation Inspection
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Household
                </label>
                <select
                  required
                  value={form.householdId}
                  onChange={(e) => setForm({ ...form, householdId: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  {households.map((h) => (
                    <option key={h.id} value={String(h.id)}>
                      {h.householdCode} – {h.headName} ({h.purokName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Inspection Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.inspectionDate}
                    onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Waste Type Checked
                  </label>
                  <select
                    value={form.wasteType}
                    onChange={(e) =>
                      setForm({ ...form, wasteType: e.target.value as WasteType })
                    }
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="biodegradable">Biodegradable</option>
                    <option value="recyclable">Recyclable</option>
                    <option value="residual">Residual</option>
                    <option value="special">Special / Hazardous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Compliance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["compliant", "Compliant"],
                      ["partially_compliant", "Partial"],
                      ["non_compliant", "Non-compliant"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm({ ...form, status: val })}
                      className={`min-h-[46px] rounded-xl border text-xs font-bold ${
                        form.status === val
                          ? val === "compliant"
                            ? "border-green-700 bg-green-700 text-white"
                            : val === "partially_compliant"
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-red-700 bg-red-700 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {form.status !== "compliant" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Violation Type
                    </label>
                    <select
                      value={form.violationType}
                      onChange={(e) => setForm({ ...form, violationType: e.target.value })}
                      className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    >
                      {VIOLATION_PRESETS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Notice to Issue (No Auto-Fines)
                    </label>
                    <select
                      value={form.noticeType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          noticeType: e.target.value as "none" | "education" | "warning",
                        })
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="education">Friendly Education Notice</option>
                      <option value="warning">Formal Written Warning</option>
                      <option value="none">No notice yet</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Inspector Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <PhotoUploader
                value={form.photoUrl}
                onChange={(url) => setForm({ ...form, photoUrl: url })}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] rounded-xl bg-[#166534] px-6 text-sm font-bold text-white hover:bg-[#14532d]"
                >
                  {saving ? "Saving..." : "Save Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resident Contest Modal */}
      {contestTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <form
            onSubmit={handleContestSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-extrabold text-slate-900">
              Contest Segregation Record
            </h2>
            <p className="text-sm text-slate-600">
              Explain why you believe the inspection on{" "}
              <strong>{contestTarget.inspectionDate}</strong> ({contestTarget.violationType}) should be reviewed.
            </p>
            <textarea
              rows={4}
              required
              minLength={8}
              value={contestReason}
              onChange={(e) => setContestReason(e.target.value)}
              placeholder="Write your explanation clearly..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContestTarget(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-xl bg-[#166534] px-5 text-sm font-bold text-white"
              >
                Submit Contest
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Review Contest Modal */}
      {reviewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <form
            onSubmit={handleReviewContest}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-extrabold text-slate-900">
              Review Household Contest
            </h2>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
              <strong>{reviewTarget.householdCode}:</strong> {reviewTarget.contestReason}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReviewDecision("upheld")}
                className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                  reviewDecision === "upheld"
                    ? "bg-[#166534] text-white border-[#166534]"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                Uphold (Mark Compliant)
              </button>
              <button
                type="button"
                onClick={() => setReviewDecision("dismissed")}
                className={`min-h-[44px] rounded-xl border text-xs font-bold ${
                  reviewDecision === "dismissed"
                    ? "bg-red-700 text-white border-red-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                Dismiss Contest
              </button>
            </div>
            <textarea
              rows={3}
              required
              minLength={4}
              value={reviewResponse}
              onChange={(e) => setReviewResponse(e.target.value)}
              placeholder="Write barangay decision response to the resident..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-xl bg-[#166534] px-5 text-sm font-bold text-white"
              >
                Save Decision
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
