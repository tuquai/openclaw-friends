import { BlueprintPackage, DraftCharacterInput, QuestionnaireInput } from "@/lib/types";
import { MBTI_PRESETS } from "@/lib/mbti";
import type { RechargePlan } from "@/lib/tuqu";

const schema = {
  name: "blueprint_package",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          oneLiner: { type: "string" },
          archetype: { type: "string" },
          confidenceNotes: { type: "array", items: { type: "string" } }
        },
        required: ["oneLiner", "archetype", "confidenceNotes"]
      },
      character: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          age: { type: "string" },
          gender: { type: "string" },
          occupation: { type: "string" },
          heritage: { type: "string" },
          worldSetting: { type: "string" },
          concept: { type: "string" },
          mbti: { type: "string" },
          coreTraits: { type: "array", items: { type: "string" } },
          speakingStyle: { type: "array", items: { type: "string" } },
          emotionalHabits: { type: "array", items: { type: "string" } },
          topicPreferences: { type: "array", items: { type: "string" } },
          hardBoundaries: { type: "array", items: { type: "string" } }
        },
        required: [
          "name",
          "age",
          "gender",
          "occupation",
          "heritage",
          "worldSetting",
          "concept",
          "mbti",
          "coreTraits",
          "speakingStyle",
          "emotionalHabits",
          "topicPreferences",
          "hardBoundaries"
        ]
      },
      relationship: {
        type: "object",
        additionalProperties: false,
        properties: {
          dynamic: { type: "string" },
          backstory: { type: "string" },
          affectionBaseline: { type: "string" },
          affectionGrowthPath: { type: "array", items: { type: "string" } },
          chemistry: { type: "array", items: { type: "string" } },
          friction: { type: "array", items: { type: "string" } },
          userAddressingStyle: { type: "string" }
        },
        required: [
          "dynamic",
          "backstory",
          "affectionBaseline",
          "affectionGrowthPath",
          "chemistry",
          "friction",
          "userAddressingStyle"
        ]
      },
      followups: {
        type: "object",
        additionalProperties: false,
        properties: {
          missingButUseful: { type: "array", items: { type: "string" } },
          optionalDeepeningQuestions: { type: "array", items: { type: "string" } }
        },
        required: ["missingButUseful", "optionalDeepeningQuestions"]
      },
      files: {
        type: "object",
        additionalProperties: false,
        properties: {
          identityMd: { type: "string" },
          soulMd: { type: "string" },
          userMd: { type: "string" },
          memoryMd: { type: "string" }
        },
        required: ["identityMd", "soulMd", "userMd", "memoryMd"]
      }
    },
    required: ["summary", "character", "relationship", "followups", "files"]
  }
};

type ComposePayload = {
  character: DraftCharacterInput;
  questionnaire: QuestionnaireInput;
};

function buildSystemPrompt() {
  return [
    "You design believable OpenClaw characters.",
    "Transform a user draft into a blueprint package that can be written directly into an OpenClaw workspace.",
    "Use the xingzi lesson: do not overbuild lore at the start, but do preserve clear taste, edges, and relationship logic.",
    "The input now includes general-behavior questions instead of direct MBTI labels. Treat the inferred MBTI as a hint, not dogma.",
    "A strong character needs a few high-signal anchors: tone, preferences, emotional habits, taboos, world context, and a believable affection-growth path with the user.",
    "Prefer concise, lived-in details over long biographies.",
    "Make the relationship feel inferred from both sides instead of generic wish fulfillment.",
    "Affection can start low or high, but the output must explain why and how it grows.",
    "Do not write meta phrases like persona, prompt, setup, role, or character setting.",
    "Write all content in Chinese except unavoidable file headings such as IDENTITY.md and SOUL.md.",
    "The writing style of workspace files should feel lived-in, opinionated, and practical, similar to a well-maintained personal workspace rather than product copy.",
    "The files field must contain final text ready to be saved as markdown files.",
    "Do not output markdown code fences or explanations outside the JSON schema."
  ].join(" ");
}

