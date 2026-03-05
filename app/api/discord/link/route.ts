import { NextRequest, NextResponse } from "next/server";
import { buildDiscordAccountId, decodeDiscordBotIdFromToken } from "@/lib/discord-account";
import { readDiscordRuntimeAccount, writeDiscordRuntimeAccount } from "@/lib/discord-config";
import { getCharacter, updateCharacter } from "@/lib/data";
import { registerCharacterInOpenClaw } from "@/lib/openclaw-register";
import { syncWorkspaceDiscordLink } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
    accountId?: string;
    botToken?: string;
    guildId?: string;
    channelId?: string;
    userId?: string;
  };

  if (!payload.characterId || !payload.userId) {
    return NextResponse.json({ error: "characterId and userId are required" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  try {
    const accountId = payload.accountId?.trim() || character.discordLink?.accountId || buildDiscordAccountId(character.name, character.id);
    const botToken = payload.botToken?.trim();
    const savedRuntimeAccount = await readDiscordRuntimeAccount(accountId);
    if (!botToken && !savedRuntimeAccount?.botToken) {
      throw new Error("第一次保存该角色的 Discord 绑定时，必须同时提供 Bot Token。");
    }

    if (botToken) {
      await writeDiscordRuntimeAccount({
        accountId,
        botToken,
        characterId: character.id,
        characterName: character.name
      });
    }

    const botId =
      decodeDiscordBotIdFromToken(botToken ?? "") ||
      savedRuntimeAccount?.botId ||
      character.discordLink?.botId;
    const workspacePath = character.workspacePath ?? character.discordLink?.workspacePath;
    const updated = await updateCharacter(character.id, {
      discordLink: {
        accountId,
        guildId: payload.guildId?.trim() || undefined,
        channelId: payload.channelId?.trim() || "",
        botId,
        userId: payload.userId.trim(),
        linkedAt: new Date().toISOString(),
        workspacePath
      }
    });

    await syncWorkspaceDiscordLink(updated);

    let openclawRegistration: { agentId: string; accountId: string; guildId: string } | null = null;
    let openclawRegistrationError: string | null = null;
    if (updated.workspacePath && updated.discordLink?.channelId && updated.discordLink.userId) {
      try {
        openclawRegistration = await registerCharacterInOpenClaw(updated);
      } catch (error) {
        openclawRegistrationError = error instanceof Error ? error.message : "OpenClaw registration failed";
      }
    }

    return NextResponse.json({ character: updated, openclawRegistration, openclawRegistrationError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
