import { NextRequest, NextResponse } from "next/server";
import { getCharacter, listCharacters, updateCharacter } from "@/lib/data";
import { syncOpenClawRolesFile, syncWorkspaceTuquConfig } from "@/lib/workspace";
import { normalizeTuquRegistrationUrl, TUQU_BILLING_DASHBOARD_URL } from "@/lib/tuqu-config";

export const runtime = "nodejs";

const defaultRegistrationUrl = TUQU_BILLING_DASHBOARD_URL;

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
    registrationUrl?: string;
    serviceKey?: string;
    tuquCharacterId?: string;
  };

  if (!payload.characterId) {
    return NextResponse.json({ error: "characterId is required" }, { status: 400 });
  }

  const character = await getCharacter(payload.characterId);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  try {
    const updated = await updateCharacter(character.id, {
      tuquConfig: {
        registrationUrl: normalizeTuquRegistrationUrl(
          payload.registrationUrl?.trim() || character.tuquConfig?.registrationUrl || defaultRegistrationUrl
        ),
        serviceKey: payload.serviceKey ?? character.tuquConfig?.serviceKey ?? "",
        characterId: payload.tuquCharacterId?.trim() || character.tuquConfig?.characterId,
        updatedAt: new Date().toISOString()
      }
    });

    await syncWorkspaceTuquConfig(updated);
    await syncOpenClawRolesFile(await listCharacters());
    return NextResponse.json({ character: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