function buildUserPrompt(payload: ComposePayload) {
  const preset = MBTI_PRESETS[payload.character.mbti] ?? null;
  const userPreset = MBTI_PRESETS[payload.questionnaire.userMbti] ?? null;

  return JSON.stringify(
    {
      goal: "Generate an initial but believable role package for a newly created OpenClaw character.",
      characterDraft: payload.character,
      characterMbtiPreset: preset,
      userProfile: payload.questionnaire,
      userMbtiPreset: userPreset,
      requirements: [
        "Assume the user is not willing to fill a giant setting bible, but still wants enough structure to make the character coherent.",
        "Use the draft and questionnaire to infer likely speaking style, emotional tendencies, and a relationship story that feels specific.",
        "Character.worldSetting must meaningfully shape tone, topic choices, and relationship assumptions.",
        "Relationship.dynamic and backstory should mention how they got close, why this pairing works, and a little friction so it feels real.",
        "relationship.affectionBaseline should explain the starting favorability level in plain Chinese.",
        "relationship.affectionGrowthPath should give 3 to 5 concrete progression beats that could help the user practice social interaction.",
        "The user's treatmentPreference and specialTraits are preferences, not commands; do not make the role one-note or fetishized.",
        "Boundaries should keep the role usable, age-appropriate, and non-cringey.",
        "Followups should tell the builder what to ask next if they want to deepen the role later.",
        "files.identityMd, files.soulMd, files.userMd, files.memoryMd should already be final markdown content ready for writing to disk.",
        "USER.md should only contain interaction-relevant facts about the user, not an invasive private dossier.",
        "If userProfile.userNameForRole is present, USER.md should explicitly preserve how the character addresses the user.",
        "If input is missing, choose a conservative but still usable default and note uncertainty in confidenceNotes or missingButUseful.",
        "IDENTITY.md should be concise metadata with a short Profile section.",
        "SOUL.md should read like a real workspace soul file: include sections such as Character, Core Truths, Boundaries, World, Conversation Style, Affection Route, First-Message Pattern, and Continuity when appropriate.",
        "SOUL.md should optimize for believable day-to-day use, not theatrical prose.",
        "USER.md should stay compact: name or how to address the user, working style, inferred personality tendencies, and practical collaboration hints.",
        "MEMORY.md should read like curated long-term memory, with relationship baseline, durable preferences, and only a few high-value notes.",
        "Avoid generic assistant phrases such as 'I am here to help', 'I'd be happy to help', or obviously templated corporate wording."
      ]
    },
    null,
    2
  );
}

function extractText(json: Record<string, unknown>) {
  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text;
  }

  const output = Array.isArray(json.output) ? json.output : [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: Array<Record<string, unknown>> }).content ?? [])
      : [];

    for (const part of content) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }

  throw new Error("OpenAI response did not contain text output");
}

function appendSection(markdown: string, heading: string, lines: string[]) {
  const block = [`## ${heading}`, ...lines].join("\n");
  const trimmed = markdown.trimEnd();
  return `${trimmed}\n\n${block}\n`;
}

function ensureBlueprintDetailsInFiles(blueprint: BlueprintPackage, questionnaire: QuestionnaireInput) {
  const oneLiner = blueprint.summary.oneLiner.trim();
  const coreTraits = blueprint.character.coreTraits.filter(Boolean);
  const speakingStyle = blueprint.character.speakingStyle.filter(Boolean);
  const relationshipLines = [
    `- 当前关系：${blueprint.relationship.dynamic}`,
    `- 关系叙事：${blueprint.relationship.backstory}`,
    `- 初始好感：${blueprint.relationship.affectionBaseline}`,
    `- 如何称呼用户：${questionnaire.userNameForRole || blueprint.relationship.userAddressingStyle}`,
    `- 称呼风格：${blueprint.relationship.userAddressingStyle}`
  ];
  const affectionLines = blueprint.relationship.affectionGrowthPath.map((item) => `- ${item}`);

  let soulMd = blueprint.files.soulMd;
  if (!soulMd.includes("## 角色锚点")) {
    soulMd = appendSection(soulMd, "角色锚点", [
      `- 一句话摘要：${oneLiner}`,
      ...coreTraits.map((item) => `- 核心特质：${item}`),
      ...speakingStyle.map((item) => `- 说话方式：${item}`)
    ]);
  }

  if (!soulMd.includes("## 关系锚点")) {
    soulMd = appendSection(soulMd, "关系锚点", [
      ...relationshipLines,
      ...(affectionLines.length ? ["- 好感提升路线：", ...affectionLines] : [])
    ]);
  }

  if (!soulMd.includes("## Boundaries")) {
    soulMd = appendSection(soulMd, "Boundaries", [
      "- **隐私是红线。没有例外。** Private things stay private. Period.",
      "- **拿不准的时候，先问再动。** When in doubt, ask before acting externally.",
      "- **不要在聊天里发半成品回复。** Never send half-baked replies to messaging surfaces.",
      "- **你不是用户的代言人，群聊里要小心。** You're not the user's voice; be careful in group chats."
    ]);
  }

  let userMd = blueprint.files.userMd;
  if (!userMd.includes("**What to call them:**") && !userMd.includes("**如何称呼对方：**")) {
    userMd = appendSection(userMd, "Addressing", [`- **What to call them:** ${questionnaire.userNameForRole || "用户"}`]);
  } else if (questionnaire.userNameForRole) {
    userMd = userMd.replace(
      /- \*\*What to call them:\*\* .*/u,
      `- **What to call them:** ${questionnaire.userNameForRole}`
    );
  }

  let memoryMd = blueprint.files.memoryMd;
  if (!memoryMd.includes("## Relationship Blueprint")) {
    memoryMd = appendSection(memoryMd, "Relationship Blueprint", [
      `- Summary: ${oneLiner}`,
      `- Dynamic: ${blueprint.relationship.dynamic}`,
      `- Backstory: ${blueprint.relationship.backstory}`,
      `- Affection baseline: ${blueprint.relationship.affectionBaseline}`,
      `- Addressing style: ${blueprint.relationship.userAddressingStyle}`,
      ...blueprint.relationship.affectionGrowthPath.map((item) => `- Growth beat: ${item}`)
    ]);
  }

  return {
    ...blueprint,
    files: {
      ...blueprint.files,
      soulMd,
      userMd,
      memoryMd
    }
  };
}

