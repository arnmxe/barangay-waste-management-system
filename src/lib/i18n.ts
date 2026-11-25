export type Lang = "en" | "fil";
export type WasteType = "biodegradable" | "recyclable" | "residual" | "special";

export const BARANGAY_INFO = {
  name: "Barangay San Isidro",
  city: "City of Malolos, Bulacan, Philippines",
  address: "Barangay San Isidro Hall, Rizal St., Malolos, Bulacan 3000",
  hotline: "(044) 791-4520 / 0917-555-0193",
  email: "eco@sanisidro-malolos.ph",
  dpoEmail: "privacy@sanisidro-malolos.ph",
  officeHours: "Monday – Saturday, 7:00 AM – 5:00 PM",
};

export const WASTE_META: Record<
  WasteType,
  {
    en: string;
    fil: string;
    binColorEn: string;
    binColorFil: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    examplesEn: string;
    examplesFil: string;
    tipsEn: string;
    tipsFil: string;
  }
> = {
  biodegradable: {
    en: "Biodegradable",
    fil: "Nabubulok",
    binColorEn: "Green Bin",
    binColorFil: "Berdeng Basurahan",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    badgeBorder: "border-green-300",
    dotColor: "#15803D",
    examplesEn: "Food scraps, fruit & vegetable peels, dried leaves, garden trimmings, soiled paper.",
    examplesFil: "Tirang pagkain, balat ng prutas at gulay, tuyong dahon, pinagputulan ng halaman.",
    tipsEn: "Drain liquids first. Place in a covered green bin or compost at home.",
    tipsFil: "Patuluin muna ang sabaw. Ilagay sa may takip na berdeng basurahan o i-compost.",
  },
  recyclable: {
    en: "Recyclable",
    fil: "Nareresiklo",
    binColorEn: "Blue Bin",
    binColorFil: "Asul na Basurahan",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    badgeBorder: "border-blue-300",
    dotColor: "#1D4ED8",
    examplesEn: "Clean plastic bottles, tin cans, cardboard boxes, dry paper, glass bottles.",
    examplesFil: "Malinis na boteng plastik, lata, karton, tuyong papel, boteng babasagin.",
    tipsEn: "Rinse, dry, and flatten bottles and cartons before setting out.",
    tipsFil: "Banlawan, patuyuin, at pipiin ang bote at karton bago ilabas.",
  },
  residual: {
    en: "Residual",
    fil: "Di-Nabubulok",
    binColorEn: "Gray Bin",
    binColorFil: "Abong Basurahan",
    badgeBg: "bg-slate-200",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-400",
    dotColor: "#475569",
    examplesEn: "Sachets, snack wrappers, diapers, sanitary napkins, worn-out rags, styrofoam.",
    examplesFil: "Sachet, balat ng chichirya, diaper, napkin, lumang basahan, styrofoam.",
    tipsEn: "Tie bags tightly so trash does not scatter along the street.",
    tipsFil: "Itali nang mahigpit ang supot upang hindi kumalat sa kalsada.",
  },
  special: {
    en: "Special / Hazardous",
    fil: "Espesyal / Mapanganib",
    binColorEn: "Red Bin",
    binColorFil: "Pulang Basurahan",
    badgeBg: "bg-red-100",
    badgeText: "text-red-800",
    badgeBorder: "border-red-300",
    dotColor: "#B91C1C",
    examplesEn: "Batteries, busted light bulbs, expired medicines, paint cans, e-waste, sharp glass.",
    examplesFil: "Baterya, sirang bombilya, lumang gamot, lata ng pintura, e-waste, basag na salamin.",
    tipsEn: "Keep separate in a clearly labeled container. Never mix with household trash.",
    tipsFil: "Ihiwalay sa may malinaw na label na lalagyan. Huwag ihalo sa regular na basura.",
  },
};

