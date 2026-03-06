import { NextRequest, NextResponse } from "next/server";
import { importWorkspaceAsCharacter } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { workspacePath?: string };

  if (!payload.workspacePath) {
    return NextResponse.json({ error: "Missing workspacePath" }, { status: 400 });
  }

  try {
    const character = await importWorkspaceAsCharacter(payload.workspacePath);
    return NextResponse.json({ character });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import workspace" },
      { status: 500 }
    );
  }
}
