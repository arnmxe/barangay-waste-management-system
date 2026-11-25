import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // resident | collector | admin | official
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description").notNull(),
});

export const puroks = pgTable("puroks", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  zoneLabel: varchar("zone_label", { length: 120 }).notNull(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const households = pgTable(
  "households",
  {
    id: serial("id").primaryKey(),
    householdCode: varchar("household_code", { length: 32 }).notNull().unique(),
    headName: varchar("head_name", { length: 120 }).notNull(),
    address: text("address").notNull(),
    purokId: integer("purok_id")
      .notNull()
      .references(() => puroks.id, { onDelete: "restrict" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    contactNumber: varchar("contact_number", { length: 32 }).notNull().default(""),
    membersCount: integer("members_count").notNull().default(4),
    isRepeatViolator: boolean("is_repeat_violator").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_households_purok").on(table.purokId)]
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    roleCode: varchar("role_code", { length: 32 }).notNull(), // resident | collector | admin | official
    purokId: integer("purok_id").references(() => puroks.id, { onDelete: "set null" }),
    householdId: integer("household_id").references(() => households.id, { onDelete: "set null" }),
    address: text("address").notNull().default(""),
    status: varchar("status", { length: 24 }).notNull().default("pending"), // pending | approved | rejected | suspended
    privacyConsentAt: timestamp("privacy_consent_at"),
    preferredLang: varchar("preferred_lang", { length: 8 }).notNull().default("en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_users_role").on(table.roleCode), index("idx_users_status").on(table.status)]
);

export const userSessions = pgTable("user_sessions", {
  token: varchar("token", { length: 128 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trucks = pgTable("trucks", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  plateNumber: varchar("plate_number", { length: 32 }).notNull().unique(),
  capacityTons: doublePrecision("capacity_tons").notNull().default(4),
  status: varchar("status", { length: 24 }).notNull().default("active"), // active | maintenance | inactive
  assignedDriverId: integer("assigned_driver_id").references(() => users.id, {
    onDelete: "set null",
  }),
  crewNames: text("crew_names").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schedules = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    purokId: integer("purok_id")
      .notNull()
      .references(() => puroks.id, { onDelete: "cascade" }),
    wasteType: varchar("waste_type", { length: 32 }).notNull(), // biodegradable | recyclable | residual | special
    scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(), // YYYY-MM-DD
    startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM
    endTime: varchar("end_time", { length: 5 }).notNull(), // HH:MM
    truckId: integer("truck_id").references(() => trucks.id, { onDelete: "set null" }),
    driverId: integer("driver_id").references(() => users.id, { onDelete: "set null" }),
    crewNames: text("crew_names").notNull().default(""),
    recurrence: varchar("recurrence", { length: 24 }).notNull().default("none"), // none | weekly | biweekly
    recurrenceGroupId: varchar("recurrence_group_id", { length: 64 }),
    status: varchar("status", { length: 24 }).notNull().default("scheduled"), // scheduled | in_progress | completed | delayed | cancelled
    notes: text("notes").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_schedules_date").on(table.scheduledDate),
    index("idx_schedules_purok").on(table.purokId),
  ]
);

export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    scheduleId: integer("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    purokId: integer("purok_id")
      .notNull()
      .references(() => puroks.id, { onDelete: "cascade" }),
    wasteType: varchar("waste_type", { length: 32 }).notNull().default("biodegradable"),
    routeDate: varchar("route_date", { length: 10 }).notNull(), // YYYY-MM-DD
    truckId: integer("truck_id").references(() => trucks.id, { onDelete: "set null" }),
    driverId: integer("driver_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 24 }).notNull().default("planned"), // planned | in_progress | completed
    estimatedDistanceKm: doublePrecision("estimated_distance_km").notNull().default(0),
    distanceNote: text("distance_note")
      .notNull()
      .default("Estimate based on straight-line distance"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_routes_date").on(table.routeDate),
    index("idx_routes_driver").on(table.driverId),
  ]
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    stopOrder: integer("stop_order").notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    address: text("address").notNull(),
    householdId: integer("household_id").references(() => households.id, { onDelete: "set null" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"), // pending | collected | skipped | blocked
    reason: text("reason").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    clientUpdatedAt: timestamp("client_updated_at"),
  },
  (table) => [index("idx_route_stops_route").on(table.routeId)]
);

export const collectionLogs = pgTable(
  "collection_logs",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    routeStopId: integer("route_stop_id")
      .notNull()
      .references(() => routeStops.id, { onDelete: "cascade" }),
    collectorId: integer("collector_id").references(() => users.id, { onDelete: "set null" }),
    actionStatus: varchar("action_status", { length: 24 }).notNull(), // collected | skipped | blocked
    reason: text("reason").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    syncedFromOffline: boolean("synced_from_offline").notNull().default(false),
    loggedAt: timestamp("logged_at").defaultNow().notNull(),
  },
  (table) => [index("idx_collection_logs_route").on(table.routeId)]
);

export const missedReports = pgTable(
  "missed_reports",
  {
    id: serial("id").primaryKey(),
    ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    householdId: integer("household_id").references(() => households.id, { onDelete: "set null" }),
    purokId: integer("purok_id")
      .notNull()
      .references(() => puroks.id, { onDelete: "restrict" }),
    missedDate: varchar("missed_date", { length: 10 }).notNull(), // YYYY-MM-DD
    wasteType: varchar("waste_type", { length: 32 }).notNull(),
    address: text("address").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    notes: text("notes").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    status: varchar("status", { length: 24 }).notNull().default("submitted"), // submitted | verified | assigned | resolved | rejected
    rejectionReason: text("rejection_reason").notNull().default(""),
    assignedCollectorId: integer("assigned_collector_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedTruckId: integer("assigned_truck_id").references(() => trucks.id, {
      onDelete: "set null",
    }),
    residentConfirmed: boolean("resident_confirmed").notNull().default(false),
    residentConfirmedAt: timestamp("resident_confirmed_at"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_missed_reports_resident").on(table.residentId),
    index("idx_missed_reports_status").on(table.status),
  ]
);

export const reportUpdates = pgTable(
  "report_updates",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => missedReports.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 120 }).notNull(),
    authorRole: varchar("author_role", { length: 32 }).notNull(),
    fromStatus: varchar("from_status", { length: 24 }),
    toStatus: varchar("to_status", { length: 24 }),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_report_updates_report").on(table.reportId)]
);

export const complianceRecords = pgTable(
  "compliance_records",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    purokId: integer("purok_id")
      .notNull()
      .references(() => puroks.id, { onDelete: "restrict" }),
    inspectorId: integer("inspector_id").references(() => users.id, { onDelete: "set null" }),
    inspectionDate: varchar("inspection_date", { length: 10 }).notNull(), // YYYY-MM-DD
    wasteType: varchar("waste_type", { length: 32 }).notNull().default("biodegradable"),
    status: varchar("status", { length: 28 }).notNull(), // compliant | partially_compliant | non_compliant
    violationType: varchar("violation_type", { length: 80 }).notNull().default(""),
    notes: text("notes").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    noticeType: varchar("notice_type", { length: 24 }).notNull().default("none"), // none | education | warning
    noticeSentAt: timestamp("notice_sent_at"),
    contested: boolean("contested").notNull().default(false),
    contestReason: text("contest_reason").notNull().default(""),
    contestStatus: varchar("contest_status", { length: 24 }).notNull().default("none"), // none | pending | upheld | dismissed
    contestResponse: text("contest_response").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_compliance_household").on(table.householdId),
    index("idx_compliance_purok").on(table.purokId),
    index("idx_compliance_date").on(table.inspectionDate),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    purokId: integer("purok_id").references(() => puroks.id, { onDelete: "set null" }),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    category: varchar("category", { length: 32 }).notNull().default("system"), // reminder | delay | change | report | compliance | system
    link: varchar("link", { length: 200 }).notNull().default("/app/dashboard"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_notifications_user").on(table.userId)]
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  titleFil: varchar("title_fil", { length: 180 }).notNull().default(""),
  body: text("body").notNull(),
  bodyFil: text("body_fil").notNull().default(""),
  category: varchar("category", { length: 32 }).notNull().default("general"), // general | schedule | advisory | ra9003
  isPinned: boolean("is_pinned").notNull().default(false),
  published: boolean("published").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: varchar("actor_name", { length: 120 }).notNull(),
    actorRole: varchar("actor_role", { length: 32 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 48 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull().default(""),
    summary: text("summary").notNull(),
    detailsJson: text("details_json").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_audit_logs_created").on(table.createdAt)]
);

export const mediaUploads = pgTable("media_uploads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  filename: varchar("filename", { length: 180 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  dataBase64: text("data_base64").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
