"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Map as MapIcon,
  Plus,
  Sparkles,
  GripVertical,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { LeafletMap, MapPin } from "@/components/LeafletMap";
import { WasteBadge, StatusBadge } from "@/components/WasteBadge";
import { computeRouteDistanceKm, suggestNearestNeighborOrder } from "@/lib/geo";
import { getTodayDateStr, WasteType } from "@/lib/i18n";

interface RouteStop {
  id?: number;
  tempId?: string;
  stopOrder?: number;
  label: string;
  address: string;
  householdId?: number | null;
  lat: number;
  lng: number;
  status: string;
  reason: string;
  photoUrl: string;
  updatedAt?: string;
}

interface RouteItem {
  id: number;
  name: string;
  purokId: number;
  purokName: string;
  wasteType: string;
  routeDate: string;
  truckId: number | null;
  truckName: string | null;
  driverId: number | null;
  driverName: string | null;
  status: string;
  estimatedDistanceKm: number;
  distanceNote: string;
  stops: RouteStop[];
  progress: {
    total: number;
    collected: number;
    skipped: number;
    blocked: number;
    pending: number;
    done: number;
    progressPct: number;
  };
}

interface HouseholdRef {
  id: number;
  householdCode: string;
  headName: string;
  address: string;
  purokId: number;
  lat: number;
  lng: number;
}

