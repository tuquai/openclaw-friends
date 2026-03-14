import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildDiscordAccountId } from "@/lib/discord-account";
import { resolveOptionalPathEnv } from "@/lib/env-path";
import { inferMbtiFromAxes, PERSONALITY_AXIS_OPTIONS, QUESTION_OPTIONS } from "@/lib/mbti";
import {
  AppLanguage,
  BlueprintPackage,
  CharacterRecord,
  DiscordLink,
  DraftCharacterInput,
  PersonalityAxes,
  RelationshipQuestionnaireInput,
  TuquConfig,
  QuestionnaireInput,
  UserProfileInput
} from "@/lib/types";
import { readWorkspaceCharacterRecords, writeCharacterRecord } from "@/lib/workspace";
import { normalizeLanguage } from "@/lib/i18n";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(process.cwd(), "public", "uploads");
const dataFile = path.join(dataDir, "characters.json");
const userProfileFile = path.join(dataDir, "user-profile.json");
const openclawWorkspaceRoot = resolveOptionalPathEnv(
  process.env.OPENCLAW_WORKSPACE_ROOT,
  path.join(os.homedir(), ".openclaw")
);
const defaultTuquRegistrationUrl = "https://billing.tuqu.ai/dream-weaver/login";

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
      userAddressingStyle: raw.relationship?.userAddressingStyle ?? ""
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

function defaultUserProfile(): UserProfileInput {
  const userPersonality = {
    socialEnergy: PERSONALITY_AXIS_OPTIONS.socialEnergy[1].value,
    informationFocus: PERSONALITY_AXIS_OPTIONS.informationFocus[0].value,
    decisionStyle: PERSONALITY_AXIS_OPTIONS.decisionStyle[0].value,
    lifestylePace: PERSONALITY_AXIS_OPTIONS.lifestylePace[0].value,
    otherNotes: ""
  };

  return {
    language: "zh",
    userMbti: inferMbtiFromAxes(userPersonality),
    userPersonality,
    lifeStage: { selected: QUESTION_OPTIONS.lifeStage[3], custom: "" },
    communicationPreference: { selected: QUESTION_OPTIONS.communicationPreference[0], custom: "" }
  };
}

function defaultRelationshipQuestionnaire(): RelationshipQuestionnaireInput {
  return {
    userNameForRole: "",
    desiredBond: { selected: QUESTION_OPTIONS.desiredBond[0], custom: "" },
    treatmentPreference: { selected: [QUESTION_OPTIONS.treatmentPreference[0]], custom: "" },
    specialTraits: { selected: [QUESTION_OPTIONS.specialTraits[0]], custom: "" },
    affectionPlan: {
      initialFavorability: 45
    }
  };
}

function normalizeUserProfile(raw?: Partial<UserProfileInput | QuestionnaireInput>): UserProfileInput {
  const fallback = defaultUserProfile();
  const userPersonality = normalizePersonality(raw?.userPersonality, raw?.userMbti ?? fallback.userMbti);

  return {
    language: normalizeLanguage((raw as { language?: string } | undefined)?.language),
    userMbti: inferMbtiFromAxes(userPersonality),
    userPersonality,
    lifeStage: {
      selected: raw?.lifeStage?.selected ?? fallback.lifeStage.selected,
      custom: raw?.lifeStage?.custom ?? ""
    },
    communicationPreference: {
      selected: raw?.communicationPreference?.selected ?? fallback.communicationPreference.selected,
      custom: raw?.communicationPreference?.custom ?? ""
    }
  };
}

function normalizeRelationshipQuestionnaire(
  raw?: Partial<RelationshipQuestionnaireInput | QuestionnaireInput>
): RelationshipQuestionnaireInput {
  const fallback = defaultRelationshipQuestionnaire();

  return {
    userNameForRole: raw?.userNameForRole?.trim() || fallback.userNameForRole,
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
          : fallback.affectionPlan.initialFavorability
    }
  };
}

