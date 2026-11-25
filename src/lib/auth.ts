import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, userSessions, puroks, households } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE = "brgy_eco_session";
export type RoleCode = "resident" | "collector" | "admin" | "official";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  roleCode: RoleCode;
  purokId: number | null;
  purokName: string | null;
  householdId: number | null;
  householdCode: string | null;
  address: string;
  status: string;
  preferredLang: "en" | "fil";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  await db.insert(userSessions).values({
    token,
    userId,
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIE === "true",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(userSessions).where(eq(userSessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const now = new Date();
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        roleCode: users.roleCode,
        purokId: users.purokId,
        householdId: users.householdId,
        address: users.address,
        status: users.status,
        preferredLang: users.preferredLang,
        purokName: puroks.name,
        householdCode: households.householdCode,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .leftJoin(puroks, eq(users.purokId, puroks.id))
      .leftJoin(households, eq(users.householdId, households.id))
      .where(and(eq(userSessions.token, token), gt(userSessions.expiresAt, now)))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    if (row.status !== "approved") return null;

    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      roleCode: row.roleCode as RoleCode,
      purokId: row.purokId,
      purokName: row.purokName ?? null,
      householdId: row.householdId,
      householdCode: row.householdCode ?? null,
      address: row.address,
      status: row.status,
      preferredLang: row.preferredLang === "fil" ? "fil" : "en",
    };
  } catch {
    return null;
  }
}

export async function requireAuth(allowedRoles?: RoleCode[]): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }
  if (allowedRoles && !allowedRoles.includes(user.roleCode)) {
    return {
      ok: false,
      response: Response.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user };
}
