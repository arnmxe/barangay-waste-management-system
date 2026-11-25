import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ user: null, unreadNotifications: 0 });
    }
    const [unread] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return Response.json({
      user,
      unreadNotifications: unread?.total ?? 0,
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return Response.json({ user: null, unreadNotifications: 0 });
  }
}

const langSchema = z.object({
  preferredLang: z.enum(["en", "fil"]),
});

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = langSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid language." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ preferredLang: parsed.data.preferredLang, updatedAt: new Date() })
    .where(eq(users.id, auth.user.id));

  return Response.json({ ok: true, preferredLang: parsed.data.preferredLang });
}
