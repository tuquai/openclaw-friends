import assert from "node:assert/strict";
import test from "node:test";
import { createTuquCharacter, generateCharacterImage, generateFreestyleImage, getTuquBalance, TuquApiError } from "../lib/tuqu.ts";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("generateFreestyleImage enhances the prompt before submission and uses nanobanana_2 by default", async () => {
  const originalFetch = global.fetch;
  const calls: FetchCall[] = [];

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    if (url.endsWith("/api/enhance-prompt")) {
      return jsonResponse({ enhancedPrompt: "增强后的自由提示词" });
    }

    if (url.endsWith("/api/v2/generate-image")) {
      return jsonResponse({
        success: true,
        data: { imageUrl: "https://example.com/freestyle.png" }
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const imageUrl = await generateFreestyleImage({
      userKey: "service-key",
      prompt: "原始自由提示词"
    });

    assert.equal(imageUrl, "https://example.com/freestyle.png");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://photo.tuqu.ai/api/enhance-prompt");
    assert.equal(calls[1].url, "https://photo.tuqu.ai/api/v2/generate-image");

    const enhanceBody = JSON.parse(String(calls[0].init?.body)) as { prompt: string };
    assert.equal(enhanceBody.prompt, "原始自由提示词");

    const generateBody = JSON.parse(String(calls[1].init?.body)) as { prompt: string; modelId: string };
    assert.equal(generateBody.prompt, "增强后的自由提示词");
    assert.equal(generateBody.modelId, "nanobanana_2");
  } finally {
    global.fetch = originalFetch;
  }
});

test("generateCharacterImage falls back to the original prompt when enhancement fails and still uses nanobanana_2", async () => {
  const originalFetch = global.fetch;
  const calls: FetchCall[] = [];

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    if (url.endsWith("/api/enhance-prompt")) {
      return jsonResponse({ error: { message: "temporary failure" } }, 500);
    }

    if (url.endsWith("/api/v2/generate-for-character")) {
      return jsonResponse({
        success: true,
        data: { imageUrl: "https://example.com/character.png" }
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const imageUrl = await generateCharacterImage({
      userKey: "service-key",
      characterIds: ["char-1"],
      sceneDescription: "原始角色提示词"
    });

    assert.equal(imageUrl, "https://example.com/character.png");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://photo.tuqu.ai/api/enhance-prompt");
    assert.equal(calls[1].url, "https://photo.tuqu.ai/api/v2/generate-for-character");

    const generateBody = JSON.parse(String(calls[1].init?.body)) as { prompt: string; modelId: string };
    assert.equal(generateBody.prompt, "原始角色提示词");
    assert.equal(generateBody.modelId, "nanobanana_2");
  } finally {
    global.fetch = originalFetch;
  }
});

test("createTuquCharacter uses x-api-key auth and returns the created id", async () => {
  const originalFetch = global.fetch;
  const calls: FetchCall[] = [];

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    if (url.endsWith("/api/characters")) {
      return jsonResponse({
        success: true,
        data: { _id: "tuqu-char-123" }
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const characterId = await createTuquCharacter({
      serviceKey: "service-key",
      name: "幸子",
      photoDataUrl: "data:image/jpeg;base64,abc123",
      description: { profession: "学生" }
    });

    assert.equal(characterId, "tuqu-char-123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://photo.tuqu.ai/api/characters");
    assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "service-key");

    const body = JSON.parse(String(calls[0].init?.body)) as {
      name: string;
      photoBase64: string;
      description: { profession: string };
    };
    assert.equal(body.name, "幸子");
    assert.equal(body.photoBase64, "data:image/jpeg;base64,abc123");
    assert.equal(body.description.profession, "学生");
  } finally {
    global.fetch = originalFetch;
  }
});

test("getTuquBalance reads the balance from the billing endpoint body auth flow", async () => {
  const originalFetch = global.fetch;
  const calls: FetchCall[] = [];

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    if (url.endsWith("/api/billing/balance")) {
      return jsonResponse({ success: true, balance: 12.5 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const balance = await getTuquBalance("service-key");

    assert.equal(balance, 12.5);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://photo.tuqu.ai/api/billing/balance");
    const body = JSON.parse(String(calls[0].init?.body)) as { userKey: string };
    assert.equal(body.userKey, "service-key");
  } finally {
    global.fetch = originalFetch;
  }
});

test("getTuquBalance throws TuquApiError on failed balance requests", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith("/api/billing/balance")) {
      return jsonResponse(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "bad key"
          }
        },
        401
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => getTuquBalance("bad-key"),
      (error: unknown) => error instanceof TuquApiError && error.code === "UNAUTHORIZED"
    );
  } finally {
    global.fetch = originalFetch;
  }
});
