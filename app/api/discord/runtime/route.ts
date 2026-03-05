import { NextRequest, NextResponse } from "next/server";
import { getDiscordRuntimeStatus, startDiscordRuntime, stopDiscordRuntime } from "@/lib/discord-runtime";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: getDiscordRuntimeStatus() });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { accountId?: string; force?: boolean };

  try {
    const status = await startDiscordRuntime(payload.accountId, payload.force);
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discord runtime failed to start" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { accountId?: string };
  const status = await stopDiscordRuntime(payload.accountId);
  return NextResponse.json({ status });
}
