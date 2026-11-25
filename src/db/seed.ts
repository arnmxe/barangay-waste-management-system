import { db } from "@/db";
import {
  roles,
  puroks,
  households,
  users,
  trucks,
  schedules,
  routes,
  routeStops,
  collectionLogs,
  missedReports,
  reportUpdates,
  complianceRecords,
  notifications,
  announcements,
  auditLogs,
} from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { computeRouteDistanceKm } from "@/lib/geo";
import { addDaysToDateStr, getTodayDateStr } from "@/lib/i18n";

const globalForSeed = globalThis as typeof globalThis & {
  __brgyEcoSeedPromise?: Promise<void>;
  __brgyEcoSeeded?: boolean;
};

const FICTIONAL_FIRST_NAMES = [
  "Maria", "Jose", "Elena", "Roberto", "Teresita",
  "Danilo", "Lourdes", "Ernesto", "Marites", "Fernando",
  "corazon", "Arturo", "Nelia", "Ramon", "Rowena",
  "Wilfredo", "Evelyn", "Rodrigo", "Ligaya", "Eduardo",
  "Remedios", "Reynaldo", "Susan", "Alfredo", "Perla",
  "Vicente", "Gloria", "Jaime", "Arlene", "Oscar",
  "Imelda", "Cesar", "Jocelyn", "Rolando", "Norma",
  "Mario", "Fe", "Benjamin", "Clarissa", "Armando",
  "Leticia", "Orlando", "Digna", "Ruben", "Alma",
  "Virgilio", "Estrella", "Hector", "Mila", "Conrado",
];

const FICTIONAL_LAST_NAMES = [
  "Cruz", "Santos", "Reyes", "Bautista", "Ocampo",
  "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos",
  "Castro", "Rivera", "Aquino", "Del Rosario", "Navarro",
  "Salazar", "Morales", "Flores", "De Guzman", "Pascual",
  "Mercado", "Velasco", "Santiago", "Soriano", "Dizon",
];

const PUROK_STREETS: Record<string, string[]> = {
  "PRK-1": ["Sampaguita St.", "Rosal Alley", "Gumamela Rd."],
  "PRK-2": ["Narra Ave.", "Riverside Walk", "Kawayan St."],
  "PRK-3": ["Molave St.", "Palengke Rd.", "Mabini Ext."],
  "PRK-4": ["Acacia Drive", "Banaba Lane", "Kamagong St."],
  "PRK-5": ["Mahogany Rd.", "South Highway Service Rd.", "Yakal St."],
};