export function mergeQuestionnaire(
  userProfile?: Partial<UserProfileInput>,
  relationshipQuestionnaire?: Partial<RelationshipQuestionnaireInput>
): QuestionnaireInput {
  return {
    ...normalizeUserProfile(userProfile),
    ...normalizeRelationshipQuestionnaire(relationshipQuestionnaire)
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
    await fs.access(userProfileFile);
  } catch {
    let migratedUserProfile = defaultUserProfile();

    try {
      const rawCharacters = JSON.parse(await fs.readFile(dataFile, "utf8")) as LegacyCharacterRecord[];
      const legacyQuestionnaire = rawCharacters.find((record) => record.questionnaire)?.questionnaire;
      migratedUserProfile = normalizeUserProfile(legacyQuestionnaire);
    } catch {
      // Ignore migration failure and fall back to defaults.
    }

    await fs.writeFile(userProfileFile, JSON.stringify(migratedUserProfile, null, 2), "utf8");
  }
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
    mbti: raw.mbti ?? undefined,
    personality,
    language: normalizeLanguage((raw as { language?: string }).language),
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    questionnaire: normalizeRelationshipQuestionnaire(raw.questionnaire),
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

async function filterExistingPhotoPaths(photos: string[]) {
  const resolved = await Promise.all(
    photos.map(async (photo) => {
      if (!photo.startsWith("/uploads/")) {
        return photo;
      }

      const filePath = path.join(process.cwd(), "public", photo.replace(/^\//, ""));
      try {
        await fs.access(filePath);
        return photo;
      } catch {
        return null;
      }
    })
  );

  return resolved.filter((photo): photo is string => Boolean(photo));
}

async function sanitizeCharacterPhotos(record: CharacterRecord) {
  const photos = await filterExistingPhotoPaths(record.photos);
  if (photos.length === record.photos.length) {
    return record;
  }

  return {
    ...record,
    photos
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
  const normalized = (JSON.parse(raw) as LegacyCharacterRecord[]).map(normalizeCharacterRecord);
  const sanitized = await Promise.all(normalized.map((record) => sanitizeCharacterPhotos(record)));
  const hasChanges = sanitized.some((record, index) => record.photos.length !== normalized[index]?.photos.length);

  if (hasChanges) {
    await writeLocalCharacters(sanitized);
  }

  return sanitized;
}

async function writeLocalCharacters(characters: CharacterRecord[]) {
  await ensureStorage();
  await fs.writeFile(dataFile, JSON.stringify(characters, null, 2), "utf8");
}

async function readStoredUserProfile(): Promise<UserProfileInput> {
  await ensureStorage();
  const raw = JSON.parse(await fs.readFile(userProfileFile, "utf8")) as Partial<UserProfileInput | QuestionnaireInput>;
  return normalizeUserProfile(raw);
}

async function writeStoredUserProfile(userProfile: UserProfileInput) {
  await ensureStorage();
  await fs.writeFile(userProfileFile, JSON.stringify(userProfile, null, 2), "utf8");
}

async function readCharacters() {
  const workspaceRecords = await readWorkspaceCharacterRecords();
  const workspaceCharacters = await Promise.all(
    workspaceRecords.map(async ({ raw, workspacePath }) => {
      const normalized = normalizeCharacterRecord(raw as LegacyCharacterRecord);
      const enriched = await enrichWithWorkspaceData(normalized, workspacePath);
      const sanitized = await sanitizeCharacterPhotos(enriched);
      if (sanitized.photos.length !== enriched.photos.length) {
        await writeCharacterRecord(sanitized);
      }
      return sanitized;
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
  const mbti = input.mbti?.trim();

  return {
    name: input.name,
    age: input.age,
    gender: input.gender,
    occupation: input.occupation,
    heritage: input.heritage,
    worldSetting: input.worldSetting,
    concept: input.concept,
    mbti: mbti ? mbti : undefined,
    personality,
    language: normalizeLanguage(input.language),
    photos: input.photos,
    preset: input.preset
  };
}

export async function listCharacters() {
  return readCharacters();
}

export async function getUserProfile() {
  return readStoredUserProfile();
}

export async function updateUserProfile(userProfile?: Partial<UserProfileInput>) {
  const normalized = normalizeUserProfile(userProfile);
  await writeStoredUserProfile(normalized);
  return normalized;
}

export async function getCharacter(id: string) {
  const characters = await readCharacters();
  return characters.find((character) => character.id === id) ?? null;
}

export async function createCharacter(input: DraftCharacterInput, questionnaire?: RelationshipQuestionnaireInput) {
  const now = new Date().toISOString();
  const record: CharacterRecord = {
    id: crypto.randomUUID(),
    ...buildCharacterPatch(input),
    questionnaire: normalizeRelationshipQuestionnaire(questionnaire),
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

export async function updateCharacterFromDraft(
  id: string,
  input: DraftCharacterInput,
  questionnaire?: RelationshipQuestionnaireInput
) {
  return updateCharacter(id, {
    ...buildCharacterPatch(input),
    ...(questionnaire ? { questionnaire: normalizeRelationshipQuestionnaire(questionnaire) } : {})
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
