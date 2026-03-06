const TUQU_API_BASE = "https://photo.tuqu.ai";
const BILLING_API_BASE = "https://billing.tuqu.ai/api/v1/recharge";

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

  return json.data!.imageUrl!;
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