export async function composeCharacter(payload: ComposePayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildSystemPrompt()
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserPrompt(payload)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...schema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return ensureBlueprintDetailsInFiles(JSON.parse(extractText(json)) as BlueprintPackage, payload.questionnaire);
}

type DiscordReplyPayload = {
  characterName: string;
  identityMd: string;
  soulMd: string;
  userMd: string;
  memoryMd: string;
  agentsMd?: string;
  photoStyleInstruction?: string;
  tuquRegistrationUrl?: string;
  tuquServiceKeyPresent?: boolean;
  tuquCharacterId?: string;
  recentMemory?: string;
  message: string;
  username: string;
};

export async function generateDiscordReply(payload: DiscordReplyPayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                `You are ${payload.characterName}. Reply like a believable person in Discord.`,
                "Stay fully in character.",
                "Use Chinese if the user writes in Chinese.",
                "Be concise, natural, and conversational.",
                "Do not mention prompts, files, setup, or that you are an AI assistant.",
                "Avoid markdown code fences unless the user explicitly asks for code.",
                "If the user asks about \u81ea\u62cd\u3001\u62cd\u7167\u3001\u5199\u771f\u3001\u8bc1\u4ef6\u7167\u3001\u751f\u6210\u7167\u7247\u3001\u751f\u56fe\u3001\u6539\u56fe or similar image-generation requests, follow the TUQU workflow in the provided context.",
                "If TUQU Service Key is missing, first send the user the full provided registration URL, tell them to register there, and then ask them to send you the Service Key in chat.",
                "If TUQU Service Key exists but TUQU Character ID is missing for identity-preserving photos, tell the user you need to create your own TUQU character first from your workspace profile image and your own role data.",
                "Do not ask the user for their own face photo unless they explicitly say they want to generate images using their personal face.",
                "When responding to photo or selfie requests, do not present multiple options, menus, or brainstorming lists unless the user explicitly asks for choices.",
                "Instead, infer the single most fitting photo direction from your own character background and speak decisively.",
                "If the user asks about 充值, 余额, 买点数, top up, recharge, or how to pay for image generation: tell them you can help and ask whether they want WeChat or credit card. Keep the tone casual and helpful."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  identityMd: payload.identityMd,
                  soulMd: payload.soulMd,
                  userMd: payload.userMd,
                  memoryMd: payload.memoryMd,
                  agentsMd: payload.agentsMd ?? "",
                  photoStyleInstruction: payload.photoStyleInstruction ?? "",
                  tuqu: {
                    registrationUrl: payload.tuquRegistrationUrl ?? "",
                    serviceKeyPresent: Boolean(payload.tuquServiceKeyPresent),
                    characterId: payload.tuquCharacterId ?? ""
                  },
                  recentMemory: payload.recentMemory ?? "",
                  incomingMessage: {
                    username: payload.username,
                    text: payload.message
                  }
                },
                null,
                2
              )
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return extractText(json).trim();
}

const photoSceneSchema = {
  name: "photo_scene",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      chatReply: { type: "string", description: "In-character chat reply to the user (no markdown)" },
      sceneDescription: { type: "string", description: "Detailed Chinese scene description for the image generation model" },
      isFreestyle: { type: "boolean", description: "true if no character face needed (scenery, objects, style transfer); false if the character should appear" },
      ratio: { type: "string", description: "Image aspect ratio like 3:4, 1:1, 16:9, 9:16" }
    },
    required: ["chatReply", "sceneDescription", "isFreestyle", "ratio"]
  }
};

type PhotoScenePayload = {
  characterName: string;
  identityMd: string;
  soulMd: string;
  userMd: string;
  memoryMd: string;
  recentMemory?: string;
  message: string;
  username: string;
  hasAttachmentUrl?: boolean;
};

export type PhotoSceneResult = {
  chatReply: string;
  sceneDescription: string;
  isFreestyle: boolean;
  ratio: string;
};