const translations = {
  en: {
    appName: "Brgy. San Isidro EcoCollect",
    tagline: "Clean Streets, Clear Schedules, RA 9003 Compliance",
    heroTitle: "Know When & What Waste Will Be Collected in Your Purok",
    heroSubtitle:
      "Check your weekly pickup schedule, follow proper RA 9003 segregation, and report missed collections right from your phone.",
    checkSchedule: "Check This Week's Schedule",
    reportMissed: "Report Missed Pickup",
    login: "Sign In",
    register: "Register Household",
    logout: "Sign Out",
    openPortal: "Open Dashboard",
    home: "Home",
    segregationGuide: "Segregation Guide",
    announcements: "Announcements",
    privacy: "Data Privacy",
    contact: "Contact Us",
    dashboard: "Dashboard",
    schedules: "Schedules",
    routes: "Route Planning",
    collectorMode: "Collector View",
    missedReports: "Missed Pickups",
    compliance: "Segregation Compliance",
    adminPanel: "Management & Exports",
    notifications: "Notifications",
    thisWeekSchedule: "This Week's Collection Schedule",
    selectPurok: "Select Your Purok",
    allPuroks: "All Puroks",
    allWasteTypes: "All Waste Types",
    noSchedulesFound: "No collection schedules found for this selection.",
    ra9003Banner: "In compliance with Republic Act No. 9003 (Ecological Solid Waste Management Act)",
    ra10173Banner: "Protected under the Data Privacy Act of 2012 (RA 10173)",
    todaysCollections: "Today's Collections",
    routeProgress: "Route Progress",
    openReports: "Open Reports",
    complianceRate: "Compliance Rate",
    overdue: "Overdue (>48h)",
    loading: "Loading data...",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    submit: "Submit",
    collected: "Collected",
    skipped: "Skipped",
    blocked: "Blocked",
    pending: "Pending",
    compliant: "Compliant",
    partiallyCompliant: "Partially Compliant",
    nonCompliant: "Non-compliant",
    exportCsv: "Export CSV",
    exportPdf: "Export PDF",
    readOnlyBadge: "Read-Only Official View",
    offlineBanner: "You are offline. Stop updates will be saved and synced automatically once reconnected.",
    syncNow: "Sync Queued Updates",
    queuedUpdates: "Queued Offline Updates",
    distanceEstimateNote: "Estimate based on straight-line distance",
    suggestOrder: "Suggest Order (Nearest-Neighbor)",
    noFinePolicy: "Education & warning notices only — no automatic fines are imposed by this system.",
  },
  fil: {
    appName: "Brgy. San Isidro EcoCollect",
    tagline: "Malinis na Kalsada, Malinaw na Iskedyul, Sunod sa RA 9003",
    heroTitle: "Alamin Kung Kailan at Anong Basura ang Kokolektahin sa Inyong Purok",
    heroSubtitle:
      "Tingnan ang lingguhang iskedyul ng koleksyon, sundin ang tamang pagbubukod ayon sa RA 9003, at mag-ulat ng hindi nakolektang basura gamit ang iyong telepono.",
    checkSchedule: "Tingnan ang Iskedyul Ngayong Linggo",
    reportMissed: "Mag-ulat ng Hindi Nakolekta",
    login: "Mag-login",
    register: "Magparehistro ng Bahay",
    logout: "Mag-logout",
    openPortal: "Buksan ang Dashboard",
    home: "Tahanan",
    segregationGuide: "Gabay sa Pagbubukod",
    announcements: "Mga Anunsyo",
    privacy: "Pagkapribado ng Datos",
    contact: "Makipag-ugnayan",
    dashboard: "Dashboard",
    schedules: "Mga Iskedyul",
    routes: "Plano ng Ruta",
    collectorMode: "Para sa Kolektor",
    missedReports: "Mga Hindi Nakolekta",
    compliance: "Pagsunod sa Pagbubukod",
    adminPanel: "Pamamahala at Export",
    notifications: "Mga Abiso",
    thisWeekSchedule: "Iskedyul ng Koleksyon Ngayong Linggo",
    selectPurok: "Piliin ang Inyong Purok",
    allPuroks: "Lahat ng Purok",
    allWasteTypes: "Lahat ng Uri ng Basura",
    noSchedulesFound: "Walang nakitang iskedyul ng koleksyon para sa napiling filter.",
    ra9003Banner: "Alinsunod sa Republic Act No. 9003 (Ecological Solid Waste Management Act)",
    ra10173Banner: "Protektado ng Data Privacy Act of 2012 (RA 10173)",
    todaysCollections: "Koleksyon Ngayon",
    routeProgress: "Usad ng Ruta",
    openReports: "Bukas na Ulat",
    complianceRate: "Antas ng Pagsunod",
    overdue: "Lampas 48 Oras",
    loading: "Naglo-load ng datos...",
    save: "I-save",
    cancel: "Kanselahin",
    confirm: "Kumpirmahin",
    delete: "Tanggalin",
    edit: "I-edit",
    close: "Isara",
    submit: "Ipasa",
    collected: "Nakolekta",
    skipped: "Nilaktawan",
    blocked: "Harang / Di-Madaanan",
    pending: "Naghihintay",
    compliant: "Sumusunod",
    partiallyCompliant: "Bahagyang Sumusunod",
    nonCompliant: "Hindi Sumusunod",
    exportCsv: "I-export sa CSV",
    exportPdf: "I-export sa PDF",
    readOnlyBadge: "Read-Only na View ng Opisyal",
    offlineBanner: "Ikaw ay offline. Ise-save ang mga update at awtomatikong isi-sync kapag nagka-internet.",
    syncNow: "I-sync Ngayon",
    queuedUpdates: "Nakapilang Offline Updates",
    distanceEstimateNote: "Tantiya batay sa tuwid na distansya (straight-line distance)",
    suggestOrder: "Imungkahi ang Ayos (Nearest-Neighbor)",
    noFinePolicy: "Paalala at babala lamang — walang awtomatikong multa sa sistemang ito.",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations.en[key];
}

export function formatDateStr(dateStr: string, lang: Lang = "en"): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(lang === "fil" ? "fil-PH" : "en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}
