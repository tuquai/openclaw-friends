import { NextRequest, NextResponse } from "next/server";
import { getUserProfile, updateUserProfile } from "@/lib/data";
import { UserProfileInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const userProfile = await getUserProfile();
  return NextResponse.json({ userProfile });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<UserProfileInput>;

  try {
    const userProfile = await updateUserProfile(payload);
    return NextResponse.json({ userProfile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
