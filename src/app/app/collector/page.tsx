"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Truck,
  CheckCircle2,
  SkipForward,
  Ban,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { LeafletMap, MapPin } from "@/components/LeafletMap";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import { PhotoUploader } from "@/components/PhotoUploader";

interface StopItem {
  id: number;
  routeId: number;
  stopOrder: number;
  label: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  reason: string;
  photoUrl: string;
}

interface CollectorRoute {
  id: number;
  name: string;
  purokName: string;
  wasteType: string;
  routeDate: string;
  truckName: string | null;
  driverName: string | null;
  status: string;
  estimatedDistanceKm: number;
  stops: StopItem[];
  progress: {
    total: number;
    done: number;
    progressPct: number;
  };
}

interface QueuedOfflineUpdate {
  queueId: string;
  routeId: number;
  stopId: number;
  stopLabel: string;
  status: "collected" | "skipped" | "blocked";
  reason: string;
  photoUrl: string;
  clientUpdatedAt: string;
}

const OFFLINE_QUEUE_KEY = "brgy_eco_collector_offline_queue";

function makeQueueId(stopId: number): string {
  return `q-${new Date().getTime()}-${stopId}`;
}

const QUICK_REASONS = [
  "No bin placed outside gate",
  "Unsegregated / mixed waste (advised resident)",
  "Alley blocked by parked vehicle",
  "Road under construction / flooded",
];

