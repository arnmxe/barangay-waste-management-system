import { db } from "@/db";
import { auditLogs, notifications, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function logAudit(params: {
  actor: Pick<AuthUser, "id" | "fullName" | "roleCode"> | null;
  action: string;
  entityType: string;
  entityId?: string | number;
  summary: string;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: params.actor?.id ?? null,
      actorName: params.actor?.fullName ?? "System",
      actorRole: params.actor?.roleCode ?? "system",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId !== undefined ? String(params.entityId) : "",
      summary: params.summary,
      detailsJson: JSON.stringify(params.details ?? {}),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function notifyUser(params: {
  userId: number;
  purokId?: number | null;
  title: string;
  message: string;
  category: "reminder" | "delay" | "change" | "report" | "compliance" | "system";
  link?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      purokId: params.purokId ?? null,
      title: params.title,
      message: params.message,
      category: params.category,
      link: params.link ?? "/app/dashboard",
      isRead: false,
    });
  } catch (err) {
    console.error("Failed to notify user:", err);
  }
}

export async function notifyPurokResidents(params: {
  purokId: number;
  title: string;
  message: string;
  category: "reminder" | "delay" | "change" | "report" | "compliance" | "system";
  link?: string;
}) {
  try {
    const residents = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.purokId, params.purokId), eq(users.status, "approved")));

    if (residents.length === 0) return;

    await db.insert(notifications).values(
      residents.map((r) => ({
        userId: r.id,
        purokId: params.purokId,
        title: params.title,
        message: params.message,
        category: params.category,
        link: params.link ?? "/app/schedules",
        isRead: false,
      }))
    );
  } catch (err) {
    console.error("Failed to notify purok residents:", err);
  }
}

export async function notifyAdmins(params: {
  title: string;
  message: string;
  category: "reminder" | "delay" | "change" | "report" | "compliance" | "system";
  link?: string;
}) {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.roleCode, "admin"), eq(users.status, "approved")));

    if (admins.length === 0) return;

    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        title: params.title,
        message: params.message,
        category: params.category,
        link: params.link ?? "/app/admin",
        isRead: false,
      }))
    );
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}
