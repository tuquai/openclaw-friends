import { NextResponse } from "next/server";
import { listAvailableWorkspaces } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaces = await listAvailableWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list workspaces" },
      { status: 500 }
    );
  }
}
