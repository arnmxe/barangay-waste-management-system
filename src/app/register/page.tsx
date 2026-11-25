"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { useApp } from "@/components/AppProviders";

export default function RegisterPage() {
  const { tr } = useApp();
  const [puroks, setPuroks] = useState<Array<{ id: number; name: string }>>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [purokId, setPurokId] = useState("");
  const [address, setAddress] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch("/api/public/overview")
      .then((r) => r.json())
      .then((d) => {
        setPuroks(d.puroks ?? []);
        if (d.puroks?.length > 0) setPurokId(String(d.puroks[0].id));
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!privacyConsent) {
      setError("Please check the Data Privacy Act (RA 10173) consent box to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          purokId: Number(purokId),
          address,
          privacyConsent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      setSuccessMsg(data.message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <main id="main-content" className="flex-1 mx-auto max-w-xl w-full px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">{tr("register")}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Register your household in Barangay San Isidro. After registration, Barangay Admin will verify and approve your account.
          </p>

          {successMsg ? (
            <div className="mt-6 rounded-2xl border border-green-300 bg-green-50 p-6 space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-[#166534] mx-auto" />
              <h2 className="text-lg font-bold text-green-950">Registration Submitted!</h2>
              <p className="text-sm text-green-900 leading-relaxed">{successMsg}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link
                  href="/login"
                  className="min-h-[46px] inline-flex items-center justify-center rounded-xl bg-[#166534] px-6 text-sm font-bold text-white"
                >
                  Go to Sign In
                </Link>
                <Link
                  href="/"
                  className="min-h-[46px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-medium text-red-800"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="reg-name" className="block text-sm font-semibold text-slate-700 mb-1">
                  Full Name (Household Head / Representative)
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base"
                  />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-semibold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0917-000-0000"
                    className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-1">
                  Password (at least 8 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base"
                />
              </div>

              <div>
                <label htmlFor="reg-purok" className="block text-sm font-semibold text-slate-700 mb-1">
                  Purok
                </label>
                <select
                  id="reg-purok"
                  required
                  value={purokId}
                  onChange={(e) => setPurokId(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base"
                >
                  {puroks.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reg-address" className="block text-sm font-semibold text-slate-700 mb-1">
                  Household Street Address
                </label>
                <input
                  id="reg-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House No., Street / Alley"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base"
                />
              </div>

              {/* RA 10173 Data Privacy Act Consent */}
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#166534] uppercase">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Data Privacy Act of 2012 (RA 10173) Consent</span>
                </div>
                <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-400 accent-[#166534] shrink-0"
                  />
                  <span>
                    I consent to Barangay San Isidro collecting only the minimal household data above for waste collection scheduling, missed pickup resolution, and RA 9003 notices. Read our{" "}
                    <Link href="/privacy" className="font-bold text-[#166534] underline">
                      Privacy Notice
                    </Link>
                    .
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 text-base font-bold text-white hover:bg-[#14532d] disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                <span>{submitting ? "Submitting..." : "Submit Registration"}</span>
              </button>
            </form>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
