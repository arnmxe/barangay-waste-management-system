import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, auth.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return Response.json({
    notifications: items,
    unreadCount: items.filter((n) => !n.isRead).length,
  });
}

const markSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid notification request." }, { status: 400 });
  }

  if (parsed.data.markAll) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, auth.user.id));
    return Response.json({ ok: true });
  }

  if (parsed.data.id) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, parsed.data.id), eq(notifications.userId, auth.user.id))
      );
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Specify id or markAll." }, { status: 400 });
}
