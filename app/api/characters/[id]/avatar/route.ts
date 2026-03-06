import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";
import { getCharacter } from "@/lib/data";

export const runtime = "nodejs";

const PROFILE_NAMES = ["profile.jpg", "profile.jpeg", "profile.png", "profile.webp"];

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

async function findProfileImage(workspacePath: string): Promise<string | null> {
  for (const name of PROFILE_NAMES) {
    const filePath = path.join(workspacePath, name);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const character = await getCharacter(id);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (character.workspacePath) {
    const profilePath = await findProfileImage(character.workspacePath);
    if (profilePath) {
      const data = await fs.readFile(profilePath);
      const ext = path.extname(profilePath).toLowerCase();
      return new NextResponse(data, {
        headers: {
          "Content-Type": MIME_MAP[ext] || "image/jpeg",
          "Cache-Control": "no-store"
        }
      });
    }
  }

  if (character.photos[0]) {
    const filePath = path.join(process.cwd(), "public", character.photos[0].replace(/^\//, ""));
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return new NextResponse(data, {
        headers: {
          "Content-Type": MIME_MAP[ext] || "image/jpeg",
          "Cache-Control": "no-store"
        }
      });
    } catch {
      // original upload file missing
    }
  }

  return NextResponse.json({ error: "No avatar found" }, { status: 404 });
}
