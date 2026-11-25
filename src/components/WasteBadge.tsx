"use client";

import React from "react";
import { Leaf, Recycle, Trash2, AlertTriangle } from "lucide-react";
import { Lang, WASTE_META, WasteType } from "@/lib/i18n";

export function WasteBadge({
  wasteType,
  lang = "en",
  size = "md",
}: {
  wasteType: string;
  lang?: Lang;
  size?: "sm" | "md";
}) {
  const safeType: WasteType =
    wasteType in WASTE_META ? (wasteType as WasteType) : "residual";
  const meta = WASTE_META[safeType];

  const Icon =
    safeType === "biodegradable"
      ? Leaf
      : safeType === "recyclable"
      ? Recycle
      : safeType === "special"
      ? AlertTriangle
      : Trash2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        meta.badgeBg
      } ${meta.badgeText} ${meta.badgeBorder} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} aria-hidden="true" />
      <span>{lang === "fil" ? meta.fil : meta.en}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-800 border-blue-200",
    planned: "bg-blue-50 text-blue-800 border-blue-200",
    in_progress: "bg-amber-100 text-amber-900 border-amber-300",
    delayed: "bg-amber-100 text-amber-900 border-amber-400",
    completed: "bg-green-100 text-green-800 border-green-300",
    collected: "bg-green-100 text-green-800 border-green-300",
    compliant: "bg-green-100 text-green-800 border-green-300",
    approved: "bg-green-100 text-green-800 border-green-300",
    active: "bg-green-100 text-green-800 border-green-300",
    resolved: "bg-green-100 text-green-800 border-green-300",
    partially_compliant: "bg-amber-100 text-amber-900 border-amber-300",
    skipped: "bg-amber-100 text-amber-900 border-amber-300",
    verified: "bg-indigo-100 text-indigo-800 border-indigo-300",
    assigned: "bg-purple-100 text-purple-800 border-purple-300",
    submitted: "bg-slate-100 text-slate-800 border-slate-300",
    pending: "bg-slate-100 text-slate-700 border-slate-300",
    blocked: "bg-red-100 text-red-800 border-red-300",
    non_compliant: "bg-red-100 text-red-800 border-red-300",
    cancelled: "bg-red-100 text-red-800 border-red-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    suspended: "bg-red-100 text-red-800 border-red-300",
    maintenance: "bg-amber-100 text-amber-900 border-amber-300",
  };

  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-700 border-slate-300"
      }`}
    >
      {label}
    </span>
  );
}
