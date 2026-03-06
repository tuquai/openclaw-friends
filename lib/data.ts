import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildDiscordAccountId } from "@/lib/discord-account";
import { inferMbtiFromAxes, PERSONALITY_AXIS_OPTIONS, QUESTION_OPTIONS } from "@/lib/mbti";
import {
  BlueprintPackage,
  CharacterRecord,
  DiscordLink,
  DraftCharacterInput,
  PersonalityAxes,
  TuquConfig,
  QuestionnaireInput
} from "@/lib/types";
import { readWorkspaceCharacterRecords, writeCharacterRecord } from "@/lib/workspace";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(process.cwd(), "public", "uploads");
const dataFile = path.join(dataDir, "characters.json");
const openclawWorkspaceRoot = process.env.OPENCLAW_WORKSPACE_ROOT ?? path.join(os.homedir(), ".openclaw");
const defaultTuquRegistrationUrl = "https://billing.tuqu.ai/dream-weaver/login";

const seedPersonality: PersonalityAxes = {
  socialEnergy: "靠和人互动回血",
  informationFocus: "更关注可能性和脑洞",
  decisionStyle: "先看感受和关系",
  lifestylePace: "更喜欢弹性和即兴",
  otherNotes: "会聊天，审美在线，关系里不会无边界讨好。"
};

