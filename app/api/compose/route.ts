import { NextRequest, NextResponse } from "next/server";
import { composeCharacter } from "@/lib/openai";
import { updateCharacter } from "@/lib/data";
import { DraftCharacterInput, QuestionnaireInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    characterId?: string;
    character: DraftCharacterInput;
    questionnaire: QuestionnaireInput;
  };

  try {
    const blueprintPackage = await composeCharacter({
      character: payload.character,
      questionnaire: payload.questionnaire
    });

    if (payload.characterId) {
      await updateCharacter(payload.characterId, { blueprintPackage });
    }

    return NextResponse.json({ blueprintPackage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
