import { db } from "@/db";
import {
  users,
  roles,
  puroks,
  households,
  trucks,
  announcements,
  auditLogs,
} from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { logAudit, notifyUser } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  // Both Admin and Captain/Official can view management tables & audit logs (Captain is strictly read-only on mutations)
  const auth = await requireAuth(["admin", "official"]);
  if (!auth.ok) return auth.response;

  try {
    const [
      allUsers,
      allRoles,
      allPuroks,
      allHouseholds,
      allTrucks,
      allAnnouncements,
      recentAuditLogs,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          roleCode: users.roleCode,
          purokId: users.purokId,
          purokName: puroks.name,
          householdId: users.householdId,
          address: users.address,
          status: users.status,
          privacyConsentAt: users.privacyConsentAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(puroks, eq(users.purokId, puroks.id))
        .orderBy(desc(users.createdAt)),
      db.select().from(roles),
      db.select().from(puroks).orderBy(asc(puroks.code)),
      db
        .select({
          id: households.id,
          householdCode: households.householdCode,
          headName: households.headName,
          address: households.address,
          purokId: households.purokId,
          purokName: puroks.name,
          lat: households.lat,
          lng: households.lng,
          contactNumber: households.contactNumber,
          membersCount: households.membersCount,
          isRepeatViolator: households.isRepeatViolator,
        })
        .from(households)
        .innerJoin(puroks, eq(households.purokId, puroks.id))
        .orderBy(asc(households.householdCode)),
      db
        .select({
          id: trucks.id,
          code: trucks.code,
          name: trucks.name,
          plateNumber: trucks.plateNumber,
          capacityTons: trucks.capacityTons,
          status: trucks.status,
          assignedDriverId: trucks.assignedDriverId,
          driverName: users.fullName,
          crewNames: trucks.crewNames,
        })
        .from(trucks)
        .leftJoin(users, eq(trucks.assignedDriverId, users.id))
        .orderBy(asc(trucks.code)),
      db.select().from(announcements).orderBy(desc(announcements.isPinned), desc(announcements.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
    ]);

    return Response.json({
      users: allUsers,
      roles: allRoles,
      puroks: allPuroks,
      households: allHouseholds,
      trucks: allTrucks,
      announcements: allAnnouncements,
      auditLogs: recentAuditLogs,
    });
  } catch (err) {
    console.error("GET admin manage error:", err);
    return Response.json({ error: "Failed to load management data." }, { status: 500 });
  }
}

const createEntitySchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("purok"),
    code: z.string().trim().min(2).max(24),
    name: z.string().trim().min(3).max(120),
    zoneLabel: z.string().trim().min(2).max(120),
    centerLat: z.coerce.number().min(-90).max(90),
    centerLng: z.coerce.number().min(-180).max(180),
    description: z.string().trim().max(400).optional().default(""),
  }),
  z.object({
    entity: z.literal("household"),
    householdCode: z.string().trim().min(3).max(32),
    headName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(5).max(300),
    purokId: z.coerce.number().int().positive(),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    contactNumber: z.string().trim().max(32).optional().default(""),
    membersCount: z.coerce.number().int().min(1).max(30).optional().default(4),
  }),
  z.object({
    entity: z.literal("truck"),
    code: z.string().trim().min(2).max(32),
    name: z.string().trim().min(3).max(100),
    plateNumber: z.string().trim().min(3).max(32),
    capacityTons: z.coerce.number().min(0.5).max(30),
    status: z.enum(["active", "maintenance", "inactive"]).optional().default("active"),
    assignedDriverId: z.coerce.number().int().positive().nullable().optional(),
    crewNames: z.string().trim().max(300).optional().default(""),
  }),
  z.object({
    entity: z.literal("announcement"),
    title: z.string().trim().min(4).max(180),
    titleFil: z.string().trim().max(180).optional().default(""),
    body: z.string().trim().min(8).max(2000),
    bodyFil: z.string().trim().max(2000).optional().default(""),
    category: z.enum(["general", "schedule", "advisory", "ra9003"]).default("general"),
    isPinned: z.boolean().optional().default(false),
  }),
]);

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = createEntitySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const d = parsed.data;

    if (d.entity === "purok") {
      const [created] = await db
        .insert(puroks)
        .values({
          code: d.code,
          name: d.name,
          zoneLabel: d.zoneLabel,
          centerLat: d.centerLat,
          centerLng: d.centerLng,
          description: d.description,
        })
        .returning();
      await logAudit({
        actor: auth.user,
        action: "CREATE_PUROK",
        entityType: "purok",
        entityId: created.id,
        summary: `Added purok ${created.name} (${created.code}).`,
      });
      return Response.json({ ok: true, created }, { status: 201 });
    }

    if (d.entity === "household") {
      const [created] = await db
        .insert(households)
        .values({
          householdCode: d.householdCode,
          headName: d.headName,
          address: d.address,
          purokId: d.purokId,
          lat: d.lat,
          lng: d.lng,
          contactNumber: d.contactNumber,
          membersCount: d.membersCount,
        })
        .returning();
      await logAudit({
        actor: auth.user,
        action: "CREATE_HOUSEHOLD",
        entityType: "household",
        entityId: created.id,
        summary: `Registered household ${created.householdCode} (${created.headName}).`,
      });
      return Response.json({ ok: true, created }, { status: 201 });
    }

    if (d.entity === "truck") {
      const [created] = await db
        .insert(trucks)
        .values({
          code: d.code,
          name: d.name,
          plateNumber: d.plateNumber,
          capacityTons: d.capacityTons,
          status: d.status,
          assignedDriverId: d.assignedDriverId ?? null,
          crewNames: d.crewNames,
        })
        .returning();
      await logAudit({
        actor: auth.user,
        action: "CREATE_TRUCK",
        entityType: "truck",
        entityId: created.id,
        summary: `Added truck ${created.name} (${created.plateNumber}).`,
      });
      return Response.json({ ok: true, created }, { status: 201 });
    }

    if (d.entity === "announcement") {
      const [created] = await db
        .insert(announcements)
        .values({
          title: d.title,
          titleFil: d.titleFil || d.title,
          body: d.body,
          bodyFil: d.bodyFil || d.body,
          category: d.category,
          isPinned: d.isPinned,
          published: true,
          createdBy: auth.user.id,
        })
        .returning();
      await logAudit({
        actor: auth.user,
        action: "CREATE_ANNOUNCEMENT",
        entityType: "announcement",
        entityId: created.id,
        summary: `Published announcement "${created.title}".`,
      });
      return Response.json({ ok: true, created }, { status: 201 });
    }

    return Response.json({ error: "Unknown entity." }, { status: 400 });
  } catch (err) {
    console.error("POST admin manage error:", err);
    return Response.json(
      { error: "Operation failed (check for duplicate code or plate number)." },
      { status: 409 }
    );
  }
}

const patchEntitySchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("user"),
    id: z.coerce.number().int().positive(),
    status: z.enum(["pending", "approved", "rejected", "suspended"]).optional(),
    roleCode: z.enum(["resident", "collector", "admin", "official"]).optional(),
    householdId: z.coerce.number().int().positive().nullable().optional(),
  }),
  z.object({
    entity: z.literal("truck"),
    id: z.coerce.number().int().positive(),
    status: z.enum(["active", "maintenance", "inactive"]).optional(),
    assignedDriverId: z.coerce.number().int().positive().nullable().optional(),
    crewNames: z.string().trim().max(300).optional(),
  }),
  z.object({
    entity: z.literal("announcement"),
    id: z.coerce.number().int().positive(),
    isPinned: z.boolean().optional(),
    published: z.boolean().optional(),
  }),
]);