async function runSeed(): Promise<void> {
  const existingRoles = await db.select({ total: count() }).from(roles);
  if ((existingRoles[0]?.total ?? 0) > 0) {
    globalForSeed.__brgyEcoSeeded = true;
    return;
  }

  console.log("Seeding Barangay San Isidro Waste Collection database...");

  // 1. Roles
  const insertedRoles = await db
    .insert(roles)
    .values([
      {
        code: "resident",
        name: "Resident",
        description: "Household resident with access to own schedule, missed pickup reports, and compliance history.",
      },
      {
        code: "collector",
        name: "Collector / Driver",
        description: "Collection crew member with access to assigned routes and field inspection logging.",
      },
      {
        code: "admin",
        name: "Barangay Admin",
        description: "Barangay waste management officer managing schedules, routes, reports, users, and announcements.",
      },
      {
        code: "official",
        name: "Barangay Captain / Official",
        description: "Read-only executive oversight for dashboards, compliance metrics, audit logs, and reports.",
      },
    ])
    .returning();

  const roleMap = new Map(insertedRoles.map((r) => [r.code, r.id]));

  // 2. 5 Puroks around Barangay San Isidro, Malolos, Bulacan
  const insertedPuroks = await db
    .insert(puroks)
    .values([
      {
        code: "PRK-1",
        name: "Purok 1 – Sampaguita",
        zoneLabel: "North Poblacion",
        centerLat: 14.8468,
        centerLng: 120.8104,
        description: "Residential blocks north of Barangay Hall and elementary school.",
      },
      {
        code: "PRK-2",
        name: "Purok 2 – Narra",
        zoneLabel: "East Riverside",
        centerLat: 14.8445,
        centerLng: 120.8158,
        description: "Riverside residential lanes with narrow alley access points.",
      },
      {
        code: "PRK-3",
        name: "Purok 3 – Molave",
        zoneLabel: "Central Market",
        centerLat: 14.8428,
        centerLng: 120.8118,
        description: "Mixed residential and talipapa market zone with high biodegradable volume.",
      },
      {
        code: "PRK-4",
        name: "Purok 4 – Acacia",
        zoneLabel: "West Subdivision",
        centerLat: 14.8419,
        centerLng: 120.8066,
        description: "Subdivision streets and duplex homes west of Rizal Street.",
      },
      {
        code: "PRK-5",
        name: "Purok 5 – Mahogany",
        zoneLabel: "South Highway",
        centerLat: 14.8388,
        centerLng: 120.8129,
        description: "Southern residences along the barangay service road.",
      },
    ])
    .returning();

  // 3. 50 Households (10 per Purok)
  const householdValues = [];
  let hhCounter = 0;
  for (let pIdx = 0; pIdx < insertedPuroks.length; pIdx++) {
    const p = insertedPuroks[pIdx];
    const streets = PUROK_STREETS[p.code] ?? ["Main St."];
    for (let i = 0; i < 10; i++) {
      const idx = hhCounter++;
      const rawFirst = FICTIONAL_FIRST_NAMES[idx % FICTIONAL_FIRST_NAMES.length];
      const first = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
      const last = FICTIONAL_LAST_NAMES[(idx * 3 + pIdx) % FICTIONAL_LAST_NAMES.length];
      const street = streets[i % streets.length];
      const houseNo = 10 + i * 4 + pIdx;
      const latOffset = ((i % 5) - 2) * 0.00055 + (i >= 5 ? 0.00028 : -0.0002);
      const lngOffset = (Math.floor(i / 2) - 2) * 0.00062 + (i % 2 === 0 ? -0.00025 : 0.0003);
      householdValues.push({
        householdCode: `HH-${p.code.replace("PRK-", "P")}-${String(i + 1).padStart(3, "0")}`,
        headName: `${first} ${last}`,
        address: `No. ${houseNo} ${street}, ${p.name}`,
        purokId: p.id,
        lat: Number((p.centerLat + latOffset).toFixed(6)),
        lng: Number((p.centerLng + lngOffset).toFixed(6)),
        contactNumber: `0917-400-${String(1000 + idx).slice(-4)}`,
        membersCount: 3 + (idx % 4),
        isRepeatViolator: false,
      });
    }
  }
  const insertedHouseholds = await db.insert(households).values(householdValues).returning();

  // 4. Demo Users (all fictional) — shared demo password: Password123!
  const demoPasswordHash = hashPassword("Password123!");
  const now = new Date();

  const insertedUsers = await db
    .insert(users)
    .values([
      {
        fullName: "Elena Villanueva",
        email: "admin@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-555-0101",
        roleId: roleMap.get("admin")!,
        roleCode: "admin",
        purokId: insertedPuroks[2].id,
        address: "Barangay San Isidro Hall, Purok 3",
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Punong Brgy. Roberto Bautista",
        email: "captain@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-555-0102",
        roleId: roleMap.get("official")!,
        roleCode: "official",
        purokId: insertedPuroks[0].id,
        address: "Barangay San Isidro Hall, Rizal St.",
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Rico Santos",
        email: "rico.santos@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-555-0103",
        roleId: roleMap.get("collector")!,
        roleCode: "collector",
        purokId: insertedPuroks[0].id,
        address: "MRF Depot, Purok 3 – Molave",
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Nestor Mendoza",
        email: "nestor.mendoza@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-555-0104",
        roleId: roleMap.get("collector")!,
        roleCode: "collector",
        purokId: insertedPuroks[1].id,
        address: "MRF Depot, Purok 3 – Molave",
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Maria Cruz",
        email: "maria.cruz@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-400-1000",
        roleId: roleMap.get("resident")!,
        roleCode: "resident",
        purokId: insertedPuroks[0].id,
        householdId: insertedHouseholds[0].id,
        address: insertedHouseholds[0].address,
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Danilo Torres",
        email: "danilo.torres@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-400-1012",
        roleId: roleMap.get("resident")!,
        roleCode: "resident",
        purokId: insertedPuroks[1].id,
        householdId: insertedHouseholds[12].id,
        address: insertedHouseholds[12].address,
        status: "approved",
        privacyConsentAt: now,
        preferredLang: "en",
      },
      {
        fullName: "Clarissa Aquino",
        email: "pending.resident@sanisidro.ph",
        passwordHash: demoPasswordHash,
        phone: "0917-400-1099",
        roleId: roleMap.get("resident")!,
        roleCode: "resident",
        purokId: insertedPuroks[3].id,
        address: "No. 48 Acacia Drive, Purok 4 – Acacia",
        status: "pending",
        privacyConsentAt: now,
        preferredLang: "en",
      },
    ])
    .returning();

  const adminUser = insertedUsers.find((u) => u.email === "admin@sanisidro.ph")!;
  const collector1 = insertedUsers.find((u) => u.email === "rico.santos@sanisidro.ph")!;
  const collector2 = insertedUsers.find((u) => u.email === "nestor.mendoza@sanisidro.ph")!;
  const resident1 = insertedUsers.find((u) => u.email === "maria.cruz@sanisidro.ph")!;
  const resident2 = insertedUsers.find((u) => u.email === "danilo.torres@sanisidro.ph")!;

  // 5. 2 Trucks
  const insertedTrucks = await db
    .insert(trucks)
    .values([
      {
        code: "TRK-01",
        name: "Eco-Hauler 1 (Compactor)",
        plateNumber: "SGF-412",
        capacityTons: 6,
        status: "active",
        assignedDriverId: collector1.id,
        crewNames: "Rico Santos (Driver), Jun Ramos, Carlo Dizon",
      },
      {
        code: "TRK-02",
        name: "Eco-Hauler 2 (Mini-Dump)",
        plateNumber: "SGF-819",
        capacityTons: 4,
        status: "active",
        assignedDriverId: collector2.id,
        crewNames: "Nestor Mendoza (Driver), Paulo Rivera, Mark Flores",
      },
    ])
    .returning();

  const truck1 = insertedTrucks[0];
  const truck2 = insertedTrucks[1];

  // 6. 1 Full Month of Collection Schedules (past 10 days through next 21 days = 32 days)
  const todayStr = getTodayDateStr();
  const scheduleValues = [];

  for (let offset = -10; offset <= 21; offset++) {
    const dateStr = addDaysToDateStr(todayStr, offset);
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat

    if (dayOfWeek === 0) {
      // Sunday: Special/Hazardous on first/third Sundays only for Purok 3 MRF drop-off
      if (d <= 7 || (d >= 15 && d <= 21)) {
        scheduleValues.push({
          title: "Special / Hazardous Waste Collection",
          purokId: insertedPuroks[2].id,
          wasteType: "special",
          scheduledDate: dateStr,
          startTime: "08:00",
          endTime: "10:30",
          truckId: truck2.id,
          driverId: collector2.id,
          crewNames: truck2.crewNames,
          recurrence: "biweekly",
          recurrenceGroupId: "rec-special-p3",
          status: offset < 0 ? "completed" : "scheduled",
          notes: "Bring labeled batteries, bulbs, and e-waste to designated corners.",
          createdBy: adminUser.id,
        });
      }
      continue;
    }

    // Morning shift Truck 1 & Truck 2 with zero double-booking!
    const morningPlan: Record<
      number,
      Array<{
        purokIdx: number;
        wasteType: string;
        truck: typeof truck1;
        driver: typeof collector1;
        start: string;
        end: string;
      }>
    > = {
      1: [
        { purokIdx: 0, wasteType: "biodegradable", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 1, wasteType: "biodegradable", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
        { purokIdx: 2, wasteType: "biodegradable", truck: truck1, driver: collector1, start: "08:30", end: "10:30" },
      ],
      2: [
        { purokIdx: 3, wasteType: "biodegradable", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 4, wasteType: "biodegradable", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
      ],
      3: [
        { purokIdx: 0, wasteType: "recyclable", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 1, wasteType: "recyclable", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
        { purokIdx: 2, wasteType: "recyclable", truck: truck1, driver: collector1, start: "08:30", end: "10:30" },
      ],
      4: [
        { purokIdx: 3, wasteType: "recyclable", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 4, wasteType: "recyclable", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
      ],
      5: [
        { purokIdx: 0, wasteType: "residual", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 1, wasteType: "residual", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
        { purokIdx: 2, wasteType: "residual", truck: truck1, driver: collector1, start: "08:30", end: "10:30" },
      ],
      6: [
        { purokIdx: 3, wasteType: "residual", truck: truck1, driver: collector1, start: "06:00", end: "08:00" },
        { purokIdx: 4, wasteType: "residual", truck: truck2, driver: collector2, start: "06:30", end: "08:30" },
        { purokIdx: 0, wasteType: "special", truck: truck2, driver: collector2, start: "09:00", end: "11:00" },
      ],
    };

    const items = morningPlan[dayOfWeek] ?? [];
    for (const item of items) {
      const p = insertedPuroks[item.purokIdx];
      const labelMap: Record<string, string> = {
        biodegradable: "Biodegradable Collection",
        recyclable: "Recyclable Collection",
        residual: "Residual Collection",
        special: "Special / Hazardous Pickup",
      };
      scheduleValues.push({
        title: `${labelMap[item.wasteType]} – ${p.name}`,
        purokId: p.id,
        wasteType: item.wasteType,
        scheduledDate: dateStr,
        startTime: item.start,
        endTime: item.end,
        truckId: item.truck.id,
        driverId: item.driver.id,
        crewNames: item.truck.crewNames,
        recurrence: "weekly",
        recurrenceGroupId: `rec-${item.purokIdx}-${item.wasteType}`,
        status: offset < 0 ? "completed" : offset === 0 ? "in_progress" : "scheduled",
        notes: "Please set out segregated bins 15 minutes before pickup time.",
        createdBy: adminUser.id,
      });
    }
  }

  // Ensure TODAY always has at least two schedules (even if today is Sunday!)
  const todaySchedules = scheduleValues.filter((s) => s.scheduledDate === todayStr);
  if (todaySchedules.length < 2) {
    scheduleValues.push(
      {
        title: `Biodegradable Collection – ${insertedPuroks[0].name}`,
        purokId: insertedPuroks[0].id,
        wasteType: "biodegradable",
        scheduledDate: todayStr,
        startTime: "06:00",
        endTime: "08:00",
        truckId: truck1.id,
        driverId: collector1.id,
        crewNames: truck1.crewNames,
        recurrence: "weekly",
        recurrenceGroupId: "rec-today-p1",
        status: "in_progress",
        notes: "Morning biodegradable sweep for Purok 1.",
        createdBy: adminUser.id,
      },
      {
        title: `Recyclable Collection – ${insertedPuroks[1].name}`,
        purokId: insertedPuroks[1].id,
        wasteType: "recyclable",
        scheduledDate: todayStr,
        startTime: "07:00",
        endTime: "09:00",
        truckId: truck2.id,
        driverId: collector2.id,
        crewNames: truck2.crewNames,
        recurrence: "weekly",
        recurrenceGroupId: "rec-today-p2",
        status: "scheduled",
        notes: "Clean and flattened recyclables only.",
        createdBy: adminUser.id,
      }
    );
  }

  const insertedSchedules = await db.insert(schedules).values(scheduleValues).returning();
  const todaySched1 = insertedSchedules.find(
    (s) => s.scheduledDate === todayStr && s.driverId === collector1.id
  ) ?? insertedSchedules[0];
  const todaySched2 = insertedSchedules.find(
    (s) => s.scheduledDate === todayStr && s.driverId === collector2.id
  ) ?? insertedSchedules[1];

  // 7. Sample Routes & Stops
  const p1Households = insertedHouseholds.filter((h) => h.purokId === insertedPuroks[0].id).slice(0, 6);
  const p2Households = insertedHouseholds.filter((h) => h.purokId === insertedPuroks[1].id).slice(0, 5);
  const p3Households = insertedHouseholds.filter((h) => h.purokId === insertedPuroks[2].id).slice(0, 5);

  const dist1 = computeRouteDistanceKm(p1Households, true);
  const dist2 = computeRouteDistanceKm(p2Households, true);
  const dist3 = computeRouteDistanceKm(p3Households, true);

  const insertedRoutes = await db
    .insert(routes)
    .values([
      {
        name: "Morning Route A – Purok 1 Sampaguita",
        scheduleId: todaySched1?.id ?? null,
        purokId: insertedPuroks[0].id,
        wasteType: todaySched1?.wasteType ?? "biodegradable",
        routeDate: todayStr,
        truckId: truck1.id,
        driverId: collector1.id,
        status: "in_progress",
        estimatedDistanceKm: dist1,
        distanceNote: "Estimate based on straight-line distance",
        startedAt: new Date(Date.now() - 1000 * 60 * 45),
        createdBy: adminUser.id,
      },
      {
        name: "Morning Route B – Purok 2 Narra Riverside",
        scheduleId: todaySched2?.id ?? null,
        purokId: insertedPuroks[1].id,
        wasteType: todaySched2?.wasteType ?? "recyclable",
        routeDate: todayStr,
        truckId: truck2.id,
        driverId: collector2.id,
        status: "planned",
        estimatedDistanceKm: dist2,
        distanceNote: "Estimate based on straight-line distance",
        createdBy: adminUser.id,
      },
      {
        name: "Yesterday Route – Purok 3 Central Market",
        scheduleId: null,
        purokId: insertedPuroks[2].id,
        wasteType: "biodegradable",
        routeDate: addDaysToDateStr(todayStr, -1),
        truckId: truck1.id,
        driverId: collector1.id,
        status: "completed",
        estimatedDistanceKm: dist3,
        distanceNote: "Estimate based on straight-line distance",
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        createdBy: adminUser.id,
      },
    ])
    .returning();

  const route1 = insertedRoutes[0];
  const route2 = insertedRoutes[1];
  const route3 = insertedRoutes[2];

  const r1Stops = await db
    .insert(routeStops)
    .values(
      p1Households.map((h, i) => ({
        routeId: route1.id,
        stopOrder: i + 1,
        label: `${h.householdCode} – ${h.headName}`,
        address: h.address,
        householdId: h.id,
        lat: h.lat,
        lng: h.lng,
        status: i < 2 ? "collected" : i === 2 ? "skipped" : "pending",
        reason: i === 2 ? "No bins placed outside gate" : "",
        updatedBy: i < 3 ? collector1.id : null,
        updatedAt: i < 3 ? new Date(Date.now() - (30 - i * 8) * 60 * 1000) : now,
      }))
    )
    .returning();

  await db.insert(routeStops).values(
    p2Households.map((h, i) => ({
      routeId: route2.id,
      stopOrder: i + 1,
      label: `${h.householdCode} – ${h.headName}`,
      address: h.address,
      householdId: h.id,
      lat: h.lat,
      lng: h.lng,
      status: "pending",
      reason: "",
    }))
  );

  const r3Stops = await db
    .insert(routeStops)
    .values(
      p3Households.map((h, i) => ({
        routeId: route3.id,
        stopOrder: i + 1,
        label: `${h.householdCode} – ${h.headName}`,
        address: h.address,
        householdId: h.id,
        lat: h.lat,
        lng: h.lng,
        status: "collected",
        reason: "",
        updatedBy: collector1.id,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      }))
    )
    .returning();

  // Collection Logs
  await db.insert(collectionLogs).values([
    ...r1Stops.slice(0, 3).map((s) => ({
      routeId: route1.id,
      routeStopId: s.id,
      collectorId: collector1.id,
      actionStatus: s.status,
      reason: s.reason,
      lat: s.lat,
      lng: s.lng,
      syncedFromOffline: false,
      loggedAt: s.updatedAt,
    })),
    ...r3Stops.map((s) => ({
      routeId: route3.id,
      routeStopId: s.id,
      collectorId: collector1.id,
      actionStatus: "collected",
      reason: "",
      lat: s.lat,
      lng: s.lng,
      syncedFromOffline: false,
      loggedAt: s.updatedAt,
    })),
  ]);

  // 8. Missed Pickup Reports (including an overdue >48h report!)
  const dateCompact = todayStr.replace(/-/g, "");
  const insertedReports = await db
    .insert(missedReports)
    .values([
      {
        ticketNumber: `MPR-${dateCompact}-1001`,
        residentId: resident1.id,
        householdId: insertedHouseholds[0].id,
        purokId: insertedPuroks[0].id,
        missedDate: addDaysToDateStr(todayStr, -3),
        wasteType: "recyclable",
        address: insertedHouseholds[0].address,
        lat: insertedHouseholds[0].lat,
        lng: insertedHouseholds[0].lng,
        notes: "Two blue recyclable bags were placed outside by 5:45 AM but truck skipped our alley due to a parked delivery van.",
        status: "verified",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60), // 60 hours ago -> Overdue (>48h)
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 40),
      },
      {
        ticketNumber: `MPR-${dateCompact}-1002`,
        residentId: resident2.id,
        householdId: insertedHouseholds[12].id,
        purokId: insertedPuroks[1].id,
        missedDate: addDaysToDateStr(todayStr, -1),
        wasteType: "biodegradable",
        address: insertedHouseholds[12].address,
        lat: insertedHouseholds[12].lat,
        lng: insertedHouseholds[12].lng,
        notes: "Green bin at corner of Riverside Walk was not picked up yesterday morning.",
        status: "assigned",
        assignedCollectorId: collector2.id,
        assignedTruckId: truck2.id,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
      },
      {
        ticketNumber: `MPR-${dateCompact}-1003`,
        residentId: resident1.id,
        householdId: insertedHouseholds[0].id,
        purokId: insertedPuroks[0].id,
        missedDate: addDaysToDateStr(todayStr, -6),
        wasteType: "residual",
        address: insertedHouseholds[0].address,
        lat: insertedHouseholds[0].lat,
        lng: insertedHouseholds[0].lng,
        notes: "Residual sacks left beside the lamp post were missed during heavy rain.",
        status: "resolved",
        assignedCollectorId: collector1.id,
        assignedTruckId: truck1.id,
        residentConfirmed: false,
        resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      },
      {
        ticketNumber: `MPR-${dateCompact}-1004`,
        residentId: resident2.id,
        householdId: insertedHouseholds[12].id,
        purokId: insertedPuroks[1].id,
        missedDate: addDaysToDateStr(todayStr, -8),
        wasteType: "special",
        address: insertedHouseholds[12].address,
        lat: insertedHouseholds[12].lat,
        lng: insertedHouseholds[12].lng,
        notes: "Requested pickup of construction debris.",
        status: "rejected",
        rejectionReason: "Construction rubble is excluded from regular household special waste pickup. Please coordinate a barangay hauling permit at the Hall.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 180),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 165),
      },
    ])
    .returning();

  await db.insert(reportUpdates).values([
    {
      reportId: insertedReports[0].id,
      authorId: resident1.id,
      authorName: resident1.fullName,
      authorRole: "resident",
      fromStatus: null,
      toStatus: "submitted",
      comment: "Report submitted with location pin on Sampaguita St.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60),
    },
    {
      reportId: insertedReports[0].id,
      authorId: adminUser.id,
      authorName: adminUser.fullName,
      authorRole: "admin",
      fromStatus: "submitted",
      toStatus: "verified",
      comment: "Verified against Route A GPS log. Scheduling makeup pickup shortly.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40),
    },
    {
      reportId: insertedReports[1].id,
      authorId: resident2.id,
      authorName: resident2.fullName,
      authorRole: "resident",
      fromStatus: null,
      toStatus: "submitted",
      comment: "Missed biodegradable bin reported.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    },
    {
      reportId: insertedReports[1].id,
      authorId: adminUser.id,
      authorName: adminUser.fullName,
      authorRole: "admin",
      fromStatus: "submitted",
      toStatus: "assigned",
      comment: "Assigned to Eco-Hauler 2 (Driver Nestor Mendoza) for today's sweep.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
    },
    {
      reportId: insertedReports[2].id,
      authorId: adminUser.id,
      authorName: adminUser.fullName,
      authorRole: "admin",
      fromStatus: "assigned",
      toStatus: "resolved",
      comment: "Makeup truck collected the residual bags. Awaiting resident confirmation.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    },
  ]);

  // 9. Compliance Records across last 5 months for rich trends & repeat violator flags
  const complianceValues = [];
  const violationTypes = [
    "Mixed biodegradable & residual waste",
    "Unclean/unrinsed recyclables",
    "Unlabeled hazardous/special items",
    "Improper open container / loose trash",
  ];
  const repeatViolatorIndices = [4, 15, 23, 36];

  for (let mOffset = 4; mOffset >= 0; mOffset--) {
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - mOffset);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, "0");

    for (let pIdx = 0; pIdx < 5; pIdx++) {
      for (let slot = 0; slot < 4; slot++) {
        const hhIdx = pIdx * 10 + ((slot * 2 + mOffset) % 10);
        const hh = insertedHouseholds[hhIdx];
        const day = String(Math.min(25, 3 + slot * 5 + pIdx)).padStart(2, "0");
        const inspDate = `${y}-${m}-${day}`;

        // Improving compliance over time (higher compliance in recent months)
        const roll = (hhIdx * 7 + mOffset * 11 + slot * 5) % 10;
        let status: "compliant" | "partially_compliant" | "non_compliant" = "compliant";
        if (repeatViolatorIndices.includes(hhIdx)) {
          status = "non_compliant";
        } else if (roll < 1 + Math.floor(mOffset / 2)) {
          status = "non_compliant";
        } else if (roll < 3) {
          status = "partially_compliant";
        }

        const violationType =
          status === "compliant"
            ? ""
            : violationTypes[(hhIdx + mOffset) % violationTypes.length];

        complianceValues.push({
          householdId: hh.id,
          purokId: hh.purokId,
          inspectorId: pIdx % 2 === 0 ? collector1.id : collector2.id,
          inspectionDate: inspDate,
          wasteType: ["biodegradable", "recyclable", "residual"][(slot + pIdx) % 3],
          status,
          violationType,
          notes:
            status === "compliant"
              ? "Bins properly separated and labeled per RA 9003."
              : "Household advised on RA 9003 color-coded bin separation.",
          noticeType:
            status === "non_compliant"
              ? "warning"
              : status === "partially_compliant"
              ? "education"
              : "none",
          noticeSentAt: status === "compliant" ? null : now,
          contested: false,
          contestReason: "",
          contestStatus: "none",
          contestResponse: "",
        });
      }
    }
  }

  // Ensure Maria Cruz (household 0) has both compliant and one partially-compliant record so resident can view & contest
  complianceValues.push(
    {
      householdId: insertedHouseholds[0].id,
      purokId: insertedHouseholds[0].purokId,
      inspectorId: collector1.id,
      inspectionDate: addDaysToDateStr(todayStr, -2),
      wasteType: "biodegradable",
      status: "compliant",
      violationType: "",
      notes: "Clean green biodegradable bin with lid.",
      noticeType: "none",
      noticeSentAt: null,
      contested: false,
      contestReason: "",
      contestStatus: "none",
      contestResponse: "",
    },
    {
      householdId: insertedHouseholds[0].id,
      purokId: insertedHouseholds[0].purokId,
      inspectorId: collector1.id,
      inspectionDate: addDaysToDateStr(todayStr, -9),
      wasteType: "recyclable",
      status: "partially_compliant",
      violationType: "Unclean/unrinsed recyclables",
      notes: "A few beverage bottles still had liquid inside. Friendly education flyer provided.",
      noticeType: "education",
      noticeSentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9),
      contested: false,
      contestReason: "",
      contestStatus: "none",
      contestResponse: "",
    },
    // One contested record from Danilo Torres for Admin review
    {
      householdId: insertedHouseholds[12].id,
      purokId: insertedHouseholds[12].purokId,
      inspectorId: collector2.id,
      inspectionDate: addDaysToDateStr(todayStr, -4),
      wasteType: "residual",
      status: "non_compliant",
      violationType: "Mixed biodegradable & residual waste",
      notes: "Mixed kitchen scraps spotted in gray residual bag.",
      noticeType: "warning",
      noticeSentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      contested: true,
      contestReason: "The mixed bag beside our gate belonged to a neighboring construction crew, not our household. Our gray bin was sealed inside our fence.",
      contestStatus: "pending",
      contestResponse: "",
    }
  );

  await db.insert(complianceRecords).values(complianceValues);

  // Flag repeat violator households (>= 2 non_compliant records)
  const violCounts = new Map<number, number>();
  for (const rec of complianceValues) {
    if (rec.status === "non_compliant") {
      violCounts.set(rec.householdId, (violCounts.get(rec.householdId) ?? 0) + 1);
    }
  }
  for (const [hhId, cnt] of violCounts.entries()) {
    if (cnt >= 2) {
      await db
        .update(households)
        .set({ isRepeatViolator: true })
        .where(eq(households.id, hhId));
    }
  }

  // 10. Announcements (EN & FIL)
  await db.insert(announcements).values([
    {
      title: "Strict 'No Segregation, No Collection' Policy Under RA 9003",
      titleFil: "Mahigpit na Patakarang 'Walang Pagbubukod, Walang Koleksyon' (RA 9003)",
      body: "Beginning this month, all 5 puroks in Barangay San Isidro will use our 4-color bin system: Green (Biodegradable), Blue (Recyclable), Gray (Residual), and Red (Special/Hazardous). Education notices will be issued to assist households.",
      bodyFil: "Simula ngayong buwan, gagamitin sa lahat ng 5 purok ng Barangay San Isidro ang 4-kulay na basurahan: Berde (Nabubulok), Asul (Nareresiklo), Abo (Di-Nabubulok), at Pula (Espesyal/Mapanganib). Magbibigay ng paalala at gabay para matulungan ang bawat tahanan.",
      category: "ra9003",
      isPinned: true,
      published: true,
      createdBy: adminUser.id,
    },
    {
      title: "Bi-Weekly Special & Hazardous Waste Drop-off at Barangay MRF",
      titleFil: "Koleksyon ng Espesyal at Mapanganib na Basura sa Barangay MRF",
      body: "Keep used batteries, busted bulbs, expired medicine, and small electronics out of regular trash. Eco-Hauler 2 conducts scheduled pickups every 1st and 3rd Sunday from 8:00 AM to 10:30 AM.",
      bodyFil: "Ihiwalay ang lumang baterya, sirang bombilya, lumang gamot, at sirang electronics. May nakatakdang koleksyon ang Eco-Hauler 2 tuwing ika-1 at ika-3 Linggo, 8:00 AM – 10:30 AM.",
      category: "schedule",
      isPinned: false,
      published: true,
      createdBy: adminUser.id,
    },
    {
      title: "Rainy Season Advisory: Tie Waste Bags Securely",
      titleFil: "Paalala sa Tag-ulan: Itali nang Mahigpit ang mga Supot ng Basura",
      body: "To prevent clogged drainage canals across Purok 2 Riverside and Purok 3 Market, please keep bins covered and bring waste out 15 minutes before truck arrival.",
      bodyFil: "Upang maiwasan ang baradong kanal sa Purok 2 Riverside at Purok 3 Palengke, takpan ang mga basurahan at ilabas ito 15 minuto bago dumating ang trak.",
      category: "advisory",
      isPinned: false,
      published: true,
      createdBy: adminUser.id,
    },
  ]);

  // 11. Initial Notifications
  await db.insert(notifications).values([
    {
      userId: resident1.id,
      purokId: insertedPuroks[0].id,
      title: "Collection Today in Purok 1 – Sampaguita",
      message: "Eco-Hauler 1 is scheduled for pickup in your purok today. Please set out your segregated bins on time.",
      category: "reminder",
      link: "/app/schedules",
      isRead: false,
    },
    {
      userId: resident1.id,
      purokId: insertedPuroks[0].id,
      title: "Missed Pickup Ticket Resolved – Please Confirm",
      message: `Ticket ${insertedReports[2].ticketNumber} has been marked resolved by Barangay Admin. Please confirm if your trash was picked up.`,
      category: "report",
      link: "/app/reports",
      isRead: false,
    },
    {
      userId: collector1.id,
      purokId: insertedPuroks[0].id,
      title: "Assigned Route Ready: Morning Route A",
      message: "You have 3 remaining pending stops on Morning Route A – Purok 1 Sampaguita.",
      category: "reminder",
      link: "/app/collector",
      isRead: false,
    },
    {
      userId: adminUser.id,
      title: "1 Pending Resident Registration",
      message: "Clarissa Aquino (Purok 4 – Acacia) registered and is waiting for barangay approval.",
      category: "system",
      link: "/app/admin",
      isRead: false,
    },
    {
      userId: adminUser.id,
      title: "Overdue Missed Pickup Alert (>48h)",
      message: `Ticket ${insertedReports[0].ticketNumber} in Purok 1 has been open for over 48 hours.`,
      category: "report",
      link: "/app/reports",
      isRead: false,
    },
  ]);

  // 12. Initial Audit Logs
  await db.insert(auditLogs).values([
    {
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: "admin",
      action: "CREATE_SCHEDULE_BATCH",
      entityType: "schedule",
      entityId: "monthly",
      summary: "Published 1-month recurring waste collection schedules across 5 puroks.",
      detailsJson: JSON.stringify({ puroks: 5, trucks: 2 }),
    },
    {
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: "admin",
      action: "CREATE_ROUTE",
      entityType: "route",
      entityId: String(route1.id),
      summary: "Assigned Morning Route A – Purok 1 Sampaguita to Eco-Hauler 1 (Rico Santos).",
      detailsJson: JSON.stringify({ stops: p1Households.length, estimatedDistanceKm: dist1 }),
    },
    {
      actorId: collector1.id,
      actorName: collector1.fullName,
      actorRole: "collector",
      action: "UPDATE_STOP_STATUS",
      entityType: "route_stop",
      entityId: String(r1Stops[0].id),
      summary: "Marked stop HH-P1-001 as Collected on Morning Route A.",
      detailsJson: JSON.stringify({ status: "collected" }),
    },
  ]);

  globalForSeed.__brgyEcoSeeded = true;
  console.log("Seeding complete!");
}

export async function ensureSeeded(): Promise<void> {
  if (globalForSeed.__brgyEcoSeeded) return;
  if (!globalForSeed.__brgyEcoSeedPromise) {
    globalForSeed.__brgyEcoSeedPromise = runSeed().catch((err) => {
      globalForSeed.__brgyEcoSeedPromise = undefined;
      console.error("Seed error:", err);
      throw err;
    });
  }
  await globalForSeed.__brgyEcoSeedPromise;
}
