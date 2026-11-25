import { db } from "@/db";
import { mediaUploads } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9]{16,64}$/i.test(id)) {
      return new Response("Invalid file ID", { status: 400 });
    }

    const rows = await db
      .select()
      .from(mediaUploads)
      .where(eq(mediaUploads.id, id))
      .limit(1);

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    const file = rows[0];
    const buf = Buffer.from(file.dataBase64, "base64");
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Media serve error:", err);
    return new Response("Error loading image", { status: 500 });
  }
}