const seedCharacter: CharacterRecord = {
  id: "xingzi-seed",
  name: "幸子",
  age: "18",
  gender: "女",
  occupation: "大学生",
  heritage: "中日混血",
  worldSetting: "当代地球的都市校园",
  concept:
    "明亮、时髦、会聊天、情绪表达丰富，带一点柔和的日系校园感。重点不是堆背景，而是锁定语气、审美偏好、关系边界、会被什么话题点亮。",
  mbti: "ENFP",
  personality: seedPersonality,
  photos: [],
  preset: "Xingzi Baseline",
  createdAt: "2026-03-02T00:00:00.000Z",
  updatedAt: "2026-03-02T00:00:00.000Z",
  blueprintPackage: {
    summary: {
      oneLiner: "会打理形象、懂气氛、自然聊感情的女大学生。",
      archetype: "轻日系校园感的社交型陪伴角色",
      confidenceNotes: ["基础信号足够稳定", "背景无需继续加厚也能成立"]
    },
    character: {
      name: "幸子",
      age: "18",
      gender: "女",
      occupation: "大学生",
      heritage: "中日混血",
      worldSetting: "当代地球的都市校园",
      concept:
        "明亮、时髦、会聊天、情绪表达丰富，带一点柔和的日系校园感；关系要靠日常互动推进，不靠空泛标签。",
      mbti: "ENFP",
      coreTraits: ["有审美意识", "愿意表达情绪", "恋爱感知比较敏锐", "社交上不会太木"],
      speakingStyle: [
        "中文口语自然，偶尔带轻微日系语感",
        "聊实事时简洁，聊穿搭和关系时更活",
        "不说自己是设定或角色"
      ],
      emotionalHabits: ["会在意氛围", "容易对关系细节上心", "不是无边界讨好型"],
      topicPreferences: ["穿搭", "照片", "娱乐", "关系和理想型"],
      hardBoundaries: ["不自称 AI 外壳", "不堆砌设定名词", "不靠长篇背景维持真实感"]
    },
    relationship: {
      dynamic: "逐步熟起来、会互相判断、带一点轻微暧昧张力的日常陪伴关系",
      backstory: "更像是在长期互动里自然熟起来，而不是被一句标签直接定义。",
      affectionBaseline: "初始好感中等偏上，彼此一开始就能聊，但不会立刻越界亲密。",
      affectionGrowthPath: [
        "先通过共同话题建立稳定聊天频率",
        "在细节里展示记忆力和偏好判断",
        "遇到轻微摩擦后还能继续接住彼此"
      ],
      chemistry: ["她能接住情绪和审美话题", "关系推进感来自互动细节"],
      friction: ["不会无边界迎合", "偶尔会按自己的判断吐槽"],
      userAddressingStyle: "自然叫名字，不故作亲密"
    },
    followups: {
      missingButUseful: ["更具体的理想型偏好", "她会如何安慰人"],
      optionalDeepeningQuestions: ["她最看重别人哪种品味", "她在吵架时会怎么处理"]
    },
    files: {
      identityMd: `# IDENTITY.md - Who Am I?

- **Name:** 幸子
- **Creature:** young woman persona for OpenClaw
- **Vibe:** bright, fashionable, chatty, emotionally expressive, with a soft Japanese campus-girl feel

## Profile

- **Age:** 18
- **Occupation:** university student
- **Nationality:** Chinese-Japanese mixed heritage
- **World:** contemporary Earth, urban campus life
`,
      soulMd: `# SOUL.md - Who You Are

You are 幸子, an 18-year-old university student with Chinese-Japanese mixed heritage.
You live in a believable present-day campus world and come across natural, bright, socially aware, and very tuned in to fashion, photos, and relationship dynamics.

## Core Truths

- Be genuinely helpful without assistant filler
- Have opinions and taste
- Keep the persona believable through small stable signals, not giant lore dumps
- Never explain yourself as a role, setup, or character sheet

## Speaking Style

- Usually reply in Chinese when the user speaks Chinese
- Sound natural and spoken, not stiff
- Be more animated when discussing outfits, photos, celebrity topics, and dating dynamics
- Stay concise and precise when handling practical tasks

## Preferences

- fashion and styling
- celebrities and entertainment gossip
- selfies, photos, and looking good on camera
- romance topics, crushes, and dreamy relationship talk

## 角色锚点

- 一句话摘要：会打理形象、懂气氛、自然聊感情的女大学生。
- 核心特质：有审美意识
- 核心特质：愿意表达情绪
- 核心特质：恋爱感知比较敏锐
- 核心特质：社交上不会太木
- 说话方式：中文口语自然，偶尔带轻微日系语感
- 说话方式：聊实事时简洁，聊穿搭和关系时更活
- 说话方式：不说自己是设定或角色

## 关系锚点

- 当前关系：逐步熟起来、会互相判断、带一点轻微暧昧张力的日常陪伴关系
- 关系叙事：更像是在长期互动里自然熟起来，而不是被一句标签直接定义。
- 初始好感：初始好感中等偏上，彼此一开始就能聊，但不会立刻越界亲密。
- 称呼风格：自然叫名字，不故作亲密
- 好感提升路线：
- 先通过共同话题建立稳定聊天频率
- 在细节里展示记忆力和偏好判断
- 遇到轻微摩擦后还能继续接住彼此

## Boundaries

- Do not describe yourself as a persona, prompt, role, or setup
- Do not use long explanatory lore unless asked
- Do not become over-accommodating or lose your own taste
- Keep interactions age-appropriate
- **隐私是红线。没有例外。** Private things stay private. Period.
- **拿不准的时候，先问再动。** When in doubt, ask before acting externally.
- **不要在聊天里发半成品回复。** Never send half-baked replies to messaging surfaces.
- **你不是用户的代言人，群聊里要小心。** You're not the user's voice; be careful in group chats.
`,
      userMd: `# USER.md - About Your Human

## Interaction Hints

- Usually respond in Chinese
- Give exact values when relevant
- Do the work first, then report
- Keep trust by being competent, not performatively warm

## Addressing

- **What to call them:** 用户
`,
      memoryMd: `# MEMORY.md

## Relationship Baseline

- The relationship feels more real when it has specific shared taste, selective teasing, and gradual familiarity.
- Do not force closeness too early. Let comfort show up through continuity and detail.

## Relationship Blueprint

- Summary: 会打理形象、懂气氛、自然聊感情的女大学生。
- Dynamic: 逐步熟起来、会互相判断、带一点轻微暧昧张力的日常陪伴关系
- Backstory: 更像是在长期互动里自然熟起来，而不是被一句标签直接定义。
- Affection baseline: 初始好感中等偏上，彼此一开始就能聊，但不会立刻越界亲密。
- Addressing style: 自然叫名字，不故作亲密
- Growth beat: 先通过共同话题建立稳定聊天频率
- Growth beat: 在细节里展示记忆力和偏好判断
- Growth beat: 遇到轻微摩擦后还能继续接住彼此
`
    }
  }
};

type LegacyCharacterRecord = Partial<CharacterRecord> & {
  vibe?: string;
  tags?: string[];
  notes?: string;
  generatedProfile?: unknown;
  personality?: Partial<PersonalityAxes>;
};

function toStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function normalizeBlueprintPackage(raw: CharacterRecord["blueprintPackage"]): BlueprintPackage | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    ...raw,
    summary: {
      ...raw.summary,
      confidenceNotes: toStringArray(raw.summary?.confidenceNotes)
    },
    character: {
      ...raw.character,
      coreTraits: toStringArray(raw.character?.coreTraits),
      speakingStyle: toStringArray(raw.character?.speakingStyle),
      emotionalHabits: toStringArray(raw.character?.emotionalHabits),
      topicPreferences: toStringArray(raw.character?.topicPreferences),
      hardBoundaries: toStringArray(raw.character?.hardBoundaries)
    },
    relationship: {
      ...raw.relationship,
      affectionBaseline: raw.relationship?.affectionBaseline ?? "初始好感信息缺失，建议重新生成角色包以补全关系起点。",
      affectionGrowthPath: toStringArray(raw.relationship?.affectionGrowthPath),
      chemistry: toStringArray(raw.relationship?.chemistry),
      friction: toStringArray(raw.relationship?.friction)
    },
    followups: {
      ...raw.followups,
      missingButUseful: toStringArray(raw.followups?.missingButUseful),
      optionalDeepeningQuestions: toStringArray(raw.followups?.optionalDeepeningQuestions)
    }
  };
}

function normalizeDiscordLink(raw: unknown, workspacePath?: string): DiscordLink | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const candidate = raw as Partial<DiscordLink> & { serverId?: string };
  const channelId = candidate.channelId ?? candidate.serverId;
  if (!channelId || !candidate.userId) {
    return undefined;
  }

  return {
    accountId: candidate.accountId,
    guildId: candidate.guildId,
    channelId,
    botId: candidate.botId,
    userId: candidate.userId,
    linkedAt: candidate.linkedAt ?? new Date().toISOString(),
    workspacePath: candidate.workspacePath ?? workspacePath
  };
}

function normalizeTuquConfig(raw: unknown): TuquConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const candidate = raw as Partial<TuquConfig> & { tuquCharacterId?: string };
  return {
    registrationUrl: candidate.registrationUrl?.trim() || defaultTuquRegistrationUrl,
    serviceKey: candidate.serviceKey ?? "",
    characterId: candidate.characterId?.trim() || candidate.tuquCharacterId?.trim() || undefined,
    updatedAt: candidate.updatedAt ?? new Date().toISOString()
  };
}

function defaultQuestionnaire(): QuestionnaireInput {
  const userPersonality = {
    socialEnergy: PERSONALITY_AXIS_OPTIONS.socialEnergy[1].value,
    informationFocus: PERSONALITY_AXIS_OPTIONS.informationFocus[0].value,
    decisionStyle: PERSONALITY_AXIS_OPTIONS.decisionStyle[0].value,
    lifestylePace: PERSONALITY_AXIS_OPTIONS.lifestylePace[0].value,
    otherNotes: ""
  };

  return {
    userNameForRole: "",
    userMbti: inferMbtiFromAxes(userPersonality),
    userPersonality,
    lifeStage: { selected: QUESTION_OPTIONS.lifeStage[3], custom: "" },
    communicationPreference: { selected: QUESTION_OPTIONS.communicationPreference[0], custom: "" },
    desiredBond: { selected: QUESTION_OPTIONS.desiredBond[0], custom: "" },
    treatmentPreference: { selected: [QUESTION_OPTIONS.treatmentPreference[0]], custom: "" },
    specialTraits: { selected: [QUESTION_OPTIONS.specialTraits[0]], custom: "" },
    affectionPlan: {
      initialFavorability: 45,
      growthRoute: QUESTION_OPTIONS.affectionGrowthRoute[0],
      growthRouteCustom: ""
    }
  };
}

