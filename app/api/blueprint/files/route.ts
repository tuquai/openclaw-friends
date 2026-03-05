import { NextRequest, NextResponse } from "next/server";
import { getCharacter, updateCharacter } from "@/lib/data";
import { syncWorkspaceFiles } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
    files?: {
      identityMd?: string;
      soulMd?: string;
      userMd?: string;
      memoryMd?: string;
    };
  };

  if (!payload.characterId || !payload.files) {
    return NextResponse.json({ error: "characterId and files are required" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character?.blueprintPackage) {
    return NextResponse.json({ error: "Character blueprint package not found" }, { status: 404 });
  }

  try {
    const updated = await updateCharacter(character.id, {
      blueprintPackage: {
        ...character.blueprintPackage,
        files: {
          ...character.blueprintPackage.files,
          identityMd: payload.files.identityMd ?? character.blueprintPackage.files.identityMd,
          soulMd: payload.files.soulMd ?? character.blueprintPackage.files.soulMd,
          userMd: payload.files.userMd ?? character.blueprintPackage.files.userMd,
          memoryMd: payload.files.memoryMd ?? character.blueprintPackage.files.memoryMd
        }
      }
    });

    await syncWorkspaceFiles(updated);
    return NextResponse.json({ character: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
