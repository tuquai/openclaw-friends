import { NextRequest, NextResponse } from "next/server";
import { getCharacter, updateCharacter } from "@/lib/data";
import { registerCharacterInOpenClaw } from "@/lib/openclaw-register";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { characterId?: string };
  if (!payload.characterId) {
    return NextResponse.json({ error: "characterId is required" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  try {
    const result = await registerCharacterInOpenClaw(character);
    const updated = await updateCharacter(character.id, {
      discordLink: character.discordLink
        ? {
            ...character.discordLink,
            accountId: result.accountId,
            guildId: result.guildId
          }
        : character.discordLink
    });

    return NextResponse.json({
      character: updated,
      agentId: result.agentId,
      accountId: result.accountId,
      guildId: result.guildId,
      configPath: result.configPath
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OpenClaw registration failed" },
      { status: 500 }
    );
  }
}