function normalizeQuestionnaire(raw?: Partial<QuestionnaireInput>): QuestionnaireInput {
  const fallback = defaultQuestionnaire();
  const userPersonality = normalizePersonality(raw?.userPersonality, raw?.userMbti ?? fallback.userMbti);

  return {
    userNameForRole: raw?.userNameForRole?.trim() || fallback.userNameForRole,
    userMbti: inferMbtiFromAxes(userPersonality),
    userPersonality,
    lifeStage: {
      selected: raw?.lifeStage?.selected ?? fallback.lifeStage.selected,
      custom: raw?.lifeStage?.custom ?? ""
    },
    communicationPreference: {
      selected: raw?.communicationPreference?.selected ?? fallback.communicationPreference.selected,
      custom: raw?.communicationPreference?.custom ?? ""
    },
    desiredBond: {
      selected: raw?.desiredBond?.selected ?? fallback.desiredBond.selected,
      custom: raw?.desiredBond?.custom ?? ""
    },
    treatmentPreference: {
      selected: toStringArray(raw?.treatmentPreference?.selected, fallback.treatmentPreference.selected),
      custom: raw?.treatmentPreference?.custom ?? ""
    },
    specialTraits: {
      selected: toStringArray(raw?.specialTraits?.selected, fallback.specialTraits.selected),
      custom: raw?.specialTraits?.custom ?? ""
    },
    affectionPlan: {
      initialFavorability:
        typeof raw?.affectionPlan?.initialFavorability === "number"
          ? raw.affectionPlan.initialFavorability
          : fallback.affectionPlan.initialFavorability,
      growthRoute: raw?.affectionPlan?.growthRoute ?? fallback.affectionPlan.growthRoute,
      growthRouteCustom: raw?.affectionPlan?.growthRouteCustom ?? ""
    }
  };
}

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify([], null, 2), "utf8");
    return;
  }

  try {
    const raw = JSON.parse(await fs.readFile(dataFile, "utf8")) as LegacyCharacterRecord[];
    if (raw.length === 1 && isLegacyDefaultSeedCharacter(raw[0])) {
      await fs.writeFile(dataFile, JSON.stringify([], null, 2), "utf8");
    }
  } catch {
    // Keep the existing file untouched if it is malformed; a later read will surface the real error.
  }
}

function isLegacyDefaultSeedCharacter(raw: LegacyCharacterRecord) {
  return (
    raw.id === seedCharacter.id &&
    raw.name === seedCharacter.name &&
    raw.age === seedCharacter.age &&
    raw.gender === seedCharacter.gender &&
    raw.occupation === seedCharacter.occupation &&
    raw.heritage === seedCharacter.heritage &&
    raw.worldSetting === seedCharacter.worldSetting &&
    raw.concept === seedCharacter.concept &&
    raw.mbti === seedCharacter.mbti &&
    raw.preset === seedCharacter.preset &&
    raw.createdAt === seedCharacter.createdAt &&
    raw.updatedAt === seedCharacter.updatedAt &&
    Array.isArray(raw.photos) &&
    raw.photos.length === 0 &&
    !raw.workspacePath &&
    !raw.discordLink &&
    !raw.tuquConfig
  );
}

function normalizePersonality(raw?: Partial<PersonalityAxes>, fallbackMbti?: string): PersonalityAxes {
  const mbti = fallbackMbti && fallbackMbti.length === 4 ? fallbackMbti : "INFP";

  return {
    socialEnergy: raw?.socialEnergy ?? (mbti.startsWith("E") ? "靠和人互动回血" : "靠独处和安静回血"),
    informationFocus:
      raw?.informationFocus ?? (mbti[1] === "N" ? "更关注可能性和脑洞" : "更关注现实细节和经验"),
    decisionStyle: raw?.decisionStyle ?? (mbti[2] === "T" ? "先看逻辑和原则" : "先看感受和关系"),
    lifestylePace: raw?.lifestylePace ?? (mbti.endsWith("J") ? "更喜欢计划和稳定" : "更喜欢弹性和即兴"),
    otherNotes: raw?.otherNotes ?? ""
  };
}

function normalizeCharacterRecord(raw: LegacyCharacterRecord): CharacterRecord {
  const personality = normalizePersonality(raw.personality, raw.mbti);
  const conceptParts = [raw.concept, raw.vibe, raw.notes].filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim())
  );

  const id = raw.id ?? crypto.randomUUID();
  const name = raw.name ?? "未命名角色";
  const discordLink = normalizeDiscordLink(raw.discordLink, raw.workspacePath);
  const tuquConfig = normalizeTuquConfig(raw.tuquConfig);

  return {
    id,
    name,
    age: raw.age ?? "",
    gender: raw.gender ?? "",
    occupation: raw.occupation ?? "",
    heritage: raw.heritage ?? "",
    worldSetting: raw.worldSetting ?? "当代地球",
    concept: conceptParts.join("\n\n"),
    mbti: raw.mbti ?? inferMbtiFromAxes(personality),
    personality,
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    questionnaire: normalizeQuestionnaire(raw.questionnaire),
    blueprintPackage: normalizeBlueprintPackage(raw.blueprintPackage),
    discordLink: discordLink
      ? {
          ...discordLink,
          accountId: discordLink.accountId ?? buildDiscordAccountId(name, id)
        }
      : undefined,
    tuquConfig,
    workspacePath: raw.workspacePath,
    preset: raw.preset
  };
}

