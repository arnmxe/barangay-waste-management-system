"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Globe,
  Download,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  LayoutDashboard,
  LogIn,
} from "lucide-react";
import { useApp } from "@/components/AppProviders";
import { BARANGAY_INFO } from "@/lib/i18n";

export function PublicHeader() {
  const pathname = usePathname();
  const { user, lang, setLang, tr, canInstallPwa, installPwa } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: tr("home") },
    { href: "/segregation-guide", label: tr("segregationGuide") },
    { href: "/announcements", label: tr("announcements") },
    { href: "/privacy", label: tr("privacy") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 min-h-[44px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-512.png"
            alt="Barangay San Isidro EcoCollect seal"
            className="h-10 w-10 rounded-xl shadow-xs"
          />
          <div>
            <div className="text-base font-bold leading-tight text-[#166534]">
              {BARANGAY_INFO.name}
            </div>
            <div className="text-xs font-medium text-slate-600">
              EcoCollect • RA 9003
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-[44px] inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-green-50 text-[#166534]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "fil" : "en")}
            aria-label="Switch language between English and Filipino"
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Globe className="h-4 w-4 text-[#166534]" />
            <span>{lang === "en" ? "EN / FIL" : "FIL / EN"}</span>
          </button>

          {canInstallPwa && (
            <button
              type="button"
              onClick={installPwa}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Download className="h-4 w-4" />
              <span>Install App</span>
            </button>
          )}

          {user ? (
            <Link
              href="/app/dashboard"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532d]"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>{tr("openPortal")}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[#166534] px-4 py-2 text-sm font-semibold text-[#166534] hover:bg-green-50"
              >
                <LogIn className="h-4 w-4" />
                <span>{tr("login")}</span>
              </Link>
              <Link
                href="/register"
                className="min-h-[44px] inline-flex items-center rounded-xl bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532d]"
              >
                {tr("register")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "fil" : "en")}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700"
          >
            {lang === "en" ? "FIL" : "EN"}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 shadow-lg">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[44px] items-center rounded-xl px-4 text-base font-semibold text-slate-800 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            {user ? (
              <Link
                href="/app/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#166534] font-semibold text-white"
              >
                {tr("openPortal")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl border border-[#166534] font-semibold text-[#166534]"
                >
                  {tr("login")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#166534] font-semibold text-white"
                >
                  {tr("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { tr } = useApp();
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-512.png"
              alt=""
              className="h-10 w-10 rounded-xl"
            />
            <div>
              <h2 className="text-lg font-bold text-white">{BARANGAY_INFO.name}</h2>
              <p className="text-sm text-slate-400">{BARANGAY_INFO.city}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            {tr("ra9003Banner")}.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-amber-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{tr("ra10173Banner")}</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            {tr("contact")}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-green-400 mt-1" />
              <span>{BARANGAY_INFO.address}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-green-400" />
              <span>{BARANGAY_INFO.hotline}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-green-400" />
              <span>{BARANGAY_INFO.email}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-green-400" />
              <span>{BARANGAY_INFO.officeHours}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            Quick Links
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/segregation-guide" className="hover:text-white underline-offset-4 hover:underline">
                {tr("segregationGuide")} (RA 9003)
              </Link>
            </li>
            <li>
              <Link href="/announcements" className="hover:text-white underline-offset-4 hover:underline">
                {tr("announcements")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-white underline-offset-4 hover:underline">
                {tr("privacy")} (RA 10173)
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white underline-offset-4 hover:underline">
                {tr("login")} / Demo Accounts
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {BARANGAY_INFO.name}, {BARANGAY_INFO.city}. All sample resident records are fictional.
      </div>
    </footer>
  );
}
