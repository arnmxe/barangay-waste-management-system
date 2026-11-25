"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Settings,
  Users,
  MapPin,
  Home,
  Truck,
  Megaphone,
  FileSpreadsheet,
  FileText,
  History,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { StatusBadge } from "@/components/WasteBadge";
import { downloadCsv, downloadPdf } from "@/lib/export";
import { BARANGAY_CENTER } from "@/lib/geo";

interface AdminData {
  users: Array<{
    id: number;
    fullName: string;
    email: string;
    phone: string;
    roleCode: string;
    purokName: string | null;
    address: string;
    status: string;
    createdAt: string;
  }>;
  puroks: Array<{
    id: number;
    code: string;
    name: string;
    zoneLabel: string;
    centerLat: number;
    centerLng: number;
    description: string;
  }>;
  households: Array<{
    id: number;
    householdCode: string;
    headName: string;
    address: string;
    purokId: number;
    purokName: string;
    contactNumber: string;
    membersCount: number;
    isRepeatViolator: boolean;
  }>;
  trucks: Array<{
    id: number;
    code: string;
    name: string;
    plateNumber: string;
    capacityTons: number;
    status: string;
    driverName: string | null;
    crewNames: string;
  }>;
  announcements: Array<{
    id: number;
    title: string;
    titleFil: string;
    body: string;
    category: string;
    isPinned: boolean;
    published: boolean;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    summary: string;
    createdAt: string;
  }>;
}

type AdminTab =
  | "users"
  | "puroks"
  | "households"
  | "trucks"
  | "announcements"
  | "exports"
  | "audit";

