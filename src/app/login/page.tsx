"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, UserCheck, Shield, Truck, Eye, AlertCircle } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { useApp } from "@/components/AppProviders";

const DEMO_ACCOUNTS = [
  {
    role: "Barangay Admin",
    name: "Elena Villanueva",
    email: "admin@sanisidro.ph",
    password: "Password123!",
    desc: "Full access: schedules, route planner, reports, compliance, user approvals & exports.",
    icon: Shield,
    badge: "bg-green-100 text-green-800",
  },
  {
    role: "Collector / Driver",
    name: "Rico Santos",
    email: "rico.santos@sanisidro.ph",
    password: "Password123!",
    desc: "Assigned routes only, mobile stop buttons, offline sync & household inspections.",
    icon: Truck,
    badge: "bg-amber-100 text-amber-900",
  },
  {
    role: "Resident",
    name: "Maria Cruz (Purok 1)",
    email: "maria.cruz@sanisidro.ph",
    password: "Password123!",
    desc: "Own household schedule, submit/confirm missed pickups & view/contest compliance.",
    icon: UserCheck,
    badge: "bg-blue-100 text-blue-800",
  },
  {
    role: "Barangay Captain / Official",
    name: "Roberto Bautista",
    email: "captain@sanisidro.ph",
    password: "Password123!",
    desc: "Read-only access to dashboards, compliance charts, audit logs & CSV/PDF exports.",
    icon: Eye,
    badge: "bg-slate-200 text-slate-800",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser, toast, tr } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function doLogin(targetEmail: string, targetPassword: string) {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }
      await refreshUser();
      toast("success", `Welcome back, ${data.user.fullName}!`);
      if (data.user.roleCode === "collector") {
        router.push("/app/collector");
      } else {
        router.push("/app/dashboard");
      }
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(email, password);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <main id="main-content" className="flex-1 mx-auto max-w-5xl w-full px-4 py-10 sm:px-6 grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">{tr("login")}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to Barangay San Isidro EcoCollect using your approved account.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-medium text-red-800"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sanisidro.ph"
                className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-base font-bold text-white hover:bg-[#14532d] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              <span>{submitting ? "Signing in..." : tr("login")}</span>
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600 text-center">
            New household resident?{" "}
            <Link href="/register" className="font-bold text-[#166534] hover:underline">
              {tr("register")}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Demo Accounts (All 4 Roles)
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Click any fictional demo role below to sign in immediately, or use password{" "}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900">
                Password123!
              </code>
              .
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    doLogin(acc.email, acc.password);
                  }}
                  className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#166534] hover:shadow-md transition flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${acc.badge}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {acc.role}
                      </span>
                    </div>
                    <div className="mt-2.5 text-base font-bold text-slate-900">{acc.name}</div>
                    <div className="text-xs font-mono text-slate-500">{acc.email}</div>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{acc.desc}</p>
                  </div>
                  <div className="text-xs font-bold text-[#166534]">
                    Sign in as {acc.role} →
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
