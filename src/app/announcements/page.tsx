"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Pin, Loader2 } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { useApp } from "@/components/AppProviders";

interface AnnouncementItem {
  id: number;
  title: string;
  titleFil: string;
  body: string;
  bodyFil: string;
  category: string;
  isPinned: boolean;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const { lang, tr } = useApp();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    fetch("/api/public/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.announcements ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    category === "all" ? items : items.filter((a) => a.category === category);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <main id="main-content" className="flex-1 mx-auto max-w-4xl w-full px-4 py-10 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Megaphone className="h-7 w-7 text-[#166534]" />
            <span>{tr("announcements")}</span>
          </h1>
          <div className="flex flex-wrap gap-2">
            {["all", "ra9003", "schedule", "advisory", "general"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold capitalize transition ${
                  category === cat
                    ? "bg-[#166534] text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-[#166534]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
            No announcements in this category.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ann) => (
              <article
                key={ann.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {ann.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                  <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-bold uppercase text-green-800">
                    {ann.category}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">
                    {new Date(ann.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {lang === "fil" && ann.titleFil ? ann.titleFil : ann.title}
                </h2>
                <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
                  {lang === "fil" && ann.bodyFil ? ann.bodyFil : ann.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
