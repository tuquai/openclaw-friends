import { NextRequest, NextResponse } from "next/server";
import { createCharacter, deleteCharacter, listCharacters, updateCharacter, updateCharacterFromDraft } from "@/lib/data";
import { BlueprintPackage, DiscordLink, DraftCharacterInput, QuestionnaireInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const characters = await listCharacters();
  return NextResponse.json({ characters });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as DraftCharacterInput & { questionnaire?: QuestionnaireInput };

  if (!payload.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const created = await createCharacter(payload, payload.questionnaire);
  return NextResponse.json({ character: created }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json()) as DraftCharacterInput & { id?: string; questionnaire?: QuestionnaireInput };

  if (!payload.id) {
    return NextResponse.json({ error: "Character id is required" }, { status: 400 });
  }

  if (!payload.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const updated = await updateCharacterFromDraft(payload.id, payload, payload.questionnaire);
    return NextResponse.json({ character: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 404 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.json()) as {
    id?: string;
    questionnaire?: QuestionnaireInput;
    blueprintPackage?: BlueprintPackage;
    discordLink?: DiscordLink;
    workspacePath?: string;
  };

  if (!payload.id) {
    return NextResponse.json({ error: "Character id is required" }, { status: 400 });
  }

  try {
    const updated = await updateCharacter(payload.id, {
      ...(payload.questionnaire ? { questionnaire: payload.questionnaire } : {}),
      ...(payload.blueprintPackage ? { blueprintPackage: payload.blueprintPackage } : {}),
      ...(payload.discordLink ? { discordLink: payload.discordLink } : {}),
      ...(typeof payload.workspacePath === "string" ? { workspacePath: payload.workspacePath } : {})
    });
    return NextResponse.json({ character: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 404 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const payload = (await request.json()) as { id?: string };

  if (!payload.id) {
    return NextResponse.json({ error: "Character id is required" }, { status: 400 });
  }

  try {
    await deleteCharacter(payload.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 404 }
    );
  }
}
