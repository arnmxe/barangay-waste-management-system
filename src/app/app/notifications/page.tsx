"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2, ArrowRight } from "lucide-react";
import { useApp } from "@/components/AppProviders";

interface NotifItem {
  id: number;
  title: string;
  message: string;
  category: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { refreshUser, toast, tr } = useApp();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setItems(d.notifications ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifs]);

  async function markOne(id: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await refreshUser();
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshUser();
      toast("success", "All notifications marked as read.");
    }
  }

  const shown = filter === "unread" ? items.filter((i) => !i.isRead) : items;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
          <Bell className="h-7 w-7 text-[#166534]" />
          <span>{tr("notifications")}</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter(filter === "all" ? "unread" : "all")}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
          >
            {filter === "all" ? "Show Unread Only" : "Show All"}
          </button>
          <button
            type="button"
            onClick={markAllRead}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#166534] px-4 text-sm font-bold text-white hover:bg-[#14532d]"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          You&apos;re all caught up! No notifications to show.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                n.isRead
                  ? "border-slate-200 bg-white"
                  : "border-[#166534] bg-green-50/50"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!n.isRead && (
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                    {n.category}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(n.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900">{n.title}</h2>
                <p className="text-sm text-slate-700">{n.message}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markOne(n.id)}
                    className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"
                  >
                    Mark Read
                  </button>
                )}
                <Link
                  href={n.link || "/app/dashboard"}
                  onClick={() => {
                    if (!n.isRead) markOne(n.id);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-[#166534] px-3.5 text-xs font-bold text-white"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
