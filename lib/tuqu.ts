const TUQU_API_BASE = "https://photo.tuqu.ai";
const BILLING_API_BASE = "https://billing.tuqu.ai/api/v1/recharge";
const DEFAULT_TUQU_MODEL_ID = "nanobanana_2";
const DEFAULT_ENHANCE_CATEGORY = "portrait";

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

type TuquCreateCharacterPayload = {
  serviceKey: string;
  name: string;
  photoDataUrl: string;
  description?: {
    age?: string;
    gender?: string;
    profession?: string;
    other?: string;
  };
};

type TuquCreateCharacterResponse = {
  success?: boolean;
  data?: { _id?: string; name?: string };
  error?: { message?: string; code?: string };
};

type TuquEnhancePromptResponse = {
  enhancedPrompt?: string;
};

type TuquBalanceResponse = {
  success?: boolean;
  balance?: number;
  data?: { balance?: number };
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

async function enhancePrompt(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${TUQU_API_BASE}/api/enhance-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: DEFAULT_ENHANCE_CATEGORY,
        prompt
      })
    });

    if (!response.ok) {
      return prompt;
    }

    const json = (await response.json()) as TuquEnhancePromptResponse;
    return json.enhancedPrompt?.trim() || prompt;
  } catch {
    return prompt;
  }
}

export async function createTuquCharacter(payload: TuquCreateCharacterPayload): Promise<string> {
  const response = await fetch(`${TUQU_API_BASE}/api/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": payload.serviceKey
    },
    body: JSON.stringify({
      name: payload.name,
      photoBase64: payload.photoDataUrl,
      description: payload.description
    })
  });

  const json = (await response.json().catch(() => ({}))) as TuquCreateCharacterResponse;
  if (!response.ok || !json.success || !json.data?._id) {
    const code = json.error?.code ?? `HTTP_${response.status}`;
    const message = json.error?.message ?? `TUQU character creation failed (${response.status})`;
    throw new TuquApiError(code, message);
  }

  return json.data._id;
}

export async function getTuquBalance(userKey: string): Promise<number | null> {
  const response = await fetch(`${TUQU_API_BASE}/api/billing/balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userKey })
  });

  const json = (await response.json().catch(() => ({}))) as TuquBalanceResponse;
  if (!response.ok) {
    const code = json.error?.code ?? `HTTP_${response.status}`;
    const message = json.error?.message ?? `TUQU balance request failed (${response.status})`;
    throw new TuquApiError(code, message);
  }

  const balance = typeof json.balance === "number" ? json.balance : json.data?.balance;
  return typeof balance === "number" ? balance : null;
}

export async function generateCharacterImage(payload: GenerateCharacterPayload): Promise<string> {
  const prompt = await enhancePrompt(payload.sceneDescription);
  const response = await fetch(`${TUQU_API_BASE}/api/v2/generate-for-character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userKey: payload.userKey,
      characterIds: payload.characterIds,
      prompt,
      resolution: payload.resolution ?? "2K",
      ratio: payload.ratio ?? "3:4",
      modelId: payload.model ?? DEFAULT_TUQU_MODEL_ID
    })
  });

  const json = (await response.json()) as TuquGenerateResponse;
  if (!response.ok || !json.success || !json.data?.imageUrl) {
    throwTuquError(json, response.status);
  }

  return json.data!.imageUrl!;
}

export async function generateFreestyleImage(payload: GenerateFreestylePayload): Promise<string> {
  const prompt = await enhancePrompt(payload.prompt);
  const response = await fetch(`${TUQU_API_BASE}/api/v2/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userKey: payload.userKey,
      prompt,
      referenceImageUrls: payload.referenceImageUrls,
      resolution: payload.resolution ?? "2K",
      ratio: payload.ratio ?? "3:4",
      modelId: payload.model ?? DEFAULT_TUQU_MODEL_ID
    })
  });

  const json = (await response.json()) as TuquGenerateResponse;
  if (!response.ok || !json.success || !json.data?.imageUrl) {
    throwTuquError(json, response.status);
  }

  return json.data!.imageUrl!;
}

// ── Billing / Recharge API ──────────────────────────────────────────

export type RechargePlan = {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  tokenGrant: number;
  bonusToken: number;
};

export async function listRechargePlans(serviceKey: string): Promise<RechargePlan[]> {
  const response = await fetch(`${BILLING_API_BASE}/plans`, {
    headers: { Authorization: `Bearer ${serviceKey}` }
  });
  if (!response.ok) {
    throw new Error(`Failed to list recharge plans (${response.status})`);
  }
  const json = (await response.json()) as { data?: { plans?: RechargePlan[] } };
  return json.data?.plans ?? [];
}

export async function createWechatPayment(
  serviceKey: string,
  planId: string
): Promise<{ qrcodeImg?: string; payUrl?: string }> {
  const response = await fetch(`${BILLING_API_BASE}/wechat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ planId })
  });
  if (!response.ok) {
    throw new Error(`Failed to create WeChat payment (${response.status})`);
  }
  const json = (await response.json()) as { data?: { qrcodeImg?: string; payUrl?: string } };
  return json.data ?? {};
}

export async function createStripePayment(
  serviceKey: string,
  planId: string
): Promise<{ checkoutUrl?: string; qrcodeImg?: string }> {
  const response = await fetch(`${BILLING_API_BASE}/stripe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ planId })
  });
  if (!response.ok) {
    throw new Error(`Failed to create Stripe payment (${response.status})`);
  }
  const json = (await response.json()) as { data?: { checkoutUrl?: string; qrcodeImg?: string } };
  return json.data ?? {};
}
