"use client";

import React from "react";
import { ShieldCheck, Lock, Eye, UserCheck } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { BARANGAY_INFO } from "@/lib/i18n";

export default function PrivacyNoticePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <main id="main-content" className="flex-1 mx-auto max-w-4xl w-full px-4 py-10 sm:px-6 space-y-6">
        <div className="rounded-2xl bg-[#166534] p-6 sm:p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-amber-300">
            <ShieldCheck className="h-4 w-4" />
            <span>Republic Act No. 10173 (Data Privacy Act of 2012)</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold">
            Barangay San Isidro Data Privacy Notice
          </h1>
          <p className="mt-2 text-green-100 text-base">
            How we collect, protect, and limit resident data inside the Waste Collection Scheduling & Compliance System.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <UserCheck className="h-6 w-6 text-[#166534]" />
            <h2 className="mt-3 text-base font-bold text-slate-900">Explicit Consent</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Residents must actively consent during registration, and timestamps are recorded securely.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Lock className="h-6 w-6 text-[#166534]" />
            <h2 className="mt-3 text-base font-bold text-slate-900">Minimal Data Collection</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              We only collect your name, contact info, purok, and street address needed for pickup services.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Eye className="h-6 w-6 text-[#166534]" />
            <h2 className="mt-3 text-base font-bold text-slate-900">Household Privacy Isolation</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Residents can only see their own household&apos;s missed pickup reports and compliance records.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-lg font-bold text-slate-900">1. Purpose of Processing</h2>
          <p>
            Personal information is used solely by {BARANGAY_INFO.name} to verify household residency, coordinate waste collection routes, resolve missed pickup tickets, and share RA 9003 educational compliance notices.
          </p>
          <h2 className="text-lg font-bold text-slate-900">2. Security & Access Controls</h2>
          <p>
            Passwords are salted and hashed cryptographically. Uploaded photos are strictly restricted to JPEG, PNG, or WEBP under 2 MB. Role-based access ensures Collectors only see assigned routes, Barangay Officials have read-only oversight, and all administrative actions are recorded in the Audit Log.
          </p>
          <h2 className="text-lg font-bold text-slate-900">3. Your Rights as a Data Subject</h2>
          <p>
            Under RA 10173, you have the right to access, correct, contest compliance entries, or request deletion of your personal data by contacting the Barangay Data Protection Officer at{" "}
            <strong>{BARANGAY_INFO.dpoEmail}</strong> or visiting {BARANGAY_INFO.address}.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
