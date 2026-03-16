import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCharacter, listCharacters, updateCharacter } from "@/lib/data";
import { createTuquCharacter } from "@/lib/tuqu";
import { syncOpenClawRolesFile, syncWorkspaceTuquConfig } from "@/lib/workspace";

export const runtime = "nodejs";

function publicPathToAbsolute(photoPath: string) {
  return path.join(process.cwd(), "public", photoPath.replace(/^\//, ""));
}

async function fileToDataUri(filePath: string) {
  const bytes = await fs.readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".gif"
          ? "image/gif"
          : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { characterId?: string };
  if (!payload.characterId) {
    return NextResponse.json({ error: "characterId is required" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (!character.tuquConfig?.serviceKey.trim()) {
    return NextResponse.json({ error: "Missing TUQU Service Key" }, { status: 400 });
  }

  if (!character.photos[0]) {
    return NextResponse.json({ error: "当前角色缺少参考照片，无法创建 TUQU character" }, { status: 400 });
  }

  try {
    const photoData = await fileToDataUri(publicPathToAbsolute(character.photos[0]));
    const tuquCharacterId = await createTuquCharacter({
      serviceKey: character.tuquConfig.serviceKey,
      name: character.name,
      photoDataUrl: photoData,
      description: {
        age: character.age || undefined,
        gender: character.gender || undefined,
        profession: character.occupation || undefined,
        other: character.concept || undefined
      }
    });

    const updated = await updateCharacter(character.id, {
      tuquConfig: {
        registrationUrl: character.tuquConfig.registrationUrl,
        serviceKey: character.tuquConfig.serviceKey,
        characterId: tuquCharacterId,
        updatedAt: new Date().toISOString()
      }
    });

    await syncWorkspaceTuquConfig(updated);
    await syncOpenClawRolesFile(await listCharacters());

    return NextResponse.json({
      character: updated,
      tuquCharacterId
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建 TUQU character 失败" },
      { status: 500 }
    );
  }
}