export default function AdminManagementPage() {
  const { user, tr, toast, confirm } = useApp();
  const isAdmin = user?.roleCode === "admin";

  const [tab, setTab] = useState<AdminTab>("users");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Export filters
  const [exportDataset, setExportDataset] = useState("compliance");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportPurok, setExportPurok] = useState("all");
  const [exporting, setExporting] = useState(false);

  // Create forms
  const [purokForm, setPurokForm] = useState({
    code: "",
    name: "",
    zoneLabel: "",
    centerLat: String(BARANGAY_CENTER.lat),
    centerLng: String(BARANGAY_CENTER.lng),
    description: "",
  });
  const [hhForm, setHhForm] = useState({
    householdCode: "",
    headName: "",
    address: "",
    purokId: "",
    contactNumber: "",
    membersCount: "4",
  });
  const [truckForm, setTruckForm] = useState({
    code: "",
    name: "",
    plateNumber: "",
    capacityTons: "4",
    crewNames: "",
  });
  const [annForm, setAnnForm] = useState({
    title: "",
    titleFil: "",
    body: "",
    bodyFil: "",
    category: "general",
    isPinned: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manage", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setData(d);
      if (!hhForm.purokId && d.puroks?.length > 0) {
        setHhForm((prev) => ({ ...prev, purokId: String(d.puroks[0].id) }));
      }
    } catch {
      toast("error", "Unable to load management tables.");
    } finally {
      setLoading(false);
    }
  }, [hhForm.purokId, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as AdminTab | null;
      if (urlTab) setTab(urlTab);
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateUserStatus(id: number, fullName: string, status: string) {
    if (status === "rejected" || status === "suspended") {
      const ok = await confirm({
        title: `${status === "rejected" ? "Reject" : "Suspend"} User?`,
        message: `Are you sure you want to mark ${fullName} as ${status}?`,
        confirmLabel: `Yes, ${status}`,
        destructive: true,
      });
      if (!ok) return;
    }
    const res = await fetch("/api/admin/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "user", id, status }),
    });
    if (res.ok) {
      toast("success", `${fullName} marked as ${status}.`);
      await loadData();
    } else {
      toast("error", "Failed to update user.");
    }
  }

  async function handleAddPurok(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "purok", ...purokForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast("error", json.error ?? "Could not add purok.");
      return;
    }
    toast("success", "Purok added!");
    setPurokForm({
      code: "",
      name: "",
      zoneLabel: "",
      centerLat: String(BARANGAY_CENTER.lat),
      centerLng: String(BARANGAY_CENTER.lng),
      description: "",
    });
    await loadData();
  }

  async function handleAddHousehold(e: React.FormEvent) {
    e.preventDefault();
    const pObj = data?.puroks.find((p) => String(p.id) === hhForm.purokId);
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "household",
        ...hhForm,
        lat: pObj?.centerLat ?? BARANGAY_CENTER.lat,
        lng: pObj?.centerLng ?? BARANGAY_CENTER.lng,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast("error", json.error ?? "Could not add household.");
      return;
    }
    toast("success", "Household registered!");
    setHhForm((prev) => ({
      ...prev,
      householdCode: "",
      headName: "",
      address: "",
      contactNumber: "",
    }));
    await loadData();
  }

  async function handleAddTruck(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "truck", ...truckForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast("error", json.error ?? "Could not add truck.");
      return;
    }
    toast("success", "Truck added to fleet!");
    setTruckForm({ code: "", name: "", plateNumber: "", capacityTons: "4", crewNames: "" });
    await loadData();
  }

  async function handleTruckStatus(id: number, status: string) {
    const res = await fetch("/api/admin/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "truck", id, status }),
    });
    if (res.ok) {
      toast("success", "Truck status updated.");
      await loadData();
    }
  }

  async function handleAddAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "announcement", ...annForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast("error", json.error ?? "Failed to publish announcement.");
      return;
    }
    toast("success", "Announcement published!");
    setAnnForm({
      title: "",
      titleFil: "",
      body: "",
      bodyFil: "",
      category: "general",
      isPinned: false,
    });
    await loadData();
  }

  async function handleDeleteAnnouncement(id: number, title: string) {
    const ok = await confirm({
      title: "Delete Announcement?",
      message: `Permanently delete "${title}" from the public board?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/manage?entity=announcement&id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast("success", "Announcement deleted.");
      await loadData();
    }
  }

  async function runExport(format: "csv" | "pdf") {
    setExporting(true);
    try {
      const params = new URLSearchParams({ dataset: exportDataset });
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      if (exportPurok !== "all") params.set("purokId", exportPurok);
      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");
      const payload = await res.json();
      const fname = `brgy-san-isidro-${exportDataset}-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") {
        downloadCsv(fname, payload);
      } else {
        downloadPdf(fname, payload);
      }
      toast("success", `Downloaded ${format.toUpperCase()} report (${payload.rows.length} rows).`);
    } catch {
      toast("error", "Failed to generate export.");
    } finally {
      setExporting(false);
    }
  }

  const tabs: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "users", label: "Users & Approvals", icon: Users },
    { id: "puroks", label: "Puroks", icon: MapPin },
    { id: "households", label: "Households", icon: Home },
    { id: "trucks", label: "Trucks", icon: Truck },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "exports", label: "CSV & PDF Exports", icon: FileSpreadsheet },
    { id: "audit", label: "Audit Log", icon: History },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-[#166534]" />
          <span>{tr("adminPanel")}</span>
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {isAdmin
            ? "Manage resident approvals, puroks, households, trucks, announcements, CSV/PDF reports, and audit logs."
            : "Read-only Barangay Official oversight — view records, audit logs, and download CSV/PDF reports."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          const pendingCount =
            item.id === "users"
              ? (data?.users ?? []).filter((u) => u.status === "pending").length
              : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setSearchQuery("");
              }}
              className={`min-h-[44px] shrink-0 inline-flex items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold transition ${
                tab === item.id
                  ? "bg-[#166534] text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-16 gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
          <span>{tr("loading")}</span>
        </div>
      ) : tab === "users" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 overflow-x-auto">
          <h2 className="text-lg font-bold text-slate-900">
            Accounts & Pending Resident Approvals ({data.users.length})
          </h2>
          <table className="w-full text-left text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2.5 pr-3">Name</th>
                <th className="py-2.5 pr-3">Role</th>
                <th className="py-2.5 pr-3">Purok / Address</th>
                <th className="py-2.5 pr-3">Status</th>
                {isAdmin && <th className="py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr key={u.id} className={u.status === "pending" ? "bg-amber-50/60" : ""}>
                  <td className="py-3 pr-3">
                    <div className="font-bold text-slate-900">{u.fullName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 pr-3 capitalize font-semibold text-slate-700">
                    {u.roleCode}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    <div>{u.purokName ?? "—"}</div>
                    <div className="truncate max-w-[220px]">{u.address}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge status={u.status} />
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {u.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u.id, u.fullName, "approved")}
                              className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-[#166534] px-3 text-xs font-bold text-white hover:bg-[#14532d]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u.id, u.fullName, "rejected")}
                              className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-3 text-xs font-bold text-red-700"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {u.status === "approved" && u.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => updateUserStatus(u.id, u.fullName, "suspended")}
                            className="min-h-[36px] rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Suspend
                          </button>
                        )}
                        {(u.status === "suspended" || u.status === "rejected") && (
                          <button
                            type="button"
                            onClick={() => updateUserStatus(u.id, u.fullName, "approved")}
                            className="min-h-[36px] rounded-lg bg-green-50 border border-green-300 px-2.5 text-xs font-bold text-green-800"
                          >
                            Re-approve
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "puroks" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            {data.puroks.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#166534]">{p.code}</span>
                  <span className="text-xs text-slate-500">{p.zoneLabel}</span>
                </div>
                <div className="text-base font-bold text-slate-900">{p.name}</div>
                <p className="text-xs text-slate-600">{p.description}</p>
              </div>
            ))}
          </div>
          {isAdmin && (
            <form
              onSubmit={handleAddPurok}
              className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit"
            >
              <h2 className="text-base font-bold text-slate-900">Add New Purok</h2>
              <input
                type="text"
                required
                placeholder="Code (e.g. PRK-6)"
                value={purokForm.code}
                onChange={(e) => setPurokForm({ ...purokForm, code: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Name (e.g. Purok 6 – Ilang-Ilang)"
                value={purokForm.name}
                onChange={(e) => setPurokForm({ ...purokForm, name: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Zone Label (e.g. Northeast)"
                value={purokForm.zoneLabel}
                onChange={(e) => setPurokForm({ ...purokForm, zoneLabel: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <textarea
                rows={2}
                placeholder="Description"
                value={purokForm.description}
                onChange={(e) => setPurokForm({ ...purokForm, description: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <button
                type="submit"
                className="min-h-[46px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#166534] text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Add Purok
              </button>
            </form>
          )}
        </div>
      ) : tab === "households" ? (
        <div className="space-y-4">
          {isAdmin && (
            <form
              onSubmit={handleAddHousehold}
              className="rounded-2xl border border-slate-200 bg-white p-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 items-end"
            >
              <input
                type="text"
                required
                placeholder="Code (HH-P1-011)"
                value={hhForm.householdCode}
                onChange={(e) => setHhForm({ ...hhForm, householdCode: e.target.value })}
                className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Household Head"
                value={hhForm.headName}
                onChange={(e) => setHhForm({ ...hhForm, headName: e.target.value })}
                className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
              <select
                value={hhForm.purokId}
                onChange={(e) => setHhForm({ ...hhForm, purokId: e.target.value })}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {data.puroks.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Street Address"
                value={hhForm.address}
                onChange={(e) => setHhForm({ ...hhForm, address: e.target.value })}
                className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm sm:col-span-2"
              />
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#166534] px-4 text-sm font-bold text-white"
              >
                + Add
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Registered Households ({data.households.length})
              </h2>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code, name, purok..."
                  className="min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Head</th>
                  <th className="py-2 pr-3">Purok</th>
                  <th className="py-2 pr-3">Address</th>
                  <th className="py-2">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.households
                  .filter((h) =>
                    `${h.householdCode} ${h.headName} ${h.purokName} ${h.address}`
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-900">
                        {h.householdCode}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">{h.headName}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">{h.purokName}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">{h.address}</td>
                      <td className="py-2.5">
                        {h.isRepeatViolator ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            Repeat Violator
                          </span>
                        ) : (
                          <span className="text-xs text-green-700 font-semibold">Good Standing</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "trucks" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            {data.trucks.map((tk) => (
              <div
                key={tk.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#166534]">{tk.code}</span>
                    <StatusBadge status={tk.status} />
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-1">{tk.name}</div>
                  <div className="text-xs text-slate-600">
                    Plate: {tk.plateNumber} • Capacity: {tk.capacityTons} tons • Crew: {tk.crewNames || "—"}
                  </div>
                </div>
                {isAdmin && (
                  <select
                    aria-label={`Status for ${tk.name}`}
                    value={tk.status}
                    onChange={(e) => handleTruckStatus(tk.id, e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <form
              onSubmit={handleAddTruck}
              className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit"
            >
              <h2 className="text-base font-bold text-slate-900">Register Collection Truck</h2>
              <input
                type="text"
                required
                placeholder="Truck Code (e.g. TRK-03)"
                value={truckForm.code}
                onChange={(e) => setTruckForm({ ...truckForm, code: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Truck Name"
                value={truckForm.name}
                onChange={(e) => setTruckForm({ ...truckForm, name: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Plate Number"
                  value={truckForm.plateNumber}
                  onChange={(e) => setTruckForm({ ...truckForm, plateNumber: e.target.value })}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
                />
                <input
                  type="number"
                  step="0.5"
                  required
                  placeholder="Capacity (tons)"
                  value={truckForm.capacityTons}
                  onChange={(e) => setTruckForm({ ...truckForm, capacityTons: e.target.value })}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Default Crew Names"
                value={truckForm.crewNames}
                onChange={(e) => setTruckForm({ ...truckForm, crewNames: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="submit"
                className="min-h-[46px] w-full rounded-xl bg-[#166534] text-sm font-bold text-white"
              >
                + Add Truck
              </button>
            </form>
          )}
        </div>
      ) : tab === "announcements" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            {data.announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase text-slate-600">
                      {ann.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{ann.title}</h3>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                      aria-label="Delete announcement"
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600">{ann.body}</p>
              </div>
            ))}
          </div>

          {isAdmin && (
            <form
              onSubmit={handleAddAnnouncement}
              className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit"
            >
              <h2 className="text-base font-bold text-slate-900">Publish Announcement</h2>
              <input
                type="text"
                required
                placeholder="Title (English)"
                value={annForm.title}
                onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <input
                type="text"
                placeholder="Pamagat (Filipino - optional)"
                value={annForm.titleFil}
                onChange={(e) => setAnnForm({ ...annForm, titleFil: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <select
                value={annForm.category}
                onChange={(e) => setAnnForm({ ...annForm, category: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="general">General</option>
                <option value="schedule">Schedule Advisory</option>
                <option value="advisory">Weather / Route Advisory</option>
                <option value="ra9003">RA 9003 Compliance</option>
              </select>
              <textarea
                rows={3}
                required
                placeholder="Announcement content (English)"
                value={annForm.body}
                onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <textarea
                rows={2}
                placeholder="Nilalaman (Filipino - optional)"
                value={annForm.bodyFil}
                onChange={(e) => setAnnForm({ ...annForm, bodyFil: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={annForm.isPinned}
                  onChange={(e) => setAnnForm({ ...annForm, isPinned: e.target.checked })}
                  className="h-4 w-4 accent-[#166534]"
                />
                <span>Pin to top of public board</span>
              </label>
              <button
                type="submit"
                className="min-h-[46px] w-full rounded-xl bg-[#166534] text-sm font-bold text-white"
              >
                Publish Announcement
              </button>
            </form>
          )}
        </div>
      ) : tab === "exports" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 max-w-2xl space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Filterable Barangay Reports (CSV & PDF)
            </h2>
            <p className="text-sm text-slate-600">
              Available to both Barangay Admin and Barangay Captain / Official for RA 9003 reporting.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Report Dataset
              </label>
              <select
                value={exportDataset}
                onChange={(e) => setExportDataset(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="compliance">Segregation Compliance Records</option>
                <option value="schedules">Collection Schedules</option>
                <option value="reports">Missed Pickup Reports</option>
                <option value="audit">System Audit Log</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Purok Filter
              </label>
              <select
                value={exportPurok}
                onChange={(e) => setExportPurok(e.target.value)}
                disabled={exportDataset === "audit"}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
              >
                <option value="all">All Puroks</option>
                {data.puroks.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Date From (optional)
              </label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                disabled={exportDataset === "audit"}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Date To (optional)
              </label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                disabled={exportDataset === "audit"}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => runExport("csv")}
              className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#166534] px-6 text-sm font-bold text-white hover:bg-[#14532d]"
            >
              <FileSpreadsheet className="h-5 w-5" />
              <span>{tr("exportCsv")}</span>
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => runExport("pdf")}
              className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-6 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              <FileText className="h-5 w-5" />
              <span>{tr("exportPdf")}</span>
            </button>
          </div>
        </div>
      ) : (
        /* AUDIT LOG */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              System Audit Log (Latest {data.auditLogs.length})
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter actor, action, summary..."
              className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <table className="w-full text-left text-xs sm:text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.auditLogs
                .filter((a) =>
                  `${a.actorName} ${a.action} ${a.summary}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                )
                .map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                      {new Date(a.createdAt).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-bold text-slate-900">{a.actorName}</span>{" "}
                      <span className="text-slate-500">({a.actorRole})</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-[#166534]">
                      {a.action}
                    </td>
                    <td className="py-2.5 text-slate-700">{a.summary}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
