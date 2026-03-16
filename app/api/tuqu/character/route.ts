import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCharacter, listCharacters, updateCharacter } from "@/lib/data";
import { syncOpenClawRolesFile, syncWorkspaceAssociates, syncWorkspaceTuquConfig } from "@/lib/workspace";

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
    const response = await fetch("https://photo.tuqu.ai/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": character.tuquConfig.serviceKey
      },
      body: JSON.stringify({
        name: character.name,
        photoBase64: photoData,
        description: {
          age: character.age || undefined,
          gender: character.gender || undefined,
          profession: character.occupation || undefined,
          other: character.concept || undefined
        }
      })
    });

    const json = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { _id?: string; name?: string };
      error?: { message?: string };
    };

    if (!response.ok || !json.success || !json.data?._id) {
      return NextResponse.json(
        { error: json.error?.message ?? "创建 TUQU character 失败" },
        { status: 500 }
      );
    }

    const updated = await updateCharacter(character.id, {
      tuquConfig: {
        registrationUrl: character.tuquConfig.registrationUrl,
        serviceKey: character.tuquConfig.serviceKey,
        characterId: json.data._id,
        updatedAt: new Date().toISOString()
      }
    });

    await syncWorkspaceTuquConfig(updated);
    await syncWorkspaceAssociates(updated);
    await syncOpenClawRolesFile(await listCharacters());

    return NextResponse.json({
      character: updated,
      tuquCharacterId: json.data._id
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建 TUQU character 失败" },
      { status: 500 }
    );
  }
}