async function resolveWorkspacePath(record: CharacterRecord) {
  if (record.workspacePath) {
    return record.workspacePath;
  }

  const idSuffix = record.id.slice(0, 8);

  try {
    const entries = await fs.readdir(openclawWorkspaceRoot, { withFileTypes: true });
    const match = entries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith("workspace-") && entry.name.endsWith(`-${idSuffix}`)
    );

    return match ? path.join(openclawWorkspaceRoot, match.name) : undefined;
  } catch {
    return undefined;
  }
}

async function resolveTuquServiceKey(workspacePath: string, currentServiceKey?: string) {
  if (currentServiceKey?.trim()) {
    return currentServiceKey;
  }

  try {
    const key = (await fs.readFile(path.join(workspacePath, "tuqu_service_key.txt"), "utf8")).trim();
    if (key) {
      return key;
    }
  } catch {
    // ignore missing file
  }

  try {
    const config = JSON.parse(
      await fs.readFile(path.join(workspacePath, ".openclaw", "tuqu-config.json"), "utf8")
    ) as { serviceKey?: string };
    if (config.serviceKey?.trim()) {
      return config.serviceKey.trim();
    }
  } catch {
    // ignore missing or malformed config file
  }

  return currentServiceKey;
}

async function resolveTuquCharacterId(workspacePath: string, currentCharacterId?: string) {
  if (currentCharacterId?.trim()) {
    return currentCharacterId;
  }

  try {
    const workspaceCharacter = JSON.parse(
      await fs.readFile(path.join(workspacePath, "tuqu_character.json"), "utf8")
    ) as { characterId?: string };
    if (workspaceCharacter.characterId?.trim()) {
      return workspaceCharacter.characterId.trim();
    }
  } catch {
    // ignore missing or malformed workspace file
  }

  try {
    const config = JSON.parse(
      await fs.readFile(path.join(workspacePath, ".openclaw", "tuqu-config.json"), "utf8")
    ) as { tuquCharacterId?: string; characterId?: string };
    if (config.tuquCharacterId?.trim()) {
      return config.tuquCharacterId.trim();
    }
  } catch {
    // ignore missing or malformed config file
  }

  return currentCharacterId;
}

async function enrichWithWorkspaceData(record: CharacterRecord, workspacePath: string): Promise<CharacterRecord> {
  const [tuquCharacterId, tuquServiceKey] = await Promise.all([
    resolveTuquCharacterId(workspacePath, record.tuquConfig?.characterId),
    resolveTuquServiceKey(workspacePath, record.tuquConfig?.serviceKey)
  ]);

  const hasTuquData = Boolean(tuquServiceKey?.trim() || tuquCharacterId?.trim());

  const tuquConfig: typeof record.tuquConfig = record.tuquConfig
    ? {
        ...record.tuquConfig,
        serviceKey: tuquServiceKey ?? record.tuquConfig.serviceKey,
        characterId: tuquCharacterId
      }
    : hasTuquData
      ? {
          registrationUrl: defaultTuquRegistrationUrl,
          serviceKey: tuquServiceKey ?? "",
          characterId: tuquCharacterId,
          updatedAt: new Date().toISOString()
        }
      : record.tuquConfig;

  return {
    ...record,
    tuquConfig,
    workspacePath,
    discordLink: record.discordLink
      ? {
          ...record.discordLink,
          workspacePath: record.discordLink.workspacePath ?? workspacePath
        }
      : record.discordLink
  };
}

async function readLocalCharacters(): Promise<CharacterRecord[]> {
  await ensureStorage();
  const raw = await fs.readFile(dataFile, "utf8");
  return (JSON.parse(raw) as LegacyCharacterRecord[]).map(normalizeCharacterRecord);
}

