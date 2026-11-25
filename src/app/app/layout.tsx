"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Map as MapIcon,
  Truck,
  AlertOctagon,
  ClipboardCheck,
  Settings,
  Bell,
  LogOut,
  Globe,
  Home,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { BARANGAY_INFO } from "@/lib/i18n";

interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"resident" | "collector" | "admin" | "official">;
  mobilePriority?: boolean;
}

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loadingUser, unreadNotifications, logout, lang, setLang, tr } = useApp();

  useEffect(() => {
    if (!loadingUser && !user) {
      router.replace("/login");
    }
  }, [loadingUser, user, router]);

  if (loadingUser || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-[#166534]" />
        <p className="text-base font-medium text-slate-700">{tr("loading")}</p>
      </div>
    );
  }

  const allNavItems: NavLinkItem[] = [
    {
      href: "/app/dashboard",
      label: tr("dashboard"),
      icon: LayoutDashboard,
      roles: ["resident", "collector", "admin", "official"],
      mobilePriority: true,
    },
    {
      href: "/app/schedules",
      label: tr("schedules"),
      icon: CalendarDays,
      roles: ["resident", "collector", "admin", "official"],
      mobilePriority: true,
    },
    {
      href: "/app/routes",
      label: tr("routes"),
      icon: MapIcon,
      roles: ["admin", "official"],
      mobilePriority: true,
    },
    {
      href: "/app/collector",
      label: tr("collectorMode"),
      icon: Truck,
      roles: ["collector", "admin"],
      mobilePriority: true,
    },
    {
      href: "/app/reports",
      label: tr("missedReports"),
      icon: AlertOctagon,
      roles: ["resident", "collector", "admin", "official"],
      mobilePriority: true,
    },
    {
      href: "/app/compliance",
      label: tr("compliance"),
      icon: ClipboardCheck,
      roles: ["resident", "collector", "admin", "official"],
      mobilePriority: true,
    },
    {
      href: "/app/admin",
      label: tr("adminPanel"),
      icon: Settings,
      roles: ["admin", "official"],
    },
    {
      href: "/app/notifications",
      label: tr("notifications"),
      icon: Bell,
      roles: ["resident", "collector", "admin", "official"],
    },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(user.roleCode));
  const mobileBottomItems = navItems.filter((i) => i.mobilePriority).slice(0, 5);

  const roleLabels: Record<string, string> = {
    resident: "Resident",
    collector: "Collector / Driver",
    admin: "Barangay Admin",
    official: "Barangay Captain",
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-512.png"
            alt="EcoCollect emblem"
            className="h-10 w-10 rounded-xl"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[#166534]">
              {BARANGAY_INFO.name}
            </div>
            <div className="truncate text-xs font-medium text-slate-500">
              Waste Collection System
            </div>
          </div>
        </div>

        <nav aria-label="Portal navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isNotif = item.href === "/app/notifications";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[46px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#166534] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {isNotif && unreadNotifications > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      active ? "bg-amber-400 text-slate-900" : "bg-amber-500 text-white"
                    }`}
                  >
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
            <div className="text-sm font-bold text-slate-900 truncate">{user.fullName}</div>
            <div className="text-xs font-semibold text-[#166534] mt-0.5">
              {roleLabels[user.roleCode] ?? user.roleCode}
            </div>
            {user.purokName && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">{user.purokName}</div>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              <span>Public</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              <span>{tr("logout")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-72 min-w-0">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex lg:hidden items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-512.png" alt="" className="h-8 w-8 rounded-lg" />
              <span className="text-sm font-bold text-[#166534] truncate">EcoCollect</span>
            </div>
            {user.roleCode === "official" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{tr("readOnlyBadge")}</span>
              </span>
            )}
            <span className="hidden md:inline-block text-sm font-medium text-slate-600 truncate">
              {user.purokName ? `${user.purokName}` : BARANGAY_INFO.city}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "fil" : "en")}
              aria-label="Toggle English or Filipino"
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Globe className="h-4 w-4 text-[#166534]" />
              <span>{lang === "en" ? "EN" : "FIL"}</span>
            </button>

            <Link
              href="/app/notifications"
              aria-label={`Notifications (${unreadNotifications} unread)`}
              className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                  {unreadNotifications}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Main Content */}
        <main
          id="main-content"
          className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8 max-w-7xl w-full mx-auto"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white shadow-lg"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileBottomItems.length}, minmax(0, 1fr))` }}>
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold ${
                  active ? "text-[#166534] bg-green-50/70" : "text-slate-600"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
