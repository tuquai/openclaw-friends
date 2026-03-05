import { NextRequest, NextResponse } from "next/server";
import { getCharacter, listCharacters } from "@/lib/data";
import { syncWorkspaceSkills } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
    all?: boolean;
  };

  if (payload.all) {
    const characters = await listCharacters();
    const results: { id: string; name: string; workspacePath?: string; synced: boolean; error?: string }[] = [];

    for (const character of characters) {
      if (!character.workspacePath) {
        results.push({ id: character.id, name: character.name, synced: false, error: "No workspace" });
        continue;
      }

      try {
        await syncWorkspaceSkills(character);
        results.push({ id: character.id, name: character.name, workspacePath: character.workspacePath, synced: true });
      } catch (error) {
        results.push({
          id: character.id,
          name: character.name,
          workspacePath: character.workspacePath,
          synced: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return NextResponse.json({ results });
  }

  if (!payload.characterId) {
    return NextResponse.json({ error: "Missing characterId or set all: true" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (!character.workspacePath) {
    return NextResponse.json({ error: "Character has no workspace" }, { status: 400 });
  }

  try {
    await syncWorkspaceSkills(character);
    return NextResponse.json({ synced: true, workspacePath: character.workspacePath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