export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = patchEntitySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update." },
        { status: 400 }
      );
    }

    const d = parsed.data;

    if (d.entity === "user") {
      const [existing] = await db.select().from(users).where(eq(users.id, d.id)).limit(1);
      if (!existing) {
        return Response.json({ error: "User not found." }, { status: 404 });
      }

      let nextRoleId = existing.roleId;
      if (d.roleCode && d.roleCode !== existing.roleCode) {
        const [r] = await db.select().from(roles).where(eq(roles.code, d.roleCode)).limit(1);
        if (r) nextRoleId = r.id;
      }

      // Auto-create household when approving a pending resident with no linked household!
      let nextHouseholdId =
        d.householdId !== undefined ? d.householdId : existing.householdId;
      if (
        d.status === "approved" &&
        existing.roleCode === "resident" &&
        !nextHouseholdId &&
        existing.purokId
      ) {
        const [p] = await db
          .select()
          .from(puroks)
          .where(eq(puroks.id, existing.purokId))
          .limit(1);
        if (p) {
          const [newHh] = await db
            .insert(households)
            .values({
              householdCode: `HH-${p.code.replace("PRK-", "P")}-${Date.now().toString().slice(-4)}`,
              headName: existing.fullName,
              address: existing.address || p.name,
              purokId: p.id,
              lat: p.centerLat + (Math.random() - 0.5) * 0.001,
              lng: p.centerLng + (Math.random() - 0.5) * 0.001,
              contactNumber: existing.phone,
              membersCount: 4,
            })
            .returning();
          nextHouseholdId = newHh.id;
        }
      }

      const [updated] = await db
        .update(users)
        .set({
          status: d.status ?? existing.status,
          roleCode: d.roleCode ?? existing.roleCode,
          roleId: nextRoleId,
          householdId: nextHouseholdId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, d.id))
        .returning();

      if (d.status === "approved" && existing.status !== "approved") {
        await notifyUser({
          userId: updated.id,
          purokId: updated.purokId,
          title: "Account Approved – Welcome to Barangay San Isidro EcoCollect",
          message: "Your household registration has been approved. You can now view schedules, submit reports, and track compliance.",
          category: "system",
          link: "/app/dashboard",
        });
      }

      await logAudit({
        actor: auth.user,
        action: "UPDATE_USER",
        entityType: "user",
        entityId: updated.id,
        summary: `Updated user ${updated.fullName} — status: ${updated.status}, role: ${updated.roleCode}.`,
      });

      return Response.json({ ok: true, updated });
    }

    if (d.entity === "truck") {
      const [existing] = await db.select().from(trucks).where(eq(trucks.id, d.id)).limit(1);
      if (!existing) return Response.json({ error: "Truck not found." }, { status: 404 });

      const [updated] = await db
        .update(trucks)
        .set({
          status: d.status ?? existing.status,
          assignedDriverId:
            d.assignedDriverId !== undefined
              ? d.assignedDriverId
              : existing.assignedDriverId,
          crewNames: d.crewNames ?? existing.crewNames,
        })
        .where(eq(trucks.id, d.id))
        .returning();

      await logAudit({
        actor: auth.user,
        action: "UPDATE_TRUCK",
        entityType: "truck",
        entityId: updated.id,
        summary: `Updated truck ${updated.name} — status: ${updated.status}.`,
      });
      return Response.json({ ok: true, updated });
    }

    if (d.entity === "announcement") {
      const [existing] = await db
        .select()
        .from(announcements)
        .where(eq(announcements.id, d.id))
        .limit(1);
      if (!existing) {
        return Response.json({ error: "Announcement not found." }, { status: 404 });
      }
      const [updated] = await db
        .update(announcements)
        .set({
          isPinned: d.isPinned ?? existing.isPinned,
          published: d.published ?? existing.published,
          updatedAt: new Date(),
        })
        .where(eq(announcements.id, d.id))
        .returning();

      await logAudit({
        actor: auth.user,
        action: "UPDATE_ANNOUNCEMENT",
        entityType: "announcement",
        entityId: updated.id,
        summary: `Updated announcement "${updated.title}".`,
      });
      return Response.json({ ok: true, updated });
    }

    return Response.json({ error: "Unknown entity." }, { status: 400 });
  } catch (err) {
    console.error("PATCH admin manage error:", err);
    return Response.json({ error: "Failed to update item." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const id = Number(searchParams.get("id"));
  if (!entity || !Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid delete parameters." }, { status: 400 });
  }

  if (entity === "announcement") {
    const [deleted] = await db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning();
    if (!deleted) return Response.json({ error: "Not found." }, { status: 404 });
    await logAudit({
      actor: auth.user,
      action: "DELETE_ANNOUNCEMENT",
      entityType: "announcement",
      entityId: id,
      summary: `Deleted announcement "${deleted.title}".`,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Entity cannot be deleted via this endpoint." }, { status: 400 });
}
