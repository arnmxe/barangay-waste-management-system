"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/PublicHeader";
import { WasteBadge } from "@/components/WasteBadge";
import { useApp } from "@/components/AppProviders";
import { WASTE_META, WasteType } from "@/lib/i18n";

export default function SegregationGuidePage() {
  const { lang, tr } = useApp();

  const sections: Array<{
    type: WasteType;
    dosEn: string[];
    dosFil: string[];
    dontsEn: string[];
    dontsFil: string[];
  }> = [
    {
      type: "biodegradable",
      dosEn: [
        "Drain water and soup from food leftovers",
        "Place fruit peels, vegetable scraps, and garden leaves in green bin",
        "Keep lid tightly closed to avoid pests and odor",
      ],
      dosFil: [
        "Patuluin muna ang sabaw at tubig sa tirang pagkain",
        "Ilagay ang balat ng prutas, gulay, at tuyong dahon sa berdeng basurahan",
        "Takpan nang mahigpit upang iwas langaw at amoy",
      ],
      dontsEn: [
        "Do NOT mix plastic wrappers or sachets inside the green bin",
        "Do NOT dump cooking oil directly into open sacks",
      ],
      dontsFil: [
        "HUWAG maghalo ng plastik o sachet sa berdeng basurahan",
        "HUWAG magbuhos ng mantika nang direkta sa sako",
      ],
    },
    {
      type: "recyclable",
      dosEn: [
        "Rinse plastic bottles, cans, and glass jars cleanly",
        "Dry and flatten cardboard boxes and cartons to save truck space",
        "Bundle dry newspapers and clean office paper",
      ],
      dosFil: [
        "Banlawan ang mga boteng plastik, lata, at garapon",
        "Patuyuin at pipiin ang mga karton upang makatipid sa espasyo ng trak",
        "Talian ang mga tuyong diyaryo at malinis na papel",
      ],
      dontsEn: [
        "Do NOT include grease-soaked pizza boxes or dirty food containers",
        "Do NOT mix broken light bulbs with regular glass bottles",
      ],
      dontsFil: [
        "HUWAG isama ang mamantikang kahon ng pagkain",
        "HUWAG ihalo ang basag na bombilya sa regular na bote",
      ],
    },
    {
      type: "residual",
      dosEn: [
        "Put shampoo sachets, snack wrappers, diapers, and sanitary items in gray bin",
        "Tie bags securely before bringing out 15 minutes prior to pickup",
      ],
      dosFil: [
        "Ilagay ang sachet, balat ng chichirya, diaper, at napkin sa abong basurahan",
        "Itali nang mahigpit ang supot bago ilabas 15 minuto bago ang koleksyon",
      ],
      dontsEn: [
        "Do NOT burn residual plastics in your backyard (prohibited by RA 9003)",
        "Do NOT include batteries or sharp metal inside regular bags",
      ],
      dontsFil: [
        "HUWAG magsunog ng plastik sa bakuran (ipinagbabawal ng RA 9003)",
        "HUWAG maglagay ng baterya o matutulis na bakal sa regular na supot",
      ],
    },
    {
      type: "special",
      dosEn: [
        "Store batteries, busted bulbs, expired medicines, and small e-waste in a rigid labeled box",
        "Wrap broken glass in thick newspaper and mark clearly as 'SHARP / MATULIS'",
        "Bring out only during scheduled Special/Hazardous pickups",
      ],
      dosFil: [
        "Ilagay ang baterya, sirang bombilya, lumang gamot, at e-waste sa matibay at may label na kahon",
        "Ibalot ang basag na salamin sa makapal na diyaryo at lagyan ng 'MATULIS'",
        "Ilabas lamang tuwing nakatakdang koleksyon ng Espesyal na basura",
      ],
      dontsEn: [
        "Do NOT mix hazardous waste with biodegradable or residual waste",
        "Do NOT leave chemical containers open where children or collectors may touch them",
      ],
      dontsFil: [
        "HUWAG ihalo ang mapanganib na basura sa nabubulok o di-nabubulok",
        "HUWAG iwang bukas ang mga kemikal na maaaring mahawakan ng bata o kolektor",
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <main id="main-content" className="flex-1 mx-auto max-w-5xl w-full px-4 py-10 sm:px-6 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#166534] hover:underline mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{tr("home")}</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900">
            {tr("segregationGuide")} — RA 9003
          </h1>
          <p className="mt-2 text-base text-slate-600">
            {lang === "fil"
              ? "Simpleng gabay para sa bawat tahanan sa Barangay San Isidro alinsunod sa Ecological Solid Waste Management Act of 2000 (RA 9003)."
              : "Simple household sorting guide for Barangay San Isidro under the Ecological Solid Waste Management Act of 2000 (RA 9003)."}
          </p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-[#166534] shrink-0 mt-0.5" />
          <div className="text-sm text-green-950 leading-relaxed">
            <strong>{lang === "fil" ? "Paalala sa Komunidad:" : "Community Reminder:"}</strong>{" "}
            {tr("noFinePolicy")}
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((sec) => {
            const meta = WASTE_META[sec.type];
            return (
              <section
                key={sec.type}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <WasteBadge wasteType={sec.type} lang={lang} />
                  <span className="text-sm font-bold text-slate-700">
                    {lang === "fil" ? meta.binColorFil : meta.binColorEn}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  <strong>{lang === "fil" ? "Mga Halimbawa:" : "Examples:"}</strong>{" "}
                  {lang === "fil" ? meta.examplesFil : meta.examplesEn}
                </p>

                <div className="grid gap-4 md:grid-cols-2 pt-2">
                  <div className="rounded-xl bg-green-50/70 border border-green-200 p-4">
                    <h2 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-700" />
                      <span>{lang === "fil" ? "Dapat Gawin (DO)" : "What to DO"}</span>
                    </h2>
                    <ul className="space-y-1.5 text-sm text-green-950 list-disc pl-5">
                      {(lang === "fil" ? sec.dosFil : sec.dosEn).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-red-50/70 border border-red-200 p-4">
                    <h2 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-red-700" />
                      <span>{lang === "fil" ? "Huwag Gawin (DON'T)" : "What NOT to do"}</span>
                    </h2>
                    <ul className="space-y-1.5 text-sm text-red-950 list-disc pl-5">
                      {(lang === "fil" ? sec.dontsFil : sec.dontsEn).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
