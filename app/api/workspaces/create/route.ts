import { NextRequest, NextResponse } from "next/server";
import { getCharacter, updateCharacter } from "@/lib/data";
import { registerCharacterInOpenClaw } from "@/lib/openclaw-register";
import { createWorkspaceFromCharacter } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
  };

  if (!payload.characterId) {
    return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  try {
    const workspacePath = await createWorkspaceFromCharacter(character);
    const updated = await updateCharacter(character.id, {
      workspacePath,
      discordLink: character.discordLink
        ? {
            ...character.discordLink,
            workspacePath
          }
        : undefined
    });
    let openclawRegistration: { agentId: string; accountId: string; guildId: string; configPath: string } | null = null;

    let openclawRegistrationError: string | null = null;

    if (updated.discordLink?.channelId && updated.discordLink.userId) {
      try {
        openclawRegistration = await registerCharacterInOpenClaw(updated);
      } catch (error) {
        openclawRegistration = null;
        openclawRegistrationError = error instanceof Error ? error.message : "OpenClaw registration failed";
      }
    }

    return NextResponse.json({ workspacePath, openclawRegistration, openclawRegistrationError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
