import { randomUUID } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getUploadDir } from "@/lib/data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const uploadDir = await getUploadDir();
  const extension = path.extname(file.name) || ".jpg";
  const filename = `${randomUUID()}${extension}`;
  const destination = path.join(uploadDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(destination, bytes);

  return NextResponse.json({
    path: `/uploads/${filename}`
  });
}