export default function RoutePlanningPage() {
  const { user, lang, tr, toast, confirm } = useApp();
  const isAdmin = user?.roleCode === "admin";

  const [tab, setTab] = useState<"live" | "builder">("live");
  const [routesList, setRoutesList] = useState<RouteItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [puroks, setPuroks] = useState<Array<{ id: number; name: string }>>([]);
  const [trucks, setTrucks] = useState<Array<{ id: number; name: string; assignedDriverId: number | null }>>([]);
  const [collectors, setCollectors] = useState<Array<{ id: number; fullName: string }>>([]);
  const [households, setHouseholds] = useState<HouseholdRef[]>([]);
  const [loading, setLoading] = useState(true);

  // Route builder state
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [routeName, setRouteName] = useState("");
  const [purokId, setPurokId] = useState("");
  const [wasteType, setWasteType] = useState<WasteType>("biodegradable");
  const [routeDate, setRouteDate] = useState(getTodayDateStr());
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [draftStops, setDraftStops] = useState<RouteStop[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routes", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setRoutesList(d.routes ?? []);
      setPuroks(d.puroks ?? []);
      setTrucks(d.trucks ?? []);
      setCollectors(d.collectors ?? []);
      setHouseholds(d.households ?? []);

      if (d.routes?.length > 0) {
        setSelectedRouteId((prev) =>
          prev && d.routes.some((r: RouteItem) => r.id === prev) ? prev : d.routes[0].id
        );
      }
      if (!purokId && d.puroks?.length > 0) setPurokId(String(d.puroks[0].id));
      if (!truckId && d.trucks?.length > 0) setTruckId(String(d.trucks[0].id));
      if (!driverId && d.collectors?.length > 0) setDriverId(String(d.collectors[0].id));
    } catch {
      toast("error", "Could not load routes.");
    } finally {
      setLoading(false);
    }
  }, [driverId, purokId, toast, truckId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRoutes();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRoute =
    routesList.find((r) => r.id === selectedRouteId) ?? routesList[0] ?? null;

  function startNewRoute() {
    setEditingRouteId(null);
    const p = puroks[0];
    setRouteName(`Collection Route – ${p?.name ?? "Purok 1"}`);
    if (p) setPurokId(String(p.id));
    setWasteType("biodegradable");
    setRouteDate(getTodayDateStr());
    if (trucks[0]) setTruckId(String(trucks[0].id));
    if (collectors[0]) setDriverId(String(collectors[0].id));
    setDraftStops([]);
    setTab("builder");
  }

  function startEditRoute(r: RouteItem) {
    setEditingRouteId(r.id);
    setRouteName(r.name);
    setPurokId(String(r.purokId));
    setWasteType(r.wasteType as WasteType);
    setRouteDate(r.routeDate);
    setTruckId(r.truckId ? String(r.truckId) : "");
    setDriverId(r.driverId ? String(r.driverId) : "");
    setDraftStops(
      r.stops.map((s, idx) => ({
        ...s,
        tempId: `existing-${s.id ?? idx}`,
      }))
    );
    setTab("builder");
  }

  function handleMapClick(lat: number, lng: number) {
    const nextNum = draftStops.length + 1;
    setDraftStops((prev) => [
      ...prev,
      {
        tempId: `pin-${Date.now()}-${nextNum}`,
        label: `Custom Map Stop #${nextNum}`,
        address: `Pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        householdId: null,
        lat,
        lng,
        status: "pending",
        reason: "",
        photoUrl: "",
      },
    ]);
    toast("info", `Added Stop #${nextNum} from map click.`);
  }

  function addHouseholdStop(hh: HouseholdRef) {
    if (draftStops.some((s) => s.householdId === hh.id)) {
      toast("info", `${hh.householdCode} is already on this route.`);
      return;
    }
    setDraftStops((prev) => [
      ...prev,
      {
        tempId: `hh-${hh.id}`,
        label: `${hh.householdCode} – ${hh.headName}`,
        address: hh.address,
        householdId: hh.id,
        lat: hh.lat,
        lng: hh.lng,
        status: "pending",
        reason: "",
        photoUrl: "",
      },
    ]);
  }

  function addAllPurokSampleStops() {
    const pid = Number(purokId);
    const matching = households.filter((h) => h.purokId === pid).slice(0, 6);
    setDraftStops(
      matching.map((hh) => ({
        tempId: `hh-${hh.id}`,
        label: `${hh.householdCode} – ${hh.headName}`,
        address: hh.address,
        householdId: hh.id,
        lat: hh.lat,
        lng: hh.lng,
        status: "pending",
        reason: "",
        photoUrl: "",
      }))
    );
    toast("success", `Loaded ${matching.length} household stops for selected Purok.`);
  }

  function moveStop(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= draftStops.length || fromIdx === toIdx) return;
    setDraftStops((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  }

  function applyNearestNeighbor() {
    if (draftStops.length < 2) {
      toast("info", "Add at least 2 stops to suggest an order.");
      return;
    }
    const { ordered, estimatedDistanceKm } = suggestNearestNeighborOrder(draftStops);
    setDraftStops(ordered);
    toast(
      "success",
      `Stops reordered by Nearest-Neighbor (~${estimatedDistanceKm} km straight-line estimate).`
    );
  }

  async function saveRoute(e: React.FormEvent) {
    e.preventDefault();
    if (draftStops.length === 0) {
      toast("error", "Add at least 1 stop by clicking the map or picking households.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: routeName,
        purokId: Number(purokId),
        wasteType,
        routeDate,
        truckId: truckId ? Number(truckId) : null,
        driverId: driverId ? Number(driverId) : null,
        stops: draftStops.map((s) => ({
          label: s.label,
          address: s.address,
          householdId: s.householdId ?? null,
          lat: s.lat,
          lng: s.lng,
          status: s.status ?? "pending",
          reason: s.reason ?? "",
          photoUrl: s.photoUrl ?? "",
        })),
      };

      const res = await fetch(
        editingRouteId ? `/api/routes/${editingRouteId}` : "/api/routes",
        {
          method: editingRouteId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error ?? "Failed to save route.");
        return;
      }
      toast(
        "success",
        editingRouteId
          ? "Route updated! Collector view reflects changes immediately."
          : "Route created and assigned to collector!"
      );
      await loadRoutes();
      if (data.route?.id) setSelectedRouteId(data.route.id);
      setTab("live");
    } catch {
      toast("error", "Network error saving route.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoute(r: RouteItem) {
    const ok = await confirm({
      title: "Delete Collection Route?",
      message: `Delete "${r.name}" and all its stops? This action cannot be undone.`,
      confirmLabel: "Delete Route",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/routes/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("success", "Route deleted.");
      await loadRoutes();
    } else {
      toast("error", "Failed to delete route.");
    }
  }

  const draftDistanceKm = computeRouteDistanceKm(draftStops, true);
  const purokHouseholds = households.filter((h) => h.purokId === Number(purokId));

  const liveMapPins: MapPin[] = (selectedRoute?.stops ?? []).map((s, idx) => ({
    id: s.id ?? idx,
    lat: s.lat,
    lng: s.lng,
    label: s.label,
    detail: `${s.address} • Status: ${s.status}${s.reason ? ` (${s.reason})` : ""}`,
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

  const builderMapPins: MapPin[] = draftStops.map((s, idx) => ({
    id: s.tempId ?? idx,
    lat: s.lat,
    lng: s.lng,
    label: s.label,
    detail: s.address,
    orderNumber: idx + 1,
    color: "blue",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <MapIcon className="h-7 w-7 text-[#166534]" />
            <span>{tr("routes")}</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Plan ordered collection routes on OpenStreetMap, suggest nearest-neighbor stop order, and monitor live collector progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("live")}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-bold ${
              tab === "live"
                ? "bg-[#166534] text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Live Route Progress
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={startNewRoute}
              className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-4 text-sm font-bold ${
                tab === "builder"
                  ? "bg-[#F59E0B] text-slate-950"
                  : "bg-[#166534] text-white hover:bg-[#14532d]"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Plan New Route</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : tab === "live" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Route Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Routes ({routesList.length})
              </h2>
              <button
                type="button"
                onClick={loadRoutes}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#166534] hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Live
              </button>
            </div>
            {routesList.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRouteId(r.id)}
                className={`w-full text-left rounded-2xl border p-4 transition space-y-2 ${
                  selectedRoute?.id === r.id
                    ? "border-[#166534] bg-green-50/50 ring-2 ring-green-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <WasteBadge wasteType={r.wasteType} lang={lang} size="sm" />
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-sm font-bold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-600">
                  {r.routeDate} • {r.driverName ?? "Unassigned"} • {r.truckName ?? "No truck"}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>
                      {r.progress.done}/{r.progress.total} stops
                    </span>
                    <span>{r.progress.progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#166534]"
                      style={{ width: `${r.progress.progressPct}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Route Live Map & Stop Table */}
          <div className="lg:col-span-8 space-y-4">
            {selectedRoute ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">
                        {selectedRoute.name}
                      </h2>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {selectedRoute.purokName} • {selectedRoute.routeDate} • Driver:{" "}
                        <strong>{selectedRoute.driverName ?? "Unassigned"}</strong> • Truck:{" "}
                        <strong>{selectedRoute.truckName ?? "Unassigned"}</strong>
                      </p>
                      <p className="text-xs font-semibold text-[#166534] mt-1">
                        Est. Distance: {selectedRoute.estimatedDistanceKm} km —{" "}
                        <span className="italic">{tr("distanceEstimateNote")}</span>
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditRoute(selectedRoute)}
                          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Edit Stops
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(selectedRoute)}
                          className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-green-50 p-2.5 border border-green-200">
                      <div className="text-lg font-extrabold text-green-800">
                        {selectedRoute.progress.collected}
                      </div>
                      <div className="text-[11px] font-bold text-green-700">Collected</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5 border border-amber-200">
                      <div className="text-lg font-extrabold text-amber-800">
                        {selectedRoute.progress.skipped}
                      </div>
                      <div className="text-[11px] font-bold text-amber-700">Skipped</div>
                    </div>
                    <div className="rounded-xl bg-red-50 p-2.5 border border-red-200">
                      <div className="text-lg font-extrabold text-red-800">
                        {selectedRoute.progress.blocked}
                      </div>
                      <div className="text-[11px] font-bold text-red-700">Blocked</div>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-2.5 border border-slate-200">
                      <div className="text-lg font-extrabold text-slate-800">
                        {selectedRoute.progress.pending}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">Pending</div>
                    </div>
                  </div>

                  <LeafletMap
                    pins={liveMapPins}
                    showPolyline
                    includeDepot
                    heightClass="h-[340px]"
                  />

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900">Ordered Stop Progress</h3>
                    {selectedRoute.stops.map((stop, i) => (
                      <div
                        key={stop.id ?? i}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{stop.label}</div>
                            <div className="text-xs text-slate-600">{stop.address}</div>
                            {stop.reason && (
                              <div className="text-xs font-medium text-amber-800 mt-0.5">
                                Reason: {stop.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {stop.photoUrl && (
                            <a
                              href={stop.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-[#166534] underline"
                            >
                              View Photo
                            </a>
                          )}
                          <StatusBadge status={stop.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                No routes created yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ROUTE BUILDER (Admin Only) */
        <form onSubmit={saveRoute} className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  1. Click Map to Add Stops (or Pick Purok Households)
                </h2>
                <button
                  type="button"
                  onClick={applyNearestNeighbor}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-4 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{tr("suggestOrder")}</span>
                </button>
              </div>

              <LeafletMap
                pins={builderMapPins}
                showPolyline
                includeDepot
                onMapClick={handleMapClick}
                heightClass="h-[380px]"
              />

              <div className="rounded-xl border border-green-200 bg-green-50 p-3.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-green-900">
                  Estimated Distance: {draftDistanceKm} km ({draftStops.length} stops)
                </span>
                <span className="text-xs font-medium text-green-800 italic">
                  * {tr("distanceEstimateNote")} (starting from MRF Depot)
                </span>
              </div>

              {/* Quick Household Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Quick-Add Households in Selected Purok
                  </h3>
                  <button
                    type="button"
                    onClick={addAllPurokSampleStops}
                    className="text-xs font-bold text-[#166534] hover:underline"
                  >
                    Load 6 Sample Stops
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {purokHouseholds.map((hh) => {
                    const added = draftStops.some((s) => s.householdId === hh.id);
                    return (
                      <button
                        key={hh.id}
                        type="button"
                        onClick={() => addHouseholdStop(hh)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          added
                            ? "border-green-300 bg-green-100 text-green-800"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {added && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                        {hh.householdCode} ({hh.headName})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                2. Assign Route & Reorder Stops
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Route Name</label>
                <input
                  type="text"
                  required
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Purok</label>
                  <select
                    value={purokId}
                    onChange={(e) => setPurokId(e.target.value)}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waste Type</label>
                  <select
                    value={wasteType}
                    onChange={(e) => setWasteType(e.target.value as WasteType)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="biodegradable">Biodegradable</option>
                    <option value="recyclable">Recyclable</option>
                    <option value="residual">Residual</option>
                    <option value="special">Special / Hazardous</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={routeDate}
                    onChange={(e) => setRouteDate(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Truck</label>
                  <select
                    value={truckId}
                    onChange={(e) => setTruckId(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-2.5 text-sm"
                  >
                    <option value="">None</option>
                    {trucks.map((tk) => (
                      <option key={tk.id} value={String(tk.id)}>
                        {tk.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Driver</label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-2.5 text-sm"
                  >
                    <option value="">None</option>
                    {collectors.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Draggable Stop List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Drag to Reorder Stops ({draftStops.length})
                </div>
                {draftStops.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                    Click on the map or pick households on the left to add stops.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {draftStops.map((stop, idx) => (
                      <div
                        key={stop.tempId ?? idx}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIdx !== null) moveStop(dragIdx, idx);
                          setDragIdx(null);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {stop.label}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {stop.address}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Move stop up"
                            onClick={() => moveStop(idx, idx - 1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move stop down"
                            onClick={() => moveStop(idx, idx + 1)}
                            disabled={idx === draftStops.length - 1}
                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove stop"
                            onClick={() =>
                              setDraftStops((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 rounded text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("live")}
                  className="min-h-[46px] flex-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[46px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] text-sm font-bold text-white hover:bg-[#14532d] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{editingRouteId ? "Update Route" : "Save & Assign Route"}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
