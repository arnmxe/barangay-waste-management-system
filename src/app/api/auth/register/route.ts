import { db } from "@/db";
import { users, roles, puroks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { logAudit, notifyAdmins } from "@/lib/audit";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(160),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(100),
  phone: z.string().trim().min(7, "Please enter a valid phone number.").max(32),
  purokId: z.coerce.number().int().positive("Please select your Purok."),
  address: z.string().trim().min(5, "Please enter your household street address.").max(300),
  privacyConsent: z.literal(true, {
    message: "You must agree to the Data Privacy Act (RA 10173) notice to register.",
  }),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Please review the registration form." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const [purokRow] = await db
      .select()
      .from(puroks)
      .where(eq(puroks.id, parsed.data.purokId))
      .limit(1);

    if (!purokRow) {
      return Response.json({ error: "Selected Purok not found." }, { status: 400 });
    }

    const [residentRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.code, "resident"))
      .limit(1);

    if (!residentRole) {
      return Response.json({ error: "Resident role missing." }, { status: 500 });
    }

    const [created] = await db
      .insert(users)
      .values({
        fullName: parsed.data.fullName,
        email,
        passwordHash: hashPassword(parsed.data.password),
        phone: parsed.data.phone,
        roleId: residentRole.id,
        roleCode: "resident",
        purokId: purokRow.id,
        address: parsed.data.address,
        status: "pending",
        privacyConsentAt: new Date(),
        preferredLang: "en",
      })
      .returning();

    await notifyAdmins({
      title: "New Resident Registration Pending",
      message: `${created.fullName} (${purokRow.name}) registered and needs household verification.`,
      category: "system",
      link: "/app/admin",
    });

    await logAudit({
      actor: { id: created.id, fullName: created.fullName, roleCode: "resident" },
      action: "REGISTER_RESIDENT",
      entityType: "user",
      entityId: created.id,
      summary: `${created.fullName} submitted resident registration for ${purokRow.name} (awaiting approval).`,
    });

    return Response.json(
      {
        ok: true,
        message:
          "Registration received! Your account is now waiting for Barangay Admin approval. Once approved, you can sign in with your email and password.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return Response.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