export default function CollectorFieldPage() {
  const { lang, tr, toast } = useApp();
  const [routesList, setRoutesList] = useState<CollectorRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [browserOnline, setBrowserOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineUpdate[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Action modal for Skipped / Blocked (or optional photo on Collected)
  const [actionModal, setActionModal] = useState<{
    routeId: number;
    stop: StopItem;
    status: "collected" | "skipped" | "blocked";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectivelyOnline = browserOnline && !simulateOffline;

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routes", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setRoutesList(d.routes ?? []);
      if (d.routes?.length > 0) {
        setSelectedRouteId((prev) =>
          prev && d.routes.some((r: CollectorRoute) => r.id === prev)
            ? prev
            : d.routes[0].id
        );
      }
    } catch {
      // keep cached view if offline
    } finally {
      setLoading(false);
    }
  }, []);

  const syncOfflineQueue = useCallback(
    async (queueToSync?: QueuedOfflineUpdate[]) => {
      const items = queueToSync ?? offlineQueue;
      if (items.length === 0 || !effectivelyOnline) return;
      setSyncing(true);
      try {
        const res = await fetch("/api/routes/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: items }),
        });
        if (res.ok) {
          const data = await res.json();
          const syncedSet = new Set<string>(data.syncedQueueIds ?? []);
          const remaining = items.filter((q) => !syncedSet.has(q.queueId));
          setOfflineQueue(remaining);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
          toast("success", `Synced ${data.syncedCount} queued offline stop update(s)!`);
          await loadRoutes();
        }
      } catch {
        toast("error", "Sync failed. Updates remain safely queued offline.");
      } finally {
        setSyncing(false);
      }
    },
    [effectivelyOnline, loadRoutes, offlineQueue, toast]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBrowserOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
      try {
        const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (saved) setOfflineQueue(JSON.parse(saved));
      } catch {
        // ignore
      }
      void loadRoutes();
    }, 0);

    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadRoutes]);

  // Auto-sync whenever connectivity returns and queue has items
  useEffect(() => {
    if (!effectivelyOnline || offlineQueue.length === 0 || syncing) return;
    const timer = window.setTimeout(() => {
      void syncOfflineQueue(offlineQueue);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivelyOnline]);

  function applyLocalStopOptimistic(
    routeId: number,
    stopId: number,
    status: string,
    stopReason: string,
    stopPhoto: string
  ) {
    setRoutesList((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        const nextStops = r.stops.map((s) =>
          s.id === stopId
            ? { ...s, status, reason: stopReason, photoUrl: stopPhoto || s.photoUrl }
            : s
        );
        const done = nextStops.filter((s) => s.status !== "pending").length;
        return {
          ...r,
          stops: nextStops,
          status: done === nextStops.length ? "completed" : "in_progress",
          progress: {
            total: nextStops.length,
            done,
            progressPct:
              nextStops.length > 0 ? Math.round((done / nextStops.length) * 100) : 0,
          },
        };
      })
    );
  }

  async function submitStopStatus(
    routeId: number,
    stop: StopItem,
    status: "collected" | "skipped" | "blocked",
    stopReason: string,
    stopPhoto: string
  ) {
    if ((status === "skipped" || status === "blocked") && stopReason.trim().length < 3) {
      toast("error", "Please enter a brief reason for Skipped or Blocked stops.");
      return;
    }

    const clientUpdatedAt = new Date().toISOString();

    if (!effectivelyOnline) {
      const entry: QueuedOfflineUpdate = {
        queueId: makeQueueId(stop.id),
        routeId,
        stopId: stop.id,
        stopLabel: stop.label,
        status,
        reason: stopReason.trim(),
        photoUrl: stopPhoto,
        clientUpdatedAt,
      };
      const updatedQueue = [
        ...offlineQueue.filter((q) => q.stopId !== stop.id),
        entry,
      ];
      setOfflineQueue(updatedQueue);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
      applyLocalStopOptimistic(routeId, stop.id, status, stopReason.trim(), stopPhoto);
      setActionModal(null);
      toast("info", `Saved offline! "${stop.label}" will sync once reconnected.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/routes/${routeId}/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason: stopReason.trim(),
          photoUrl: stopPhoto,
          syncedFromOffline: false,
          clientUpdatedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Failed to update stop.");
        return;
      }
      applyLocalStopOptimistic(routeId, stop.id, status, stopReason.trim(), stopPhoto);
      setActionModal(null);
      toast("success", `Stop #${stop.stopOrder} marked as ${status.toUpperCase()}!`);
    } catch {
      // Fallback to offline queue if request drops mid-flight
      const entry: QueuedOfflineUpdate = {
        queueId: makeQueueId(stop.id),
        routeId,
        stopId: stop.id,
        stopLabel: stop.label,
        status,
        reason: stopReason.trim(),
        photoUrl: stopPhoto,
        clientUpdatedAt,
      };
      const updatedQueue = [...offlineQueue, entry];
      setOfflineQueue(updatedQueue);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
      applyLocalStopOptimistic(routeId, stop.id, status, stopReason.trim(), stopPhoto);
      setActionModal(null);
      toast("info", "Connection dropped — update queued offline for automatic sync.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoute =
    routesList.find((r) => r.id === selectedRouteId) ?? routesList[0] ?? null;

  const mapPins: MapPin[] = (selectedRoute?.stops ?? []).map((s, idx) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    label: s.label,
    detail: `${s.address} • ${s.status}`,
    orderNumber: idx + 1,
    color:
      s.status === "collected"
        ? "green"
        : s.status === "skipped"
        ? "amber"
        : s.status === "blocked"
        ? "red"
        : "blue",
  }));

  const queuedStopIds = new Set(offlineQueue.map((q) => q.stopId));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Truck className="h-7 w-7 text-[#166534]" />
            <span>{tr("collectorMode")}</span>
          </h1>
          <p className="text-sm text-slate-600">
            Follow ordered stops below and tap large buttons to record pickups.
          </p>
        </div>

        {/* Connectivity & Offline Test Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulateOffline((v) => !v)}
            className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 text-xs font-bold ${
              effectivelyOnline
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-amber-400 bg-amber-100 text-amber-950"
            }`}
          >
            {effectivelyOnline ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span>
              {effectivelyOnline ? "Online (Tap to Test Offline)" : "Offline Mode (Tap to Reconnect)"}
            </span>
          </button>

          {offlineQueue.length > 0 && (
            <button
              type="button"
              disabled={!effectivelyOnline || syncing}
              onClick={() => syncOfflineQueue()}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#166534] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              <span>
                {tr("syncNow")} ({offlineQueue.length})
              </span>
            </button>
          )}
        </div>
      </div>

      {!effectivelyOnline && (
        <div
          role="status"
          className="rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm font-semibold text-amber-950 flex items-center gap-3"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-amber-700" />
          <span>{tr("offlineBanner")}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : routesList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          No routes are assigned to you right now.
        </div>
      ) : (
        <>
          {/* Route selector pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routesList.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRouteId(r.id)}
                className={`min-h-[46px] shrink-0 rounded-xl border px-4 py-2 text-left text-sm font-bold transition ${
                  selectedRoute?.id === r.id
                    ? "border-[#166534] bg-[#166534] text-white"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                {r.name} ({r.progress.done}/{r.progress.total})
              </button>
            ))}
          </div>

          {selectedRoute && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <WasteBadge wasteType={selectedRoute.wasteType} lang={lang} />
                    <StatusBadge status={selectedRoute.status} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {selectedRoute.name}
                  </h2>
                  <div className="text-xs text-slate-600">
                    {selectedRoute.routeDate} • {selectedRoute.truckName ?? "Assigned Truck"} • ~
                    {selectedRoute.estimatedDistanceKm} km ({tr("distanceEstimateNote")})
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>
                        Completed: {selectedRoute.progress.done} / {selectedRoute.progress.total}
                      </span>
                      <span>{selectedRoute.progress.progressPct}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#166534] transition-all"
                        style={{ width: `${selectedRoute.progress.progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <LeafletMap
                  pins={mapPins}
                  showPolyline
                  includeDepot
                  heightClass="h-[300px] lg:h-[380px]"
                />
              </div>

              {/* Mobile-first Large Stop Cards */}
              <div className="lg:col-span-7 space-y-3">
                {selectedRoute.stops.map((stop, idx) => {
                  const isQueued = queuedStopIds.has(stop.id);
                  return (
                    <div
                      key={stop.id}
                      className={`rounded-2xl border bg-white p-4 sm:p-5 shadow-xs space-y-3 ${
                        stop.status === "collected"
                          ? "border-green-300 bg-green-50/30"
                          : stop.status === "blocked"
                          ? "border-red-300 bg-red-50/30"
                          : stop.status === "skipped"
                          ? "border-amber-300 bg-amber-50/30"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#166534] text-sm font-extrabold text-white">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-base font-bold text-slate-900">
                              {stop.label}
                            </h3>
                            <p className="text-sm text-slate-600">{stop.address}</p>
                            {stop.reason && (
                              <p className="mt-1 text-xs font-semibold text-amber-900">
                                Note: {stop.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={stop.status} />
                          {isQueued && (
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                              Queued Offline
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Large 52px+ Collector Touch Buttons */}
                      <div className="grid grid-cols-3 gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            submitStopStatus(selectedRoute.id, stop, "collected", "", "")
                          }
                          className={`min-h-[54px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                            stop.status === "collected"
                              ? "bg-green-700 text-white ring-2 ring-green-300"
                              : "bg-green-100 text-green-900 hover:bg-green-200"
                          }`}
                        >
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                          <span>{tr("collected")}</span>
                        </button>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setReason(stop.reason || "");
                            setPhotoUrl(stop.photoUrl || "");
                            setActionModal({
                              routeId: selectedRoute.id,
                              stop,
                              status: "skipped",
                            });
                          }}
                          className={`min-h-[54px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                            stop.status === "skipped"
                              ? "bg-amber-600 text-white ring-2 ring-amber-300"
                              : "bg-amber-100 text-amber-950 hover:bg-amber-200"
                          }`}
                        >
                          <SkipForward className="h-5 w-5 shrink-0" />
                          <span>{tr("skipped")}</span>
                        </button>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setReason(stop.reason || "");
                            setPhotoUrl(stop.photoUrl || "");
                            setActionModal({
                              routeId: selectedRoute.id,
                              stop,
                              status: "blocked",
                            });
                          }}
                          className={`min-h-[54px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                            stop.status === "blocked"
                              ? "bg-red-700 text-white ring-2 ring-red-300"
                              : "bg-red-100 text-red-900 hover:bg-red-200"
                          }`}
                        >
                          <Ban className="h-5 w-5 shrink-0" />
                          <span>{tr("blocked")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reason & Photo Modal for Skipped / Blocked */}
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 capitalize">
                Mark Stop as {actionModal.status}
              </h2>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                aria-label="Close"
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              <strong>{actionModal.stop.label}</strong> — {actionModal.stop.address}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => setReason(qr)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {qr}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reason (required)
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this stop was skipped or blocked..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <PhotoUploader
              value={photoUrl}
              onChange={setPhotoUrl}
              disabled={!effectivelyOnline}
              label={
                effectivelyOnline
                  ? "Evidence Photo (optional)"
                  : "Photo upload paused while offline"
              }
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="min-h-[46px] flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  submitStopStatus(
                    actionModal.routeId,
                    actionModal.stop,
                    actionModal.status,
                    reason,
                    photoUrl
                  )
                }
                className={`min-h-[46px] flex-1 rounded-xl text-sm font-bold text-white ${
                  actionModal.status === "blocked"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {submitting ? "Saving..." : `Confirm ${actionModal.status}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
