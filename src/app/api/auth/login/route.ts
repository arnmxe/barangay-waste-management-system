import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid login details." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (found.length === 0) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = found[0];
    const valid = verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (user.status === "pending") {
      return Response.json(
        {
          error:
            "Your resident registration is still pending approval by the Barangay Admin. Please check back soon.",
          status: "pending",
        },
        { status: 403 }
      );
    }

    if (user.status === "rejected" || user.status === "suspended") {
      return Response.json(
        {
          error: `Your account is currently ${user.status}. Please contact Barangay San Isidro Hall.`,
        },
        { status: 403 }
      );
    }

    await createSession(user.id);
    await logAudit({
      actor: {
        id: user.id,
        fullName: user.fullName,
        roleCode: user.roleCode as "resident" | "collector" | "admin" | "official",
      },
      action: "LOGIN",
      entityType: "user",
      entityId: user.id,
      summary: `${user.fullName} signed in (${user.roleCode}).`,
    });

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roleCode: user.roleCode,
        purokId: user.purokId,
        householdId: user.householdId,
        preferredLang: user.preferredLang,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return Response.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
