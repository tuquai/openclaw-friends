import { NextRequest, NextResponse } from "next/server";
import { readDiscordRuntimeConfig, writeDiscordRuntimeAccount } from "@/lib/discord-config";

export const runtime = "nodejs";

export async function GET() {
  const config = await readDiscordRuntimeConfig();
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    accountId?: string;
    botToken?: string;
    botId?: string;
    characterId?: string;
    characterName?: string;
  };
  if (typeof payload.accountId !== "string" || typeof payload.botToken !== "string") {
    return NextResponse.json({ error: "accountId and botToken are required" }, { status: 400 });
  }

  const config = await writeDiscordRuntimeAccount({
    accountId: payload.accountId,
    botToken: payload.botToken,
    botId: payload.botId,
    characterId: payload.characterId,
    characterName: payload.characterName
  });
  return NextResponse.json({ config });
}
