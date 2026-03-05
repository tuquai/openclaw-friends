const TUQU_API_BASE = "https://photo.tuqu.ai";

type GenerateCharacterPayload = {
  userKey: string;
  characterIds: string[];
  sceneDescription: string;
  resolution?: string;
  ratio?: string;
  model?: string;
};

type GenerateFreestylePayload = {
  userKey: string;
  prompt: string;
  referenceImageUrls?: string[];
  resolution?: string;
  ratio?: string;
  model?: string;
};

type TuquGenerateResponse = {
  success?: boolean;
  data?: { imageUrl?: string; remainingBalance?: number };
  error?: { message?: string; code?: string };
};

export class TuquApiError extends Error {
  code: string;
  remainingBalance?: number;

  constructor(code: string, message: string, remainingBalance?: number) {
    super(message);
    this.name = "TuquApiError";
    this.code = code;
    this.remainingBalance = remainingBalance;
  }
}

function throwTuquError(json: TuquGenerateResponse, httpStatus: number): never {
  const code = json.error?.code ?? `HTTP_${httpStatus}`;
  const message = json.error?.message ?? `TUQU request failed (${httpStatus})`;
  const balance = json.data?.remainingBalance;
  throw new TuquApiError(code, message, typeof balance === "number" ? balance : undefined);
}

export async function generateCharacterImage(payload: GenerateCharacterPayload): Promise<string> {
  const response = await fetch(`${TUQU_API_BASE}/api/generate-character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userKey: payload.userKey,
      characterIds: payload.characterIds,
      prompt: payload.sceneDescription,
      resolution: payload.resolution ?? "2K",
      ratio: payload.ratio ?? "3:4",
      model: payload.model ?? "seedream45"
    })
  });

  const json = (await response.json()) as TuquGenerateResponse;
  if (!response.ok || !json.success || !json.data?.imageUrl) {
    throwTuquError(json, response.status);
  }

  return json.data.imageUrl;
}

export async function generateFreestyleImage(payload: GenerateFreestylePayload): Promise<string> {
  const response = await fetch(`${TUQU_API_BASE}/api/generate-freestyle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userKey: payload.userKey,
      prompt: payload.prompt,
      referenceImageUrls: payload.referenceImageUrls,
      resolution: payload.resolution ?? "2K",
      ratio: payload.ratio ?? "3:4",
      model: payload.model ?? "seedream45"
    })
  });

  const json = (await response.json()) as TuquGenerateResponse;
  if (!response.ok || !json.success || !json.data?.imageUrl) {
    throwTuquError(json, response.status);
  }

  return json.data.imageUrl;
}