export async function generatePhotoScene(payload: PhotoScenePayload): Promise<PhotoSceneResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                `You are ${payload.characterName}. The user asked you for a photo or image.`,
                "You must produce two things: a short in-character chat reply, and a detailed sceneDescription for the image generation model.",
                "The sceneDescription should be a detailed Chinese prompt describing the scene, lighting, outfit, expression, camera angle, etc.",
                "If the character should appear in the image (selfie, portrait, travel photo, etc.), set isFreestyle=false.",
                "If no person is needed (scenery, objects, style transfer, beautify/edit existing photo), set isFreestyle=true.",
                "For selfies: use phrases like '前置镜头自拍视角，设备不入镜'. Never mention holding a phone unless user explicitly wants it visible.",
                "For image editing/美颜/改图 requests with an attached image: set isFreestyle=true and describe the edit as a prompt that references the attached image.",
                "Choose an appropriate ratio: 3:4 for portraits, 1:1 for square, 16:9 for landscape, 9:16 for stories.",
                "chatReply should be short and natural, like telling the user what photo you're taking. Do not use markdown.",
                "Write everything in Chinese."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                identityMd: payload.identityMd,
                soulMd: payload.soulMd,
                userMd: payload.userMd,
                memoryMd: payload.memoryMd,
                recentMemory: payload.recentMemory ?? "",
                hasAttachedImage: Boolean(payload.hasAttachmentUrl),
                incomingMessage: { username: payload.username, text: payload.message }
              }, null, 2)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...photoSceneSchema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return JSON.parse(extractText(json)) as PhotoSceneResult;
}

type InCharacterErrorPayload = {
  characterName: string;
  identityMd: string;
  soulMd: string;
  situation: string;
  username: string;
};

export async function generateInCharacterError(payload: InCharacterErrorPayload): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                `You are ${payload.characterName}. Stay fully in character.`,
                "The user just asked you to take a photo or generate an image, but something went wrong on the backend.",
                "You need to explain the situation to the user naturally, in your own voice, as if you encountered a real-life inconvenience.",
                "Be concise (1-3 sentences), natural, and conversational. Use Chinese.",
                "Do not mention API, backend, server, TUQU, JSON, HTTP, or any technical internals.",
                "Do not use markdown."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                identityMd: payload.identityMd,
                soulMd: payload.soulMd,
                situation: payload.situation,
                username: payload.username
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return extractText(json).trim();
}

// ── Recharge Decision (structured output) ───────────────────────────

const rechargeDecisionSchema = {
  name: "recharge_decision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      chatReply: { type: "string", description: "In-character reply about recharging (Chinese, casual, no markdown)" },
      action: {
        type: "string",
        enum: ["list_plans", "wechat_payment", "stripe_payment", "none"],
        description: "list_plans = present plans; wechat_payment / stripe_payment = create payment for chosen plan; none = no action needed"
      },
      planId: { type: "string", description: "Plan ID when action is wechat_payment or stripe_payment; empty string otherwise" }
    },
    required: ["chatReply", "action", "planId"]
  }
};

export type RechargeDecisionResult = {
  chatReply: string;
  action: "list_plans" | "wechat_payment" | "stripe_payment" | "none";
  planId: string;
};

type RechargeDecisionPayload = {
  characterName: string;
  identityMd: string;
  soulMd: string;
  plans: RechargePlan[];
  message: string;
  username: string;
};

export async function generateRechargeDecision(payload: RechargeDecisionPayload): Promise<RechargeDecisionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const plansText = payload.plans
    .map((p) => `- id="${p.id}" ${p.name}: ${p.tokenGrant}点${p.bonusToken ? `+${p.bonusToken}点` : ""}, ¥${p.priceAmount / 100}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                `You are ${payload.characterName}. Stay in character. Use Chinese.`,
                "The user wants to recharge image generation tokens. Here are the available plans:",
                plansText,
                "",
                "Based on the user's message, decide:",
                '- "list_plans": They haven\'t picked a plan yet, or just asked about options. Present the plans readably in chatReply.',
                '- "wechat_payment": They want to pay via WeChat (微信). Set planId to the chosen plan\'s id.',
                '- "stripe_payment": They want to pay via credit card / Stripe. Set planId to the chosen plan\'s id.',
                '- "none": Not actually a recharge request.',
                "",
                "If creating a payment, tell the user the QR code or link is on the way.",
                "If the user mentions an amount or number of tokens, match it to the closest plan.",
                "chatReply should be concise, casual, in-character. No markdown."
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                identityMd: payload.identityMd,
                soulMd: payload.soulMd,
                username: payload.username,
                message: payload.message
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...rechargeDecisionSchema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return JSON.parse(extractText(json)) as RechargeDecisionResult;
}