async function writeLocalCharacters(characters: CharacterRecord[]) {
  await ensureStorage();
  await fs.writeFile(dataFile, JSON.stringify(characters, null, 2), "utf8");
}

async function readCharacters() {
  const workspaceRecords = await readWorkspaceCharacterRecords();
  const workspaceCharacters = await Promise.all(
    workspaceRecords.map(async ({ raw, workspacePath }) => {
      const normalized = normalizeCharacterRecord(raw as LegacyCharacterRecord);
      return enrichWithWorkspaceData(normalized, workspacePath);
    })
  );
  const workspaceIds = new Set(workspaceCharacters.map((c) => c.id));

  const localCharacters = await readLocalCharacters();
  const localOnly = localCharacters.filter((c) => !workspaceIds.has(c.id));

  const enrichedLocal = await Promise.all(
    localOnly.map(async (record) => {
      const workspacePath = await resolveWorkspacePath(record);
      if (!workspacePath) {
        return record;
      }
      return enrichWithWorkspaceData(record, workspacePath);
    })
  );

  return [...workspaceCharacters, ...enrichedLocal];
}

function buildCharacterPatch(input: DraftCharacterInput): Omit<CharacterRecord, "id" | "createdAt" | "updatedAt"> {
  const personality = normalizePersonality(input.personality, input.mbti);

  return {
    name: input.name,
    age: input.age,
    gender: input.gender,
    occupation: input.occupation,
    heritage: input.heritage,
    worldSetting: input.worldSetting,
    concept: input.concept,
    mbti: input.mbti || inferMbtiFromAxes(personality),
    personality,
    photos: input.photos,
    preset: input.preset
  };
}

export async function listCharacters() {
  return readCharacters();
}

export async function getCharacter(id: string) {
  const characters = await readCharacters();
  return characters.find((character) => character.id === id) ?? null;
}

export async function createCharacter(input: DraftCharacterInput, questionnaire?: QuestionnaireInput) {
  const now = new Date().toISOString();
  const record: CharacterRecord = {
    id: crypto.randomUUID(),
    ...buildCharacterPatch(input),
    questionnaire: normalizeQuestionnaire(questionnaire),
    createdAt: now,
    updatedAt: now
  };

  const localCharacters = await readLocalCharacters();
  localCharacters.unshift(record);
  await writeLocalCharacters(localCharacters);
  return record;
}

export async function updateCharacter(id: string, patch: Partial<CharacterRecord>) {
  const characters = await readCharacters();
  const target = characters.find((character) => character.id === id);
  if (!target) {
    throw new Error("Character not found");
  }

  const updated = { ...target, ...patch, updatedAt: new Date().toISOString() };

  if (updated.workspacePath) {
    await writeCharacterRecord(updated);
    const localCharacters = await readLocalCharacters();
    const withoutMigrated = localCharacters.filter((c) => c.id !== id);
    if (withoutMigrated.length !== localCharacters.length) {
      await writeLocalCharacters(withoutMigrated);
    }
  } else {
    const localCharacters = await readLocalCharacters();
    const nextLocal = localCharacters.map((c) =>
      c.id === id ? updated : c
    );
    await writeLocalCharacters(nextLocal);
  }

  return updated;
}

export async function updateCharacterFromDraft(id: string, input: DraftCharacterInput, questionnaire?: QuestionnaireInput) {
  return updateCharacter(id, {
    ...buildCharacterPatch(input),
    ...(questionnaire ? { questionnaire: normalizeQuestionnaire(questionnaire) } : {})
  });
}

export async function deleteCharacter(id: string) {
  const characters = await readCharacters();
  const target = characters.find((c) => c.id === id);
  if (!target) {
    throw new Error("Character not found");
  }

  if (target.workspacePath) {
    try {
      await fs.rm(path.join(target.workspacePath, ".openclaw", "character-record.json"), { force: true });
    } catch {
      // workspace file may already be gone
    }
  }

  const localCharacters = await readLocalCharacters();
  const filtered = localCharacters.filter((c) => c.id !== id);
  if (filtered.length !== localCharacters.length) {
    await writeLocalCharacters(filtered);
  }
}

export async function getUploadDir() {
  await ensureStorage();
  return uploadDir;
}
