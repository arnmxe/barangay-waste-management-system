import { destroySession, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await logAudit({
        actor: user,
        action: "LOGOUT",
        entityType: "user",
        entityId: user.id,
        summary: `${user.fullName} signed out.`,
      });
    }
    await destroySession();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    return Response.json({ error: "Logout failed." }, { status: 500 });
  }
}
