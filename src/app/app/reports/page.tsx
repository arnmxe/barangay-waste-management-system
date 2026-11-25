"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertOctagon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Loader2,
  X,
  Clock,
  Send,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import { LeafletMap } from "@/components/LeafletMap";
import { PhotoUploader } from "@/components/PhotoUploader";
import { BARANGAY_CENTER } from "@/lib/geo";
import { getTodayDateStr, WasteType } from "@/lib/i18n";

interface ReportItem {
  id: number;
  ticketNumber: string;
  residentId: number;
  residentName: string;
  purokId: number;
  purokName: string;
  missedDate: string;
  wasteType: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  photoUrl: string;
  status: string;
  rejectionReason: string;
  assignedCollectorId: number | null;
  assignedCollectorName: string | null;
  assignedTruckId: number | null;
  truckName: string | null;
  residentConfirmed: boolean;
  createdAt: string;
  isOverdue: boolean;
  hoursOpen: number;
}

interface ReportUpdateItem {
  id: number;
  authorName: string;
  authorRole: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string;
  createdAt: string;
}

export default function MissedReportsPage() {
  const { user, lang, tr, toast, confirm } = useApp();
  const isAdmin = user?.roleCode === "admin";
  const isResident = user?.roleCode === "resident";
  const isCollector = user?.roleCode === "collector";

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [puroks, setPuroks] = useState<Array<{ id: number; name: string }>>([]);
  const [trucks, setTrucks] = useState<Array<{ id: number; name: string }>>([]);
  const [collectors, setCollectors] = useState<Array<{ id: number; fullName: string }>>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [purokFilter, setPurokFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Selected report & timeline
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [timeline, setTimeline] = useState<ReportUpdateItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [assignCollectorId, setAssignCollectorId] = useState("");
  const [assignTruckId, setAssignTruckId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Submit new report modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    missedDate: getTodayDateStr(),
    wasteType: "biodegradable" as WasteType,
    purokId: "",
    address: "",
    lat: BARANGAY_CENTER.lat,
    lng: BARANGAY_CENTER.lng,
    notes: "",
    photoUrl: "",
  });

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (purokFilter !== "all") params.set("purokId", purokFilter);
      const res = await fetch(`/api/reports?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setReports(d.reports ?? []);
      setPuroks(d.puroks ?? []);
      setTrucks(d.trucks ?? []);
      setCollectors(d.collectors ?? []);

      setNewForm((prev) => ({
        ...prev,
        purokId:
          prev.purokId ||
          (user?.purokId
            ? String(user.purokId)
            : d.puroks?.[0]
            ? String(d.puroks[0].id)
            : ""),
        address: prev.address || d.userHousehold?.address || user?.address || "",
        lat: d.userHousehold?.lat ?? prev.lat,
        lng: d.userHousehold?.lng ?? prev.lng,
      }));
    } catch {
      toast("error", "Could not load missed pickup reports.");
    } finally {
      setLoading(false);
    }
  }, [purokFilter, statusFilter, toast, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  async function openDetail(rep: ReportItem) {
    setSelected(rep);
    setAssignCollectorId(rep.assignedCollectorId ? String(rep.assignedCollectorId) : collectors[0] ? String(collectors[0].id) : "");
    setAssignTruckId(rep.assignedTruckId ? String(rep.assignedTruckId) : trucks[0] ? String(trucks[0].id) : "");
    setShowRejectBox(false);
    setRejectReason("");
    setCommentText("");
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/reports/${rep.id}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setTimeline(d.updates ?? []);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newForm,
          purokId: newForm.purokId ? Number(newForm.purokId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to submit report.");
        return;
      }
      setCreateOpen(false);
      setNewForm((prev) => ({ ...prev, notes: "", photoUrl: "" }));
      toast("success", `Ticket ${data.report.ticketNumber} submitted!`);
      await loadReports();
    } catch {
      setFormError("Network error submitting report.");
    } finally {
      setCreating(false);
    }
  }

  async function patchSelected(payload: Record<string, unknown>, successMsg: string) {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/reports/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Update failed.");
        return;
      }
      toast("success", successMsg);
      await loadReports();
      const refreshedRes = await fetch(`/api/reports/${selected.id}`, { cache: "no-store" });
      if (refreshedRes.ok) {
        const d = await refreshedRes.json();
        setSelected((prev) => (prev ? { ...prev, ...d.report } : null));
        setTimeline(d.updates ?? []);
      }
      setCommentText("");
      setShowRejectBox(false);
    } finally {
      setUpdating(false);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 5) {
      toast("error", "Please provide a rejection reason (at least 5 characters).");
      return;
    }
    const ok = await confirm({
      title: "Reject Missed Pickup Report?",
      message: `Reject ticket ${selected?.ticketNumber} with reason: "${rejectReason}"?`,
      confirmLabel: "Confirm Rejection",
      destructive: true,
    });
    if (!ok) return;
    await patchSelected(
      { status: "rejected", rejectionReason: rejectReason.trim() },
      "Report rejected and resident notified."
    );
  }

  const steps = ["submitted", "verified", "assigned", "resolved"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <AlertOctagon className="h-7 w-7 text-[#166534]" />
            <span>{tr("missedReports")}</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {isResident
              ? "Report missed pickups for your household and track resolution step by step."
              : "Verify, assign makeup pickups, track overdue tickets (>48h), and confirm resolutions."}
          </p>
        </div>

        {(isResident || isAdmin) && (
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setCreateOpen(true);
            }}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-sm font-bold text-white hover:bg-[#14532d]"
          >
            <Plus className="h-5 w-5" />
            <span>{tr("reportMissed")}</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "overdue", "submitted", "verified", "assigned", "resolved", "rejected"].map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[42px] rounded-xl px-3.5 text-xs sm:text-sm font-bold capitalize transition ${
                  statusFilter === st
                    ? st === "overdue"
                      ? "bg-red-700 text-white"
                      : "bg-[#166534] text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {st === "overdue" ? "Overdue (>48h)" : st}
              </button>
            )
          )}
        </div>

        {!isResident && (
          <select
            aria-label="Filter reports by Purok"
            value={purokFilter}
            onChange={(e) => setPurokFilter(e.target.value)}
            className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            <option value="all">{tr("allPuroks")}</option>
            {puroks.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          No missed pickup reports match your current filter.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Reports List */}
          <div className="lg:col-span-5 space-y-3">
            {reports.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => openDetail(rep)}
                className={`w-full text-left rounded-2xl border p-4 transition space-y-2 ${
                  selected?.id === rep.id
                    ? "border-[#166534] bg-green-50/40 ring-2 ring-green-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900">
                    {rep.ticketNumber}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {rep.isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[11px] font-bold text-red-800">
                        <AlertTriangle className="h-3 w-3" /> Overdue ({rep.hoursOpen}h)
                      </span>
                    )}
                    <StatusBadge status={rep.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <WasteBadge wasteType={rep.wasteType} lang={lang} size="sm" />
                  <span className="text-xs text-slate-600">Missed: {rep.missedDate}</span>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2">{rep.notes}</p>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{rep.purokName}</span>
                  {rep.residentConfirmed && (
                    <span className="text-green-700 font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Confirmed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected Report Detail & Workflow */}
          <div className="lg:col-span-7">
            {selected ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-extrabold font-mono text-slate-900">
                        {selected.ticketNumber}
                      </h2>
                      <StatusBadge status={selected.status} />
                      {selected.isOverdue && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                          Overdue &gt;48h
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {selected.address} ({selected.purokName}) • Missed {selected.missedDate}
                    </p>
                  </div>
                  <WasteBadge wasteType={selected.wasteType} lang={lang} />
                </div>

                {/* Status Stepper */}
                {selected.status !== "rejected" ? (
                  <div className="grid grid-cols-4 gap-2">
                    {steps.map((step, i) => {
                      const activeIdx = steps.indexOf(selected.status);
                      const reached = i <= activeIdx;
                      return (
                        <div
                          key={step}
                          className={`rounded-xl border p-2 text-center text-xs font-bold capitalize ${
                            reached
                              ? "border-[#166534] bg-green-50 text-[#166534]"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                          }`}
                        >
                          {i + 1}. {step}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                    <strong>Rejected Reason:</strong> {selected.rejectionReason}
                  </div>
                )}

                <div className="space-y-2 text-sm text-slate-800">
                  <div>
                    <strong>Reported by:</strong> {selected.residentName}
                  </div>
                  <div>
                    <strong>Notes:</strong> {selected.notes}
                  </div>
                  {selected.assignedCollectorName && (
                    <div>
                      <strong>Assigned Crew:</strong> {selected.assignedCollectorName}
                      {selected.truckName ? ` (${selected.truckName})` : ""}
                    </div>
                  )}
                </div>

                {selected.photoUrl && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.photoUrl}
                      alt="Missed pickup evidence"
                      className="max-h-56 rounded-xl border border-slate-200 object-cover"
                    />
                  </div>
                )}

                <LeafletMap
                  pins={[
                    {
                      id: selected.id,
                      lat: selected.lat,
                      lng: selected.lng,
                      label: selected.ticketNumber,
                      detail: selected.address,
                      color: selected.status === "resolved" ? "green" : "red",
                    },
                  ]}
                  heightClass="h-[220px]"
                />

                {/* Resident Resolution Confirmation */}
                {isResident &&
                  selected.status === "resolved" &&
                  !selected.residentConfirmed && (
                    <div className="rounded-xl border border-green-300 bg-green-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-sm text-green-950">
                        <strong>Pickup marked Resolved!</strong> Please confirm if the collection crew picked up your waste.
                      </div>
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          patchSelected(
                            { confirmResolution: true },
                            "Thank you! Resolution confirmed."
                          )
                        }
                        className="min-h-[46px] shrink-0 rounded-xl bg-[#166534] px-5 text-sm font-bold text-white hover:bg-[#14532d]"
                      >
                        Confirm Resolved
                      </button>
                    </div>
                  )}

                {/* Collector Action */}
                {isCollector && selected.status === "assigned" && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      patchSelected(
                        { status: "resolved", comment: "Makeup pickup completed by collector." },
                        "Ticket marked as Resolved!"
                      )
                    }
                    className="min-h-[48px] w-full rounded-xl bg-[#166534] text-sm font-bold text-white hover:bg-[#14532d]"
                  >
                    Mark Makeup Pickup as Resolved
                  </button>
                )}

                {/* Admin Workflow Actions */}
                {isAdmin &&
                  selected.status !== "resolved" &&
                  selected.status !== "rejected" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Admin Resolution Controls
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          aria-label="Assign Collector"
                          value={assignCollectorId}
                          onChange={(e) => setAssignCollectorId(e.target.value)}
                          className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">Select Collector</option>
                          {collectors.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.fullName}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Assign Truck"
                          value={assignTruckId}
                          onChange={(e) => setAssignTruckId(e.target.value)}
                          className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">Select Truck</option>
                          {trucks.map((tk) => (
                            <option key={tk.id} value={String(tk.id)}>
                              {tk.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selected.status === "submitted" && (
                          <button
                            type="button"
                            disabled={updating}
                            onClick={() =>
                              patchSelected(
                                { status: "verified", comment: "Verified by Barangay Admin." },
                                "Report verified!"
                              )
                            }
                            className="min-h-[44px] rounded-xl bg-indigo-700 px-4 text-xs font-bold text-white hover:bg-indigo-800"
                          >
                            1. Verify
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            patchSelected(
                              {
                                status: "assigned",
                                assignedCollectorId: assignCollectorId
                                  ? Number(assignCollectorId)
                                  : null,
                                assignedTruckId: assignTruckId
                                  ? Number(assignTruckId)
                                  : null,
                                comment: "Assigned crew for makeup collection.",
                              },
                              "Collector & truck assigned!"
                            )
                          }
                          className="min-h-[44px] rounded-xl bg-purple-700 px-4 text-xs font-bold text-white hover:bg-purple-800"
                        >
                          2. Assign Crew
                        </button>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            patchSelected(
                              {
                                status: "resolved",
                                comment: "Missed pickup resolved and collected.",
                              },
                              "Report marked Resolved!"
                            )
                          }
                          className="min-h-[44px] rounded-xl bg-[#166534] px-4 text-xs font-bold text-white hover:bg-[#14532d]"
                        >
                          3. Mark Resolved
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectBox((v) => !v)}
                          className="min-h-[44px] rounded-xl border border-red-300 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Reject
                        </button>
                      </div>

                      {showRejectBox && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <textarea
                            rows={2}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter mandatory reason for rejecting this report..."
                            className="w-full rounded-xl border border-red-300 bg-white p-2.5 text-sm"
                          />
                          <button
                            type="button"
                            disabled={updating}
                            onClick={handleReject}
                            className="min-h-[44px] rounded-xl bg-red-700 px-4 text-xs font-bold text-white"
                          >
                            Submit Rejection
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {/* Timeline & Comments */}
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-[#166534]" />
                    <span>Status Timeline & Comments</span>
                  </h3>
                  {loadingDetail ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#166534]" />
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {timeline.map((u) => (
                        <div
                          key={u.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              {u.authorName}{" "}
                              <span className="text-slate-500 font-normal">({u.authorRole})</span>
                            </span>
                            <span className="text-slate-500 inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(u.createdAt).toLocaleString("en-PH", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-slate-700">{u.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {user?.roleCode !== "official" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!commentText.trim()) return;
                        patchSelected({ comment: commentText.trim() }, "Comment added!");
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment or update..."
                        className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3.5 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={updating || !commentText.trim()}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" /> Send
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Select a missed pickup ticket on the left to view its timeline, map location, and actions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit Missed Pickup Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-xl font-extrabold text-slate-900">
                {tr("reportMissed")}
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

            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-semibold text-red-800"
                >
                  {formError}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Date of Missed Pickup
                  </label>
                  <input
                    type="date"
                    required
                    value={newForm.missedDate}
                    onChange={(e) => setNewForm({ ...newForm, missedDate: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Waste Type
                  </label>
                  <select
                    value={newForm.wasteType}
                    onChange={(e) =>
                      setNewForm({ ...newForm, wasteType: e.target.value as WasteType })
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

              {isAdmin && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Purok
                  </label>
                  <select
                    value={newForm.purokId}
                    onChange={(e) => setNewForm({ ...newForm, purokId: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    {puroks.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Household / Street Address
                </label>
                <input
                  type="text"
                  required
                  value={newForm.address}
                  onChange={(e) => setNewForm({ ...newForm, address: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Location Pin ({newForm.lat.toFixed(5)}, {newForm.lng.toFixed(5)}) — Click map to adjust
                </label>
                <LeafletMap
                  pins={[
                    {
                      id: "new-pin",
                      lat: newForm.lat,
                      lng: newForm.lng,
                      label: "Missed Pickup Pin",
                      color: "red",
                    },
                  ]}
                  onMapClick={(lat, lng) => setNewForm((prev) => ({ ...prev, lat, lng }))}
                  heightClass="h-[220px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Details / Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  placeholder="Describe where the bins were placed and what time..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <PhotoUploader
                value={newForm.photoUrl}
                onChange={(url) => setNewForm({ ...newForm, photoUrl: url })}
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
                  disabled={creating}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#166534] px-6 text-sm font-bold text-white hover:bg-[#14532d]"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Submit Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
