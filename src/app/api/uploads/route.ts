import crypto from "crypto";
import { db } from "@/db";
import { mediaUploads } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function detectMagicMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // WEBP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAuth(["resident", "collector", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return Response.json(
        { error: "Only JPEG, PNG, or WEBP photos are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return Response.json(
        { error: "Photo is too large. Maximum allowed size is 2 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedMime = detectMagicMime(buffer);
    if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
      return Response.json(
        { error: "File contents do not match a valid JPEG, PNG, or WEBP image." },
        { status: 400 }
      );
    }

    const id = crypto.randomBytes(16).toString("hex");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

    await db.insert(mediaUploads).values({
      id,
      filename: safeName,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
      dataBase64: buffer.toString("base64"),
      uploadedBy: auth.user.id,
    });

    return Response.json(
      {
        ok: true,
        id,
        url: `/api/uploads/${id}`,
        sizeBytes: buffer.length,
        mimeType: detectedMime,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Photo upload failed." }, { status: 500 });
  }
}
