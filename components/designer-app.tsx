"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buildDiscordAccountId } from "@/lib/discord-account";
import {
  AppLanguage,
  BlueprintPackage,
  CharacterRecord,
  DiscordLink,
  DiscordRuntimeConfig,
  DiscordRuntimeStatus,
  DraftCharacterInput,
  MultiChoiceInput,
  QuestionnaireInput,
  RelationshipQuestionnaireInput,
  SingleChoiceInput,
  UserProfileInput
} from "@/lib/types";
import type { WorkspaceSummary } from "@/lib/workspace";
import type { TuquConfig } from "@/lib/types";
import {
  inferMbtiFromAxes,
  PERSONALITY_AXIS_OPTIONS,
  QUESTION_OPTIONS,
  summarizeMbti
} from "@/lib/mbti";
import { APP_LANGUAGES, getLanguageLabel, t, translateOption } from "@/lib/i18n";

type DesignerAppProps = {
  githubUrl: string;
  initialCharacters: CharacterRecord[];
  initialUserProfile: UserProfileInput;
  repoUpdatedAt: string;
};

type DesignerViewMode = "browse" | "edit";
type EditorStep = "profile" | "details" | "discord" | "tuqu";

function getEditorSteps(language: AppLanguage): Array<{ key: EditorStep; title: string; description: string }> {
  return [
    {
      key: "profile",
      title: t(language, "step.profile.title"),
      description: t(language, "step.profile.description")
    },
    {
      key: "details",
      title: t(language, "step.details.title"),
      description: t(language, "step.details.description")
    },
    {
      key: "discord",
      title: t(language, "step.discord.title"),
      description: t(language, "step.discord.description")
    },
    {
      key: "tuqu",
      title: t(language, "step.tuqu.title"),
      description: t(language, "step.tuqu.description")
    }
  ];
}

const defaultCharacterPersonality = {
  socialEnergy: PERSONALITY_AXIS_OPTIONS.socialEnergy[0].value,
  informationFocus: PERSONALITY_AXIS_OPTIONS.informationFocus[0].value,
  decisionStyle: PERSONALITY_AXIS_OPTIONS.decisionStyle[1].value,
  lifestylePace: PERSONALITY_AXIS_OPTIONS.lifestylePace[1].value,
  otherNotes: ""
};

const defaultUserPersonality = {
  socialEnergy: PERSONALITY_AXIS_OPTIONS.socialEnergy[1].value,
  informationFocus: PERSONALITY_AXIS_OPTIONS.informationFocus[0].value,
  decisionStyle: PERSONALITY_AXIS_OPTIONS.decisionStyle[0].value,
  lifestylePace: PERSONALITY_AXIS_OPTIONS.lifestylePace[0].value,
  otherNotes: ""
};

function buildInitialDraft(language: AppLanguage): DraftCharacterInput {
  return {
    name: "",
    age: "",
    gender: "",
    occupation: "",
    heritage: "",
    worldSetting: "当代地球",
    concept: "",
    mbti: inferMbtiFromAxes(defaultCharacterPersonality),
    personality: defaultCharacterPersonality,
    language,
    photos: [],
    preset: "Custom"
  };
}

const initialRelationshipQuestionnaire: RelationshipQuestionnaireInput = {
  userNameForRole: "",
  desiredBond: { selected: QUESTION_OPTIONS.desiredBond[0], custom: "" },
  treatmentPreference: { selected: [QUESTION_OPTIONS.treatmentPreference[0]], custom: "" },
  specialTraits: { selected: [QUESTION_OPTIONS.specialTraits[0]], custom: "" },
  affectionPlan: {
    initialFavorability: 45,
    growthRoute: QUESTION_OPTIONS.affectionGrowthRoute[0],
    growthRouteCustom: ""
  }
};

const DATE_LOCALES: Record<AppLanguage, string> = {
  zh: "zh-CN",
  en: "en-US",
  ja: "ja-JP"
};

const TUTORIAL_VIDEO_LINKS = {
  bilibili: "https://www.bilibili.com/video/BV1wkNMzsE5v/?spm_id_from=333.1007.top_right_bar_window_history.content.click"
} as const;

function safeList(value: string[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function emptyDiscordLink(): DiscordLink {
  return {
    accountId: "",
    channelId: "",
    userId: "",
    linkedAt: ""
  };
}

function emptyBlueprintFiles() {
  return {
    identityMd: "",
    soulMd: "",
    userMd: "",
    memoryMd: ""
  };
}

function defaultTuquConfig(): TuquConfig {
  return {
    registrationUrl: "https://billing.tuqu.ai/dream-weaver/login",
    serviceKey: "",
    updatedAt: "",
    characterId: undefined
  };
}

function characterPreview(character: CharacterRecord, language: AppLanguage) {
  const fallbackOccupation =
    language === "en" ? "No role yet" : language === "ja" ? "未設定" : "未填身份";
  const fallbackWorld =
    language === "en" ? "No world setting" : language === "ja" ? "世界観未設定" : "未设定世界观";

  return (
    character.blueprintPackage?.summary.oneLiner ||
    character.concept ||
    `${character.occupation || fallbackOccupation} / ${character.worldSetting || fallbackWorld}`
  ).trim();
}

function characterAvatarSrc(character: Pick<CharacterRecord, "id" | "updatedAt">) {
  const query = character.updatedAt ? `?v=${encodeURIComponent(character.updatedAt)}` : "";
  return `/api/characters/${character.id}/avatar${query}`;
}

function snapshotDraft(input: DraftCharacterInput) {
  return JSON.stringify(input);
}

function snapshotUserProfile(input: UserProfileInput) {
  return JSON.stringify({
    ...input,
    userMbti: inferMbtiFromAxes(input.userPersonality)
  });
}

function snapshotRelationshipQuestionnaire(input: RelationshipQuestionnaireInput) {
  return JSON.stringify(input);
}

function formatAgeLabel(language: AppLanguage, age: string) {
  if (!age.trim()) {
    return "";
  }

  if (language === "en") {
    return `${age} y/o`;
  }

  if (language === "ja") {
    return `${age}歳`;
  }

  return `${age} 岁`;
}

function formatRepoUpdatedAt(language: AppLanguage, value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function isBrowserAccessiblePhoto(photo: string) {
  return (
    photo.startsWith("/") ||
    photo.startsWith("http://") ||
    photo.startsWith("https://") ||
    photo.startsWith("data:")
  );
}

export function DesignerApp({
  githubUrl,
  initialCharacters,
  initialUserProfile: initialUserProfileProp,
  repoUpdatedAt
}: DesignerAppProps) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [selectedId, setSelectedId] = useState(initialCharacters[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<DesignerViewMode>(initialCharacters.length ? "browse" : "edit");
  const [editorStep, setEditorStep] = useState<EditorStep>("profile");
  const [draft, setDraft] = useState(() => buildInitialDraft(initialUserProfileProp.language));
  const [userProfile, setUserProfile] = useState(initialUserProfileProp);
  const [relationshipQuestionnaire, setRelationshipQuestionnaire] = useState(initialRelationshipQuestionnaire);
  const [discordLinkDraft, setDiscordLinkDraft] = useState<DiscordLink>(emptyDiscordLink());
  const [tuquConfigDraft, setTuquConfigDraft] = useState<TuquConfig>(defaultTuquConfig());
  const [discordBotTokenDraft, setDiscordBotTokenDraft] = useState("");
  const [blueprintFilesDraft, setBlueprintFilesDraft] = useState(emptyBlueprintFiles());
  const [discordRuntimeConfig, setDiscordRuntimeConfig] = useState<DiscordRuntimeConfig>({
    accounts: {},
    updatedAt: ""
  });
  const [discordRuntimeStatus, setDiscordRuntimeStatus] = useState<DiscordRuntimeStatus>({
    running: false,
    accounts: []
  });
  const [status, setStatus] = useState(() => t(initialUserProfileProp.language, "status.readyCreate"));
  const [userProfileStatus, setUserProfileStatus] = useState(() =>
    t(initialUserProfileProp.language, "status.userAutoSave")
  );
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [discordStatus, setDiscordStatus] = useState("");
  const [blueprintFilesStatus, setBlueprintFilesStatus] = useState("");
  const [tuquStatus, setTuquStatus] = useState("");
  const [discordRuntimeMessage, setDiscordRuntimeMessage] = useState("");
  
  const [isSaving, startSaving] = useTransition();
  const [isAdvancingProfile, startAdvancingProfile] = useTransition();
  const [isSavingDiscord, startSavingDiscord] = useTransition();
  const [isRepairingOpenClawRegistration, startRepairingOpenClawRegistration] = useTransition();
  const [isSavingBlueprintFiles, startSavingBlueprintFiles] = useTransition();
  const [isSavingTuqu, startSavingTuqu] = useTransition();
  const [isCreatingTuquCharacter, startCreatingTuquCharacter] = useTransition();
  const [isStartingDiscordRuntime, startStartingDiscordRuntime] = useTransition();
  const [isStoppingDiscordRuntime, startStoppingDiscordRuntime] = useTransition();
  const [showTuquCharacterInfo, setShowTuquCharacterInfo] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoadingWorkspaces, startLoadingWorkspaces] = useTransition();
  const [isImportingWorkspace, startImportingWorkspace] = useTransition();
  const userProfileHydratedRef = useRef(false);
  const userProfileSavedSnapshotRef = useRef(
    snapshotUserProfile(initialUserProfileProp)
  );
  const draftBaselineSnapshotRef = useRef(snapshotDraft(buildInitialDraft(initialUserProfileProp.language)));
  const userProfileBaselineSnapshotRef = useRef(snapshotUserProfile(initialUserProfileProp));
  const relationshipBaselineSnapshotRef = useRef(
    snapshotRelationshipQuestionnaire(initialRelationshipQuestionnaire)
  );
  

  const selected = characters.find((character) => character.id === selectedId) ?? null;
  const uiLanguage = userProfile.language;
  const editorSteps = getEditorSteps(uiLanguage);
  const selectedDiscordAccountId = selected ? buildDiscordAccountId(selected.name, selected.id) : "";
  const savedDiscordAccounts = Object.values(discordRuntimeConfig.accounts);
  const isEditingExisting = Boolean(selected);
  const inferredCharacterMbti = inferMbtiFromAxes(draft.personality);
  const inferredUserMbti = inferMbtiFromAxes(userProfile.userPersonality);
  const activePreset = summarizeMbti(inferredCharacterMbti);
  const activeUserPreset = summarizeMbti(inferredUserMbti);
  const coreTraits = safeList(selected?.blueprintPackage?.character.coreTraits);
  const speakingStyle = safeList(selected?.blueprintPackage?.character.speakingStyle);
  const affectionGrowthPath = safeList(selected?.blueprintPackage?.relationship.affectionGrowthPath);
  const chemistry = safeList(selected?.blueprintPackage?.relationship.chemistry);
  const hardBoundaries = safeList(selected?.blueprintPackage?.character.hardBoundaries);
  const optionalDeepeningQuestions = safeList(
    selected?.blueprintPackage?.followups.optionalDeepeningQuestions
  );
  const currentEditorStepIndex = editorSteps.findIndex((step) => step.key === editorStep);
  const currentEditorStepMeta = editorSteps[currentEditorStepIndex] ?? editorSteps[0];
  const currentDraftSnapshot = snapshotDraft(serializedDraft());
  const currentUserProfileSnapshot = snapshotUserProfile({
    ...userProfile,
    userMbti: inferredUserMbti
  });
  const currentRelationshipSnapshot = snapshotRelationshipQuestionnaire(serializedQuestionnaire());
  const isProfileStepDirty =
    currentDraftSnapshot !== draftBaselineSnapshotRef.current ||
    currentUserProfileSnapshot !== userProfileBaselineSnapshotRef.current ||
    currentRelationshipSnapshot !== relationshipBaselineSnapshotRef.current;
  const canJumpToAnyStep = Boolean(selected?.workspacePath);

  useEffect(() => {
    const emptyDraft = buildInitialDraft(userProfile.language);
    setDraft(selected ? draftFromCharacter(selected) : emptyDraft);
    setRelationshipQuestionnaire(selected?.questionnaire ?? initialRelationshipQuestionnaire);
    setDiscordLinkDraft(selected?.discordLink ?? emptyDiscordLink());
    setTuquConfigDraft(selected?.tuquConfig ?? defaultTuquConfig());
    setBlueprintFilesDraft(selected?.blueprintPackage?.files ?? emptyBlueprintFiles());
    setDiscordStatus("");
    setTuquStatus("");
    setBlueprintFilesStatus("");
    setWorkspaceStatus("");
    setShowTuquCharacterInfo(false);
    draftBaselineSnapshotRef.current = snapshotDraft(selected ? draftFromCharacter(selected) : emptyDraft);
    userProfileBaselineSnapshotRef.current = snapshotUserProfile({
      ...userProfile,
      userMbti: inferMbtiFromAxes(userProfile.userPersonality)
    });
    relationshipBaselineSnapshotRef.current = snapshotRelationshipQuestionnaire(
      selected?.questionnaire ?? initialRelationshipQuestionnaire
    );
  }, [selected]);

  useEffect(() => {
    setUserProfileStatus(t(uiLanguage, "status.userAutoSave"));
  }, [uiLanguage]);

  useEffect(() => {
    if (!selectedDiscordAccountId) {
      setDiscordBotTokenDraft("");
      return;
    }

    setDiscordBotTokenDraft(discordRuntimeConfig.accounts[selectedDiscordAccountId]?.botToken ?? "");
  }, [discordRuntimeConfig, selectedDiscordAccountId]);

  useEffect(() => {
    void loadDiscordRuntimeState();
  }, []);

  useEffect(() => {
    const nextSnapshot = snapshotUserProfile({
      ...userProfile,
      userMbti: inferredUserMbti
    });

    if (!userProfileHydratedRef.current) {
      userProfileHydratedRef.current = true;
      return;
    }

    if (nextSnapshot === userProfileSavedSnapshotRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setUserProfileStatus(t(uiLanguage, "status.userSaving"));
        const response = await fetch("/api/user-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...userProfile,
            userMbti: inferredUserMbti
          }),
          signal: controller.signal
        });
        const json = (await response.json()) as { userProfile?: UserProfileInput; error?: string };
        if (!response.ok || !json.userProfile) {
          throw new Error(json.error ?? t(uiLanguage, "status.userSaveFailed"));
        }
        userProfileSavedSnapshotRef.current = snapshotUserProfile(json.userProfile);
        setUserProfileStatus(t(uiLanguage, "status.userSaved"));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setUserProfileStatus(error instanceof Error ? error.message : t(uiLanguage, "status.userSaveFailed"));
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [userProfile, inferredUserMbti, uiLanguage]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setStatus("正在上传照片...");
    const nextPhotos = [...draft.photos];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const json = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !json.path) {
        throw new Error(json.error ?? "上传失败");
      }

      nextPhotos.push(json.path);
    }

    setDraft((current) => ({ ...current, photos: nextPhotos }));
    setStatus("照片已上传，可以继续补全角色。");
  }

  function handleDraftChange<K extends keyof Omit<DraftCharacterInput, "personality" | "photos">>(
    key: K,
    value: DraftCharacterInput[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleCharacterPersonalityChange(key: keyof DraftCharacterInput["personality"], value: string) {
    setDraft((current) => {
      const personality = { ...current.personality, [key]: value };
      return { ...current, personality, mbti: inferMbtiFromAxes(personality) };
    });
  }

  function handleUserPersonalityChange(key: keyof UserProfileInput["userPersonality"], value: string) {
    setUserProfile((current) => {
      const userPersonality = { ...current.userPersonality, [key]: value };
      return { ...current, userPersonality, userMbti: inferMbtiFromAxes(userPersonality) };
    });
  }

  function handleUserSingleChoiceChange<K extends keyof Pick<UserProfileInput, "lifeStage" | "communicationPreference">>(
    key: K,
    field: keyof SingleChoiceInput,
    value: string
  ) {
    setUserProfile((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value
      }
    }));
  }

  function handleRelationshipSingleChoiceChange<
    K extends keyof Pick<RelationshipQuestionnaireInput, "desiredBond">
  >(key: K, field: keyof SingleChoiceInput, value: string) {
    setRelationshipQuestionnaire((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value
      }
    }));
  }

  function handleMultiChoiceToggle<
    K extends keyof Pick<RelationshipQuestionnaireInput, "treatmentPreference" | "specialTraits">
  >(
    key: K,
    value: string
  ) {
    setRelationshipQuestionnaire((current) => {
      const selectedItems = current[key].selected.includes(value)
        ? current[key].selected.filter((item) => item !== value)
        : [...current[key].selected, value];

      return {
        ...current,
        [key]: {
          ...current[key],
          selected: selectedItems
        }
      };
    });
  }

  function handleMultiChoiceCustomChange<
    K extends keyof Pick<RelationshipQuestionnaireInput, "treatmentPreference" | "specialTraits">
  >(
    key: K,
    value: string
  ) {
    setRelationshipQuestionnaire((current) => ({
      ...current,
      [key]: {
        ...current[key],
        custom: value
      }
    }));
  }

  function mergeCharacterRecord(character: CharacterRecord) {
    setCharacters((current) => {
      const exists = current.some((item) => item.id === character.id);
      if (!exists) {
        return [character, ...current];
      }

      return current.map((item) => (item.id === character.id ? character : item));
    });
    setSelectedId(character.id);
  }

  function handleDiscordDraftChange(
    key: keyof Pick<DiscordLink, "guildId" | "channelId" | "userId">,
    value: string
  ) {
    setDiscordLinkDraft((current) => ({ ...current, [key]: value }));
  }

  function handleDiscordRuntimeConfigChange(value: string) {
    setDiscordBotTokenDraft(value);
  }

  function handleBlueprintFileChange(
    key: keyof ReturnType<typeof emptyBlueprintFiles>,
    value: string
  ) {
    setBlueprintFilesDraft((current) => ({ ...current, [key]: value }));
  }

  function handleTuquConfigChange(key: keyof TuquConfig, value: string) {
    setTuquConfigDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function serializedDraft() {
    return {
      ...draft,
      mbti: inferredCharacterMbti
    };
  }

  function serializedQuestionnaire() {
    return relationshipQuestionnaire;
  }

  function composeQuestionnairePayload(): QuestionnaireInput {
    return {
      ...userProfile,
      ...relationshipQuestionnaire,
      userMbti: inferredUserMbti
    };
  }

  function draftPhotoPreviewSrc(photo: string, index: number) {
    if (selected && index === 0) {
      return characterAvatarSrc(selected);
    }

    if (photo.startsWith("/uploads/")) {
      return photo;
    }

    if (isBrowserAccessiblePhoto(photo)) {
      return photo;
    }

    return photo;
  }

  async function loadDiscordRuntimeState() {
    const [configResponse, runtimeResponse] = await Promise.all([
      fetch("/api/discord/config"),
      fetch("/api/discord/runtime")
    ]);

    const configJson = (await configResponse.json()) as { config?: DiscordRuntimeConfig; error?: string };
    const runtimeJson = (await runtimeResponse.json()) as { status?: DiscordRuntimeStatus; error?: string };

    if (configResponse.ok && configJson.config) {
      setDiscordRuntimeConfig(configJson.config);
    }

    if (runtimeResponse.ok && runtimeJson.status) {
      setDiscordRuntimeStatus(runtimeJson.status);
    }
  }

  async function createCharacterRecord() {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...serializedDraft(),
        questionnaire: serializedQuestionnaire()
      })
    });

    const json = (await response.json()) as { character?: CharacterRecord; error?: string };
    if (!response.ok || !json.character) {
      throw new Error(json.error ?? "创建角色失败");
    }

    mergeCharacterRecord(json.character);
    return json.character;
  }

  async function updateCharacterRecord(characterId: string) {
    const response = await fetch("/api/characters", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: characterId,
        ...serializedDraft(),
        questionnaire: serializedQuestionnaire()
      })
    });

    const json = (await response.json()) as { character?: CharacterRecord; error?: string };
    if (!response.ok || !json.character) {
      throw new Error(json.error ?? "保存角色失败");
    }

    mergeCharacterRecord(json.character);
    return json.character;
  }

  async function composeBlueprint(character: CharacterRecord) {
    const response = await fetch("/api/compose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: character.id,
        character: draftFromCharacter(character),
        questionnaire: composeQuestionnairePayload()
      })
    });

    const json = (await response.json()) as { blueprintPackage?: BlueprintPackage; error?: string };
    if (!response.ok || !json.blueprintPackage) {
      throw new Error(json.error ?? "生成失败");
    }

    attachBlueprintPackage(character.id, json.blueprintPackage);
    return json.blueprintPackage;
  }

  function startNewCharacter() {
    setSelectedId("");
    setEditorStep("profile");
    setDraft(buildInitialDraft(userProfile.language));
    setRelationshipQuestionnaire(initialRelationshipQuestionnaire);
    setDiscordLinkDraft(emptyDiscordLink());
    setTuquConfigDraft(defaultTuquConfig());
    setBlueprintFilesDraft(emptyBlueprintFiles());
    setDiscordBotTokenDraft("");
    setViewMode("edit");
    setStatus(t(uiLanguage, "status.newMode"));
  }

  function openWorkspacePicker() {
    setShowWorkspacePicker(true);
    startLoadingWorkspaces(async () => {
      try {
        const response = await fetch("/api/workspaces/list");
        const json = (await response.json()) as { workspaces?: WorkspaceSummary[]; error?: string };
        if (!response.ok || !json.workspaces) {
          throw new Error(json.error ?? "获取 workspace 列表失败");
        }
        const existingIds = new Set(characters.map((c) => c.id));
        const existingPaths = new Set(characters.map((c) => c.workspacePath).filter(Boolean));
        const importable = json.workspaces.filter(
          (ws) => !existingPaths.has(ws.workspacePath) && !(ws.characterId && existingIds.has(ws.characterId))
        );
        setAvailableWorkspaces(importable);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "获取 workspace 列表失败");
        setAvailableWorkspaces([]);
      }
    });
  }

  function handleImportWorkspace(workspacePath: string) {
    startImportingWorkspace(async () => {
      try {
        setStatus("正在导入 workspace...");
        const response = await fetch("/api/workspaces/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspacePath })
        });
        const json = (await response.json()) as { character?: CharacterRecord; error?: string };
        if (!response.ok || !json.character) {
          throw new Error(json.error ?? "导入 workspace 失败");
        }
        mergeCharacterRecord(json.character);
        setShowWorkspacePicker(false);
        setViewMode("edit");
        setEditorStep("profile");
        setStatus(t(uiLanguage, "status.workspaceImported", { name: json.character.name }));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "导入 workspace 失败");
      }
    });
  }

  function startEditingCharacter(characterId: string) {
    setSelectedId(characterId);
    setEditorStep("profile");
    setViewMode("edit");
    setStatus(t(uiLanguage, "status.enterEditor"));
  }

  function goBackToBrowse() {
    if (!selectedId && characters[0]?.id) {
      setSelectedId(characters[0].id);
    }
    setEditorStep("profile");
    setViewMode("browse");
  }

  function handleDeleteCharacter(characterId: string, characterName: string) {
    const confirmed = window.confirm(`确定删除角色「${characterName}」吗？这只会删除设计器里的角色记录，不会自动删除已有 workspace。`);
    if (!confirmed) {
      return;
    }

    startSaving(async () => {
      try {
        const response = await fetch("/api/characters", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ id: characterId })
        });
        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error ?? "删除角色失败");
        }

        const remaining = characters.filter((character) => character.id !== characterId);
        setCharacters(remaining);
        setSelectedId(remaining[0]?.id ?? "");
        setStatus(`角色「${characterName}」已删除。`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "删除角色失败");
      }
    });
  }

  function attachBlueprintPackage(characterId: string, blueprintPackage: BlueprintPackage) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, blueprintPackage } : character
      )
    );
  }

  async function syncWorkspace(character: CharacterRecord) {
    setWorkspaceStatus("正在同步 OpenClaw workspace...");
    const response = await fetch("/api/workspaces/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: character.id
      })
    });
    const json = (await response.json()) as {
      workspacePath?: string;
      openclawRegistration?: { agentId: string; accountId: string; guildId: string };
      openclawRegistrationError?: string;
      error?: string;
    };

    if (!response.ok || !json.workspacePath) {
      throw new Error(json.error ?? "同步 workspace 失败");
    }

    const syncedCharacter: CharacterRecord = {
      ...character,
      workspacePath: json.workspacePath,
      discordLink: character.discordLink
        ? {
            ...character.discordLink,
            accountId: json.openclawRegistration?.accountId ?? character.discordLink.accountId,
            guildId: json.openclawRegistration?.guildId ?? character.discordLink.guildId,
            workspacePath: json.workspacePath
          }
        : character.discordLink
    };

    mergeCharacterRecord(syncedCharacter);

    const openclawNote = json.openclawRegistration
      ? ` · OpenClaw 已注册 agent ${json.openclawRegistration.agentId}，平台将自动接管 bot 运行。`
      : json.openclawRegistrationError
        ? ` · OpenClaw 注册失败：${json.openclawRegistrationError}`
        : "";
    const workspaceMessage = `${character.workspacePath ? "更新完成" : "创建完成"}：${json.workspacePath}${openclawNote}`;
    setWorkspaceStatus(workspaceMessage);

    return { character: syncedCharacter, workspaceMessage };
  }

  async function saveBlueprintFiles() {
    if (!selected?.blueprintPackage) {
      throw new Error("请先生成角色信息，再编辑 markdown 文件。");
    }

    setBlueprintFilesStatus("正在保存 markdown 文件...");
    const response = await fetch("/api/blueprint/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: selected.id,
        files: blueprintFilesDraft
      })
    });
    const json = (await response.json()) as {
      character?: CharacterRecord;
      openclawRegistration?: { agentId: string };
      openclawRegistrationError?: string;
      error?: string;
    };

    if (!response.ok || !json.character) {
      throw new Error(json.error ?? "保存 markdown 文件失败");
    }

    mergeCharacterRecord(json.character);
    setBlueprintFilesDraft(json.character.blueprintPackage?.files ?? emptyBlueprintFiles());
    setBlueprintFilesStatus(
      json.character.workspacePath
        ? "Markdown 文件已保存，并同步写入当前 workspace。"
        : "Markdown 文件已保存。创建 workspace 时会使用你手动编辑后的内容。"
    );

    return json.character;
  }

  function handleSaveBlueprintFiles() {
    startSavingBlueprintFiles(async () => {
      try {
        await saveBlueprintFiles();
      } catch (error) {
        setBlueprintFilesStatus(error instanceof Error ? error.message : "保存 markdown 文件失败");
      }
    });
  }

  async function saveDiscordLinkConfig() {
    if (!selected) {
      throw new Error("请先创建并选中一个角色。");
    }

    setDiscordStatus("正在保存 Discord 绑定...");
    const response = await fetch("/api/discord/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: selected.id,
        accountId: selectedDiscordAccountId,
        botToken: discordBotTokenDraft,
        guildId: discordLinkDraft.guildId?.trim() || undefined,
        channelId: discordLinkDraft.channelId.trim(),
        userId: discordLinkDraft.userId.trim()
      })
    });
    const json = (await response.json()) as {
      character?: CharacterRecord;
      openclawRegistration?: { agentId: string };
      openclawRegistrationError?: string;
      error?: string;
    };

    if (!response.ok || !json.character) {
      throw new Error(json.error ?? "保存 Discord 绑定失败");
    }

    mergeCharacterRecord(json.character);
    setDiscordLinkDraft(json.character.discordLink ?? emptyDiscordLink());
    const openclawNote = json.openclawRegistration
      ? ` OpenClaw 已注册 agent ${json.openclawRegistration.agentId}。`
      : json.openclawRegistrationError
        ? ` OpenClaw 注册失败：${json.openclawRegistrationError}`
        : "";
    setDiscordStatus(
      json.character.workspacePath
        ? `Discord 绑定和 Bot Token 已保存，并同步写入当前 workspace。${openclawNote}`.trim()
        : `Discord 绑定和 Bot Token 已保存。创建 workspace 后会自动写入该角色的 workspace。${openclawNote}`.trim()
    );

    return json.character;
  }

  async function repairOpenClawRegistration() {
    if (!selected) {
      throw new Error(t(uiLanguage, "discord.completeProfileFirst"));
    }

    setDiscordStatus(t(uiLanguage, "status.discordRepairing"));
    const response = await fetch("/api/openclaw/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: selected.id
      })
    });
    const json = (await response.json()) as {
      character?: CharacterRecord;
      agentId?: string;
      accountId?: string;
      guildId?: string;
      error?: string;
    };

    if (!response.ok || !json.character || !json.agentId || !json.accountId || !json.guildId) {
      throw new Error(json.error ?? "修复 OpenClaw 注册失败");
    }

    mergeCharacterRecord(json.character);
    setDiscordLinkDraft(json.character.discordLink ?? emptyDiscordLink());
    setDiscordStatus(
      t(uiLanguage, "status.discordRepairDone", {
        agentId: json.agentId,
        accountId: json.accountId,
        guildId: json.guildId
      })
    );

    return json.character;
  }

  async function saveTuquConfig() {
    if (!selected) {
      throw new Error("请先创建并选中一个角色。");
    }

    setTuquStatus("正在保存 TuQu AI 配置...");
    const response = await fetch("/api/tuqu/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        characterId: selected.id,
        registrationUrl: tuquConfigDraft.registrationUrl,
        serviceKey: tuquConfigDraft.serviceKey,
        tuquCharacterId: tuquConfigDraft.characterId
      })
    });
    const json = (await response.json()) as { character?: CharacterRecord; error?: string };

    if (!response.ok || !json.character) {
      throw new Error(json.error ?? "保存 TuQu AI 配置失败");
    }

    mergeCharacterRecord(json.character);
    setTuquConfigDraft(json.character.tuquConfig ?? defaultTuquConfig());
    setTuquStatus(
      json.character.workspacePath
        ? "TuQu AI 配置已保存，并同步写入当前 workspace。"
        : "TuQu AI 配置已保存。创建 workspace 时会自动写入当前角色。"
    );

    return json.character;
  }

  function finishEditor(message: string) {
    setEditorStep("profile");
    setViewMode("browse");
    setStatus(message);
  }

  function markProfileStepClean() {
    draftBaselineSnapshotRef.current = snapshotDraft(serializedDraft());
    userProfileBaselineSnapshotRef.current = snapshotUserProfile({
      ...userProfile,
      userMbti: inferredUserMbti
    });
    relationshipBaselineSnapshotRef.current = snapshotRelationshipQuestionnaire(serializedQuestionnaire());
  }

  function handleStepCardClick(step: EditorStep) {
    if (!canJumpToAnyStep) {
      return;
    }

    setEditorStep(step);
    setStatus(
      t(uiLanguage, "status.stepChanged", {
        step: editorSteps.find((item) => item.key === step)?.title ?? t(uiLanguage, "status.stepTarget")
      })
    );
  }

  function handleProfileNext() {
    startAdvancingProfile(async () => {
      try {
        if (selected?.workspacePath && selected.blueprintPackage && !isProfileStepDirty) {
          setEditorStep("details");
          setStatus(t(uiLanguage, "status.profileNoChanges"));
          return;
        }

        setWorkspaceStatus("");
        setStatus("正在保存角色、生成角色详情并同步 workspace...");

        const savedCharacter = selected ? await updateCharacterRecord(selected.id) : await createCharacterRecord();
        const blueprintPackage = await composeBlueprint(savedCharacter);
        const characterWithBlueprint = {
          ...savedCharacter,
          blueprintPackage
        };

        mergeCharacterRecord(characterWithBlueprint);
        setBlueprintFilesDraft(blueprintPackage.files);

        const { workspaceMessage } = await syncWorkspace(characterWithBlueprint);
        markProfileStepClean();
        setEditorStep("details");
        setStatus(`基础信息、关系问卷和 workspace 已同步。${workspaceMessage}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "角色生成失败";
        setWorkspaceStatus(message);
        setStatus(message);
      }
    });
  }

  function handleDetailsPrevious() {
    setEditorStep("profile");
  }

  function handleDetailsNext() {
    startSavingBlueprintFiles(async () => {
      try {
        await saveBlueprintFiles();
        setEditorStep("discord");
        setStatus("角色详情已保存，继续设置 Discord。");
      } catch (error) {
        setBlueprintFilesStatus(error instanceof Error ? error.message : "保存 markdown 文件失败");
      }
    });
  }

  function handleDiscordPrevious() {
    setEditorStep("details");
  }

  function handleDiscordNext() {
    startSavingDiscord(async () => {
      try {
        await saveDiscordLinkConfig();
        setEditorStep("tuqu");
        setStatus("Discord 配置已保存，继续设置 TuQu。");
      } catch (error) {
        setDiscordStatus(error instanceof Error ? error.message : "保存 Discord 绑定失败");
      }
    });
  }

  function handleDiscordSkip() {
    setDiscordStatus("已跳过 Discord 设置。");
    setEditorStep("tuqu");
    setStatus("已跳过 Discord 设置，继续配置 TuQu。");
  }

  function handleRepairOpenClawRegistration() {
    startRepairingOpenClawRegistration(async () => {
      try {
        await repairOpenClawRegistration();
      } catch (error) {
        setDiscordStatus(error instanceof Error ? error.message : "修复 OpenClaw 注册失败");
      }
    });
  }

  function handleTuquPrevious() {
    setEditorStep("discord");
  }

  function handleTuquFinish() {
    startSavingTuqu(async () => {
      try {
        await saveTuquConfig();
        finishEditor("角色设置已完成，已返回主页。");
      } catch (error) {
        setTuquStatus(error instanceof Error ? error.message : "保存 TuQu AI 配置失败");
      }
    });
  }

  function handleTuquSkip() {
    setTuquStatus("已跳过 TuQu 设置。");
    finishEditor("角色设置已完成，已返回主页。");
  }

  function handleCreateTuquCharacter() {
    if (!selected) {
      setTuquStatus("请先创建并选中一个角色。");
      return;
    }

    startCreatingTuquCharacter(async () => {
      try {
        setTuquStatus("正在用当前角色头像创建 TuQu AI Character...");
        const response = await fetch("/api/tuqu/character", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            characterId: selected.id
          })
        });
        const json = (await response.json()) as {
          character?: CharacterRecord;
          tuquCharacterId?: string;
          error?: string;
        };
        if (!response.ok || !json.character || !json.tuquCharacterId) {
          throw new Error(json.error ?? "创建 TuQu AI Character 失败");
        }

        mergeCharacterRecord(json.character);
        setTuquConfigDraft(json.character.tuquConfig ?? defaultTuquConfig());
        setTuquStatus(`TuQu AI Character 已创建：${json.tuquCharacterId}`);
      } catch (error) {
        setTuquStatus(error instanceof Error ? error.message : "创建 TuQu AI Character 失败");
      }
    });
  }

  function handleStartDiscordRuntime() {
    startStartingDiscordRuntime(async () => {
      try {
        setDiscordRuntimeMessage("正在启动所有已保存的 Discord bots...");
        const response = await fetch("/api/discord/runtime", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ force: true })
        });
        const json = (await response.json()) as { status?: DiscordRuntimeStatus; error?: string };
        if (!response.ok || !json.status) {
          throw new Error(json.error ?? "启动 Discord bot 失败");
        }

        setDiscordRuntimeStatus(json.status);
        setDiscordRuntimeMessage("所有已保存的 Discord bots 都已尝试启动。");
      } catch (error) {
        setDiscordRuntimeMessage(error instanceof Error ? error.message : "启动 Discord bot 失败");
      }
    });
  }

  function handleStopDiscordRuntime() {
    startStoppingDiscordRuntime(async () => {
      try {
        setDiscordRuntimeMessage("正在停止 Discord bot...");
        const response = await fetch("/api/discord/runtime", {
          method: "DELETE"
        });
        const json = (await response.json()) as { status?: DiscordRuntimeStatus; error?: string };
        if (!response.ok || !json.status) {
          throw new Error(json.error ?? "停止 Discord bot 失败");
        }

        setDiscordRuntimeStatus(json.status);
        setDiscordRuntimeMessage("所有 Discord bots 已停止。");
      } catch (error) {
        setDiscordRuntimeMessage(error instanceof Error ? error.message : "停止 Discord bot 失败");
      }
    });
  }

  function renderUserProfilePanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h3>{t(uiLanguage, "panel.user.title")}</h3>
              <p>{t(uiLanguage, "panel.user.description")}</p>
            </div>
          </div>

          <div className="subsection-header">
            <h4>{t(uiLanguage, "subsection.aboutMe")}</h4>
            <span className="status">{userProfileStatus}</span>
          </div>
          <div className="question-grid">
            <div className="field-full">
              <label>{t(uiLanguage, "field.userPersonality")}</label>
              <div className="option-grid">
                {(Object.keys(PERSONALITY_AXIS_OPTIONS) as Array<keyof typeof PERSONALITY_AXIS_OPTIONS>).map((key) => (
                  <div className="option-card" key={key}>
                    <span className="option-title">{axisLabel(key, false, uiLanguage)}</span>
                    <select
                      onChange={(event) => handleUserPersonalityChange(key, event.target.value)}
                      value={userProfile.userPersonality[key]}
                    >
                      {PERSONALITY_AXIS_OPTIONS[key].map((option) => (
                        <option key={option.value} value={option.value}>
                          {translateOption(uiLanguage, option.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <textarea
                onChange={(event) => handleUserPersonalityChange("otherNotes", event.target.value)}
                placeholder={t(uiLanguage, "placeholder.userNotes")}
                value={userProfile.userPersonality.otherNotes}
              />
              <div className="inline-note">
                {t(uiLanguage, "mbti.inferred")} <strong>{inferredUserMbti}</strong>
                {activeUserPreset ? ` · ${activeUserPreset.title}` : ""}
              </div>
            </div>

            <ChoiceField
              field={userProfile.lifeStage}
              label={t(uiLanguage, "field.lifeStage")}
              language={uiLanguage}
              onChange={(field, value) => handleUserSingleChoiceChange("lifeStage", field, value)}
              options={QUESTION_OPTIONS.lifeStage}
            />

            <ChoiceField
              field={userProfile.communicationPreference}
              label={t(uiLanguage, "field.communicationPreference")}
              language={uiLanguage}
              onChange={(field, value) => handleUserSingleChoiceChange("communicationPreference", field, value)}
              options={QUESTION_OPTIONS.communicationPreference}
            />
          </div>
          <div className="footer-note">{t(uiLanguage, "user.footer")}</div>
        </div>
      </section>
    );
  }

  function renderRelationshipPanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h3>{t(uiLanguage, "panel.relationship.title")}</h3>
              <p>{t(uiLanguage, "panel.relationship.description")}</p>
            </div>
          </div>

          <div className="subsection-header">
            <h4>{t(uiLanguage, "subsection.relationship")}</h4>
            <span className="status">{t(uiLanguage, "status.relationshipOnly")}</span>
          </div>
          <div className="question-grid">
            <div className="field-full">
              <label htmlFor="user-name-for-role">{t(uiLanguage, "field.userNameForRole")}</label>
              <input
                id="user-name-for-role"
                onChange={(event) =>
                  setRelationshipQuestionnaire((current) => ({
                    ...current,
                    userNameForRole: event.target.value
                  }))
                }
                placeholder={t(uiLanguage, "placeholder.userNameForRole")}
                value={relationshipQuestionnaire.userNameForRole}
              />
            </div>

            <ChoiceField
              field={relationshipQuestionnaire.desiredBond}
              label={t(uiLanguage, "field.desiredBond")}
              language={uiLanguage}
              onChange={(field, value) => handleRelationshipSingleChoiceChange("desiredBond", field, value)}
              options={QUESTION_OPTIONS.desiredBond}
            />

            <CheckboxField
              field={relationshipQuestionnaire.treatmentPreference}
              label={t(uiLanguage, "field.treatmentPreference")}
              language={uiLanguage}
              onCustomChange={(value) => handleMultiChoiceCustomChange("treatmentPreference", value)}
              onToggle={(value) => handleMultiChoiceToggle("treatmentPreference", value)}
              options={QUESTION_OPTIONS.treatmentPreference}
            />

            <CheckboxField
              field={relationshipQuestionnaire.specialTraits}
              label={t(uiLanguage, "field.specialTraits")}
              language={uiLanguage}
              onCustomChange={(value) => handleMultiChoiceCustomChange("specialTraits", value)}
              onToggle={(value) => handleMultiChoiceToggle("specialTraits", value)}
              options={QUESTION_OPTIONS.specialTraits}
            />

            <div className="field-full">
              <label htmlFor="favorability">
                {t(uiLanguage, "field.initialFavorability", {
                  value: relationshipQuestionnaire.affectionPlan.initialFavorability
                })}
              </label>
              <input
                id="favorability"
                max={100}
                min={0}
                onChange={(event) =>
                  setRelationshipQuestionnaire((current) => ({
                    ...current,
                    affectionPlan: {
                      ...current.affectionPlan,
                      initialFavorability: Number(event.target.value)
                    }
                  }))
                }
                type="range"
                value={relationshipQuestionnaire.affectionPlan.initialFavorability}
              />
              <div className="range-labels">
                <span>{t(uiLanguage, "range.stranger")}</span>
                <span>{t(uiLanguage, "range.familiar")}</span>
                <span>{t(uiLanguage, "range.high")}</span>
              </div>
            </div>

            <ChoiceField
              field={{
                selected: relationshipQuestionnaire.affectionPlan.growthRoute,
                custom: relationshipQuestionnaire.affectionPlan.growthRouteCustom
              }}
              label={t(uiLanguage, "field.affectionGrowthRoute")}
              language={uiLanguage}
              onChange={(field, value) =>
                setRelationshipQuestionnaire((current) => ({
                  ...current,
                  affectionPlan: {
                    ...current.affectionPlan,
                    [field === "selected" ? "growthRoute" : "growthRouteCustom"]: value
                  }
                }))
              }
              options={QUESTION_OPTIONS.affectionGrowthRoute}
            />
          </div>

          <div className="footer-note">{t(uiLanguage, "relationship.footer")}</div>
        </div>
      </section>
    );
  }

  function renderCharactersPanel() {
    return (
      <section className="panel">
        <div className="panel-inner">
          <div className="panel-title">
            <div>
              <h2>{t(uiLanguage, "list.title")}</h2>
              <p>{t(uiLanguage, "list.description")}</p>
            </div>
            <div className="panel-title-actions">
              <button className="button-primary" onClick={startNewCharacter} type="button">
                {t(uiLanguage, "button.newCharacter")}
              </button>
              <button className="button-secondary" onClick={openWorkspacePicker} type="button">
                {t(uiLanguage, "button.syncWorkspace")}
              </button>
            </div>
          </div>

          <div className="character-list">
            {characters.map((character) => (
              <div className="character-card-row" key={character.id}>
                <button
                  className="character-card"
                  data-active={character.id === selectedId}
                  onClick={() => setSelectedId(character.id)}
                  type="button"
                >
                  {character.photos[0] || character.workspacePath ? (
                    <img alt={character.name} className="thumb" src={characterAvatarSrc(character)} />
                  ) : (
                    <div className="thumb thumb-placeholder">{character.name.slice(0, 1)}</div>
                  )}
                  <div style={{ textAlign: "left" }}>
                    <strong>{character.name}</strong>
                    <div className="meta-line">
                      {character.age ? <span className="pill">{formatAgeLabel(uiLanguage, character.age)}</span> : null}
                      {character.mbti ? <span className="pill">{character.mbti}</span> : null}
                      {character.occupation ? <span className="pill warm">{character.occupation}</span> : null}
                      <span className="pill">{getLanguageLabel(uiLanguage, character.language)}</span>
                      {character.discordLink ? <span className="pill">{t(uiLanguage, "pill.discordBound")}</span> : null}
                      {character.workspacePath ? <span className="pill">{t(uiLanguage, "pill.workspaceReady")}</span> : null}
                    </div>
                    <p className="character-preview">{characterPreview(character, uiLanguage)}</p>
                  </div>
                </button>
                <div className="card-actions">
                  <button
                    className="button-ghost button-inline-action"
                    onClick={() => startEditingCharacter(character.id)}
                    type="button"
                  >
                    {t(uiLanguage, "button.edit")}
                  </button>
                  <button
                    className="button-danger button-inline-action"
                    disabled={isSaving}
                    onClick={() => handleDeleteCharacter(character.id, character.name)}
                    type="button"
                  >
                    {t(uiLanguage, "button.delete")}
                  </button>
                </div>
              </div>
            ))}

            {characters.length === 0 ? (
              <div className="empty-state">{t(uiLanguage, "empty.noCharacters")}</div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderEditorPanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h2>{t(uiLanguage, "panel.characterInfo.title")}</h2>
              <p>
                {isEditingExisting
                  ? t(uiLanguage, "panel.characterInfo.editing")
                  : t(uiLanguage, "panel.characterInfo.creating")}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">{t(uiLanguage, "field.name")}</label>
              <input id="name" onChange={(event) => handleDraftChange("name", event.target.value)} value={draft.name} />
            </div>

            <div className="field">
              <label htmlFor="age">{t(uiLanguage, "field.age")}</label>
              <input id="age" onChange={(event) => handleDraftChange("age", event.target.value)} value={draft.age} />
            </div>

            <div className="field">
              <label htmlFor="gender">{t(uiLanguage, "field.gender")}</label>
              <input id="gender" onChange={(event) => handleDraftChange("gender", event.target.value)} value={draft.gender} />
            </div>

            <div className="field">
              <label htmlFor="occupation">{t(uiLanguage, "field.occupation")}</label>
              <input
                id="occupation"
                onChange={(event) => handleDraftChange("occupation", event.target.value)}
                value={draft.occupation}
              />
            </div>

            <div className="field">
              <label htmlFor="heritage">{t(uiLanguage, "field.heritage")}</label>
              <input
                id="heritage"
                onChange={(event) => handleDraftChange("heritage", event.target.value)}
                value={draft.heritage}
              />
            </div>

            <div className="field">
              <label htmlFor="worldSetting">{t(uiLanguage, "field.worldSetting")}</label>
              <input
                id="worldSetting"
                onChange={(event) => handleDraftChange("worldSetting", event.target.value)}
                placeholder={t(uiLanguage, "placeholder.worldSetting")}
                value={draft.worldSetting}
              />
            </div>

            <div className="field">
              <label htmlFor="character-language">{t(uiLanguage, "language.character")}</label>
              <select
                id="character-language"
                onChange={(event) => handleDraftChange("language", event.target.value as AppLanguage)}
                value={draft.language}
              >
                {APP_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {getLanguageLabel(uiLanguage, language)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-full">
              <label htmlFor="concept">{t(uiLanguage, "field.concept")}</label>
              <textarea
                id="concept"
                onChange={(event) => handleDraftChange("concept", event.target.value)}
                placeholder={t(uiLanguage, "placeholder.concept")}
                value={draft.concept}
              />
            </div>

            <div className="field-full">
              <label>{t(uiLanguage, "field.personality")}</label>
              <div className="option-grid">
                {(Object.keys(PERSONALITY_AXIS_OPTIONS) as Array<keyof typeof PERSONALITY_AXIS_OPTIONS>).map((key) => (
                  <div className="option-card" key={key}>
                    <span className="option-title">{axisLabel(key, true, uiLanguage)}</span>
                    <select
                      onChange={(event) => handleCharacterPersonalityChange(key, event.target.value)}
                      value={draft.personality[key]}
                    >
                      {PERSONALITY_AXIS_OPTIONS[key].map((option) => (
                        <option key={option.value} value={option.value}>
                          {translateOption(uiLanguage, option.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <textarea
                onChange={(event) => handleCharacterPersonalityChange("otherNotes", event.target.value)}
                placeholder={t(uiLanguage, "placeholder.characterNotes")}
                value={draft.personality.otherNotes}
              />
            </div>

            <div className="field-full">
              <label htmlFor="photos">{t(uiLanguage, "field.photos")}</label>
              <input
                id="photos"
                multiple
                onChange={(event) => {
                  void uploadFiles(event.target.files).catch((error: unknown) => {
                    setStatus(error instanceof Error ? error.message : "上传失败");
                  });
                }}
                type="file"
                accept="image/*"
              />
              {draft.photos.length || selected?.workspacePath ? (
                <div className="photo-strip">
                  {(draft.photos.length ? draft.photos : [characterAvatarSrc(selected!)]).map((photo, idx) => (
                    <img
                      alt="uploaded"
                      data-fallback={selected ? characterAvatarSrc(selected) : ""}
                      key={`${photo}-${idx}`}
                      onError={(event) => {
                        const fallback = event.currentTarget.dataset.fallback;
                        if (fallback && event.currentTarget.src !== fallback) {
                          event.currentTarget.src = fallback;
                        }
                      }}
                      src={draftPhotoPreviewSrc(photo, idx)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hint-box">
            <strong>{inferredCharacterMbti}</strong>
            <p style={{ marginBottom: 8 }}>
              {activePreset
                ? `${activePreset.title}${uiLanguage === "en" ? ": " : "："}${activePreset.defaults.join(
                    uiLanguage === "en" ? ", " : "、"
                  )}。`
                : t(uiLanguage, "detail.mbtiInsufficient")}
            </p>
            {activePreset ? (
              <span className="footer-note">
                {t(uiLanguage, "detail.rhythm")}
                {activePreset.rhythm}
              </span>
            ) : null}
          </div>

          <div className="footer-note">{t(uiLanguage, "profile.footer")}</div>
        </div>
      </section>
    );
  }

  function renderProfileStep() {
    return (
      <>
        <section className="profile-step-grid">
          {renderEditorPanel()}
          <div className="profile-step-side">
            {renderUserProfilePanel()}
            {renderRelationshipPanel()}
          </div>
        </section>
        <section className="panel">
          <div className="panel-inner wizard-footer">
            <div>
              <h3>{t(uiLanguage, "wizard.nextTitle")}</h3>
              <p>{t(uiLanguage, "wizard.nextDescription")}</p>
            </div>
            <div className="actions">
              <button className="button-primary" disabled={isAdvancingProfile} onClick={handleProfileNext} type="button">
                {isAdvancingProfile ? t(uiLanguage, "button.processing") : t(uiLanguage, "button.nextGenerate")}
              </button>
            </div>
            <div className="workspace-feedback">
              {workspaceStatus || t(uiLanguage, "status.profileRequired")}
              <br />
              {status}
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderDiscordPanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h3>{t(uiLanguage, "step.discord.title")}</h3>
              <p>{t(uiLanguage, "discord.description")}</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="discord-guild-id">Server ID</label>
              <input
                id="discord-guild-id"
                onChange={(event) => handleDiscordDraftChange("guildId", event.target.value)}
                placeholder={t(uiLanguage, "discord.placeholderServerId")}
                value={discordLinkDraft.guildId ?? ""}
              />
            </div>

            <div className="field">
              <label htmlFor="discord-channel-id">Channel ID</label>
              <input
                id="discord-channel-id"
                onChange={(event) => handleDiscordDraftChange("channelId", event.target.value)}
                placeholder={t(uiLanguage, "discord.placeholderChannelId")}
                value={discordLinkDraft.channelId}
              />
            </div>

            <div className="field">
              <label htmlFor="discord-user-id">User ID</label>
              <input
                id="discord-user-id"
                onChange={(event) => handleDiscordDraftChange("userId", event.target.value)}
                placeholder={t(uiLanguage, "discord.placeholderUserId")}
                value={discordLinkDraft.userId}
              />
            </div>

            <div className="field-full">
              <label htmlFor="discord-bot-token">Discord Login Token</label>
              <input
                id="discord-bot-token"
                onChange={(event) => handleDiscordRuntimeConfigChange(event.target.value)}
                placeholder={t(uiLanguage, "discord.placeholderBotToken")}
                type="password"
                value={discordBotTokenDraft}
              />
            </div>
          </div>

          <div className="actions">
            <button className="button-ghost" onClick={handleDiscordPrevious} type="button">
              {t(uiLanguage, "button.previous")}
            </button>
            <button className="button-secondary" onClick={handleDiscordSkip} type="button">
              {t(uiLanguage, "button.skip")}
            </button>
            <button
              className="button-ghost"
              disabled={isRepairingOpenClawRegistration || !selected?.workspacePath || !selected?.discordLink?.channelId || !selected?.discordLink.userId}
              onClick={handleRepairOpenClawRegistration}
              type="button"
            >
              {isRepairingOpenClawRegistration ? t(uiLanguage, "button.processing") : t(uiLanguage, "button.repairRegistration")}
            </button>
            <button className="button-primary" disabled={isSavingDiscord} onClick={handleDiscordNext} type="button">
              {isSavingDiscord ? t(uiLanguage, "button.saving") : t(uiLanguage, "button.next")}
            </button>
          </div>

          <div className="workspace-feedback">
            {selected?.workspacePath ? `${t(uiLanguage, "detail.currentWorkspace")}${selected.workspacePath}` : t(uiLanguage, "discord.noWorkspace")}
            <br />
            {selected
              ? `${t(uiLanguage, "discord.accountId")}${selectedDiscordAccountId}${discordLinkDraft.botId ? ` · ${t(uiLanguage, "discord.botUserId")}${discordLinkDraft.botId}` : ""}`
              : t(uiLanguage, "discord.completeProfileFirst")}
            <br />
            {selected?.workspacePath && selected?.discordLink?.channelId && selected?.discordLink.userId ? t(uiLanguage, "discord.repairHint") : ""}
            {selected?.workspacePath && selected?.discordLink?.channelId && selected?.discordLink.userId ? <br /> : null}
            {discordStatus || t(uiLanguage, "discord.footer")}
          </div>
        </div>
      </section>
    );
  }

  function renderTuquPanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h3>{t(uiLanguage, "step.tuqu.title")}</h3>
              <p>{t(uiLanguage, "tuqu.description")}</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-full">
              <label>{t(uiLanguage, "tuqu.registration")}</label>
              <a
                className="tuqu-registration-link"
                href={tuquConfigDraft.registrationUrl || "https://billing.tuqu.ai/dream-weaver/login"}
                rel="noopener noreferrer"
                target="_blank"
              >
                {tuquConfigDraft.registrationUrl || "https://billing.tuqu.ai/dream-weaver/login"}
              </a>
            </div>

            <div className="field-full">
              <label htmlFor="tuqu-service-key">Service Key</label>
              <input
                id="tuqu-service-key"
                onChange={(event) => handleTuquConfigChange("serviceKey", event.target.value)}
                placeholder={t(uiLanguage, "tuqu.placeholderServiceKey")}
                value={tuquConfigDraft.serviceKey}
              />
            </div>

            <div className="field-full">
              <label>{t(uiLanguage, "tuqu.characterId")}</label>
              <div className="tuqu-character-status-row">
                {tuquConfigDraft.characterId ? (
                  <span className="pill" style={{ fontSize: "0.92rem" }}>
                    {t(uiLanguage, "tuqu.registered")}{tuquConfigDraft.characterId}
                  </span>
                ) : (
                  <span className="pill warm" style={{ fontSize: "0.92rem" }}>
                    {t(uiLanguage, "tuqu.notRegistered")}
                  </span>
                )}
                <div className="tuqu-info-anchor">
                  <button
                    className="button-ghost tuqu-info-button"
                    onClick={() => setShowTuquCharacterInfo((prev) => !prev)}
                    type="button"
                  >
                    ?
                  </button>
                  {showTuquCharacterInfo && (
                    <div className="tuqu-info-popover">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.92rem" }}>{t(uiLanguage, "tuqu.whatIsCharacter")}</strong>
                        <button
                          className="button-ghost"
                          onClick={() => setShowTuquCharacterInfo(false)}
                          style={{ padding: "4px 10px", fontSize: "0.82rem", borderRadius: "8px" }}
                          type="button"
                        >
                          {t(uiLanguage, "button.close")}
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 0", lineHeight: 1.6, fontSize: "0.9rem", color: "var(--muted)" }}>
                        {t(uiLanguage, "tuqu.characterInfo")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="button-ghost" onClick={handleTuquPrevious} type="button">
              {t(uiLanguage, "button.previous")}
            </button>
            <button className="button-secondary" onClick={handleTuquSkip} type="button">
              {t(uiLanguage, "button.skip")}
            </button>
            <button className="button-ghost" disabled={isCreatingTuquCharacter} onClick={handleCreateTuquCharacter} type="button">
              {isCreatingTuquCharacter ? t(uiLanguage, "button.creating") : t(uiLanguage, "button.createTuquCharacter")}
            </button>
            <button className="button-primary" disabled={isSavingTuqu} onClick={handleTuquFinish} type="button">
              {isSavingTuqu ? t(uiLanguage, "button.saving") : t(uiLanguage, "button.finish")}
            </button>
          </div>

          <div className="workspace-feedback">
            {selected?.workspacePath ? `${t(uiLanguage, "detail.currentWorkspace")}${selected.workspacePath}` : t(uiLanguage, "tuqu.noWorkspace")}
            <br />
            {tuquStatus || t(uiLanguage, "tuqu.footer")}
          </div>
        </div>
      </section>
    );
  }

  function renderDetailPanel(mode: "browse" | "wizard" = "browse") {
    const isWizardMode = mode === "wizard";
    const activeRelationshipQuestionnaire = isWizardMode
      ? relationshipQuestionnaire
      : selected?.questionnaire ?? initialRelationshipQuestionnaire;

    return (
      <section className="panel">
        <div className="panel-inner">
          <div className="panel-title">
            <div>
              <h3>{t(uiLanguage, "detail.title")}</h3>
              <p>{isWizardMode ? t(uiLanguage, "detail.descriptionWizard") : t(uiLanguage, "detail.descriptionBrowse")}</p>
            </div>
          </div>

          {selected ? (
            <div className="detail-block">
              <div>
                <strong style={{ fontSize: "1.4rem" }}>{selected.name}</strong>
                <div className="meta-line">
                  {selected.age ? <span className="pill">{formatAgeLabel(uiLanguage, selected.age)}</span> : null}
                  {selected.gender ? <span className="pill">{selected.gender}</span> : null}
                  {selected.mbti ? <span className="pill warm">{selected.mbti}</span> : null}
                  <span className="pill">{getLanguageLabel(uiLanguage, selected.language)}</span>
                </div>
              </div>

              <div>
                <h4>{t(uiLanguage, "detail.basicInfo")}</h4>
                <p>
                  {selected.occupation || t(uiLanguage, "detail.emptyOccupation")}
                  {selected.heritage ? ` / ${selected.heritage}` : ""}
                </p>
                <p>{t(uiLanguage, "detail.worldSetting")}{selected.worldSetting || t(uiLanguage, "detail.emptyWorldSetting")}</p>
                <p>{selected.concept || t(uiLanguage, "detail.emptyConcept")}</p>
              </div>

              <div>
                <h4>{t(uiLanguage, "detail.personality")}</h4>
                <p>
                  {selected.mbti} · {translateOption(uiLanguage, selected.personality.socialEnergy)} /{" "}
                  {translateOption(uiLanguage, selected.personality.informationFocus)} /{" "}
                  {translateOption(uiLanguage, selected.personality.decisionStyle)} /{" "}
                  {translateOption(uiLanguage, selected.personality.lifestylePace)}
                </p>
                {selected.personality.otherNotes ? <p>{selected.personality.otherNotes}</p> : null}
              </div>

              {selected.blueprintPackage ? (
                <>
                  <div>
                    <h4>{t(uiLanguage, "detail.summary")}</h4>
                    <p>{selected.blueprintPackage.summary.oneLiner}</p>
                    <p>{t(uiLanguage, "detail.archetype")}{selected.blueprintPackage.summary.archetype}</p>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.coreTraits")}</h4>
                    <ul>
                      {coreTraits.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.speakingStyle")}</h4>
                    <ul>
                      {speakingStyle.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.relationshipStory")}</h4>
                    <p>{selected.blueprintPackage.relationship.backstory}</p>
                    <p>{t(uiLanguage, "detail.relationshipDynamic")}{selected.blueprintPackage.relationship.dynamic}</p>
                    <p>{t(uiLanguage, "detail.affectionBaseline")}{selected.blueprintPackage.relationship.affectionBaseline}</p>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.affectionRoute")}</h4>
                    <ul>
                      {affectionGrowthPath.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.addressing")}</h4>
                    <p>{activeRelationshipQuestionnaire.userNameForRole || selected.blueprintPackage.relationship.userAddressingStyle || t(uiLanguage, "detail.emptyAddressing")}</p>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.chemistry")}</h4>
                    <ul>
                      {chemistry.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.boundaries")}</h4>
                    <ul>
                      {hardBoundaries.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.followups")}</h4>
                    <ul>
                      {optionalDeepeningQuestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.editIdentity")}</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("identityMd", event.target.value)}
                      value={blueprintFilesDraft.identityMd}
                    />
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.editSoul")}</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("soulMd", event.target.value)}
                      value={blueprintFilesDraft.soulMd}
                    />
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.editUser")}</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("userMd", event.target.value)}
                      value={blueprintFilesDraft.userMd}
                    />
                  </div>

                  <div>
                    <h4>{t(uiLanguage, "detail.editMemory")}</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("memoryMd", event.target.value)}
                      value={blueprintFilesDraft.memoryMd}
                    />
                  </div>

                  <div className="actions">
                    {isWizardMode ? (
                      <>
                        <button className="button-ghost" onClick={handleDetailsPrevious} type="button">
                          {t(uiLanguage, "button.previous")}
                        </button>
                        <button
                          className="button-primary"
                          disabled={isSavingBlueprintFiles}
                          onClick={handleDetailsNext}
                          type="button"
                        >
                          {isSavingBlueprintFiles ? t(uiLanguage, "button.saving") : t(uiLanguage, "button.next")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="button-secondary"
                        disabled={isSavingBlueprintFiles}
                        onClick={handleSaveBlueprintFiles}
                        type="button"
                      >
                        {isSavingBlueprintFiles ? t(uiLanguage, "button.saving") : t(uiLanguage, "button.saveMarkdown")}
                      </button>
                    )}
                  </div>
                  <div className="workspace-feedback">
                    {blueprintFilesStatus || t(uiLanguage, "detail.markdownHint")}
                    <br />
                    {selected.workspacePath ? `${t(uiLanguage, "detail.currentWorkspace")}${selected.workspacePath}` : workspaceStatus || t(uiLanguage, "detail.workspaceAfterProfile")}
                  </div>
                </>
              ) : (
                <div className="empty-state">{t(uiLanguage, "empty.noBlueprint")}</div>
              )}
            </div>
          ) : (
            <div className="empty-state">{t(uiLanguage, "empty.noSelectedCharacter")}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-toolbar">
              <div className="hero-language-picker">
                <label htmlFor="ui-language">{t(uiLanguage, "language.ui")}</label>
                <select
                  id="ui-language"
                  onChange={(event) =>
                    setUserProfile((current) => ({
                      ...current,
                      language: event.target.value as AppLanguage
                    }))
                  }
                  value={userProfile.language}
                >
                  {APP_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {getLanguageLabel(uiLanguage, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <h1>{t(uiLanguage, "hero.title")}</h1>
            <p>{t(uiLanguage, "hero.description")}</p>
            <div className="hero-social-row">
              <a
                aria-label={t(uiLanguage, "hero.githubAria")}
                className="github-cta"
                href={githubUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="github-cta-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 1.5a10.5 10.5 0 00-3.32 20.46c.53.1.72-.23.72-.51 0-.25-.01-1.08-.02-1.96-2.95.64-3.57-1.25-3.57-1.25-.48-1.22-1.17-1.54-1.17-1.54-.96-.65.07-.64.07-.64 1.06.08 1.62 1.09 1.62 1.09.94 1.61 2.46 1.15 3.06.88.1-.68.37-1.15.67-1.41-2.36-.27-4.84-1.18-4.84-5.26 0-1.16.41-2.11 1.09-2.86-.11-.27-.47-1.36.1-2.84 0 0 .89-.29 2.9 1.09a10.1 10.1 0 015.28 0c2.01-1.38 2.9-1.09 2.9-1.09.57 1.48.21 2.57.1 2.84.68.75 1.09 1.7 1.09 2.86 0 4.09-2.49 4.99-4.86 5.25.38.33.72.98.72 1.97 0 1.42-.01 2.56-.01 2.91 0 .28.19.61.73.51A10.5 10.5 0 0012 1.5z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span className="github-cta-copy">
                  <strong>{t(uiLanguage, "hero.githubCta")}</strong>
                  <span>{t(uiLanguage, "hero.githubHint")}</span>
                </span>
              </a>
              <div className="hero-update-card">
                <span className="hero-update-label">{t(uiLanguage, "hero.updatedLabel")}</span>
                <strong>{formatRepoUpdatedAt(uiLanguage, repoUpdatedAt)}</strong>
              </div>
            </div>
            <div className="hero-video-block">
              <span className="hero-video-heading">{t(uiLanguage, "hero.videoLabel")}</span>
              <div className="hero-video-row">
                <a
                  aria-label={`Bilibili · ${t(uiLanguage, "hero.videoBilibili")}`}
                  className="tutorial-card"
                  data-platform="bilibili"
                  href={TUTORIAL_VIDEO_LINKS.bilibili}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="tutorial-card-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 4.5v9L13 9 5 4.5z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="tutorial-card-copy">
                    <span className="tutorial-card-platform">Bilibili</span>
                    <strong>{t(uiLanguage, "hero.videoBilibili")}</strong>
                    <span>{t(uiLanguage, "hero.videoHint")}</span>
                  </span>
                </a>
              </div>
            </div>
            <div className="badge-row">
              <span className="badge">{t(uiLanguage, "badge.world")}</span>
              <span className="badge">{t(uiLanguage, "badge.mbti")}</span>
              <span className="badge">{t(uiLanguage, "badge.relationship")}</span>
              <span className="badge">{t(uiLanguage, "badge.affection")}</span>
              <a
                className="badge discord-badge"
                href="https://discord.gg/Y5EExWtP"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg width="20" height="16" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.9 58.9 0 0017.7 9 .2.2 0 00.3-.1 42.1 42.1 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0070.7 45.7v-.2c1.4-15.2-2.4-28.4-10-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1zm23.3 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1z" fill="currentColor"/>
                </svg>
                {t(uiLanguage, "badge.discord")}
              </a>
            </div>
          </div>
          <div className="hint-box">
            <strong>{t(uiLanguage, "hero.why")}</strong>
            <p>{t(uiLanguage, "hero.whyBody")}</p>
          </div>
        </div>
      </section>

      {viewMode === "browse" ? (
        <section className="panel-grid">
          {renderCharactersPanel()}
          {renderDetailPanel()}
        </section>
      ) : (
        <section className="editor-page">
          <div className="editor-page-header">
            {characters.length ? (
              <button className="button-ghost" onClick={goBackToBrowse} type="button">
                {t(uiLanguage, "button.back")}
              </button>
            ) : null}
            <div>
              <strong>
                {selected
                  ? t(uiLanguage, "editor.current", { name: selected.name })
                  : t(uiLanguage, "editor.creating")}
              </strong>
              <div className="status">{currentEditorStepMeta.title} · {currentEditorStepMeta.description}</div>
            </div>
          </div>
          <section className="panel">
            <div className="panel-inner stack">
              <div className="panel-title">
                <div>
                  <h3>{t(uiLanguage, "stepper.title")}</h3>
                  <p>{t(uiLanguage, "stepper.description")}</p>
                </div>
              </div>
              <div className="stepper">
                {editorSteps.map((step, index) => (
                  <button
                    className="stepper-item"
                    data-active={step.key === editorStep}
                    data-clickable={canJumpToAnyStep}
                    data-complete={index < currentEditorStepIndex}
                    disabled={!canJumpToAnyStep}
                    key={step.key}
                    onClick={() => handleStepCardClick(step.key)}
                    type="button"
                  >
                    <span className="stepper-index">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <span>{step.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
          {editorStep === "profile" ? renderProfileStep() : null}
          {editorStep === "details" ? renderDetailPanel("wizard") : null}
          {editorStep === "discord" ? renderDiscordPanel() : null}
          {editorStep === "tuqu" ? renderTuquPanel() : null}
        </section>
      )}

      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h2>{t(uiLanguage, "runtime.title")}</h2>
              <p>{t(uiLanguage, "runtime.description")}</p>
            </div>
          </div>

          <div className="workspace-feedback">
            {savedDiscordAccounts.length
              ? savedDiscordAccounts.map((account) => `${account.characterName ?? account.accountId}: ${t(uiLanguage, "runtime.registered")}`).join(" | ")
              : t(uiLanguage, "runtime.noneSaved")}
          </div>

          <details>
            <summary>{t(uiLanguage, "runtime.localDebug")}</summary>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              {discordRuntimeStatus.running ? (
                <button className="button-ghost" disabled={isStoppingDiscordRuntime} onClick={handleStopDiscordRuntime} type="button">
                  {isStoppingDiscordRuntime ? t(uiLanguage, "runtime.stopping") : t(uiLanguage, "runtime.stop")}
                </button>
              ) : (
                <button className="button-ghost" disabled={isStartingDiscordRuntime} onClick={handleStartDiscordRuntime} type="button">
                  {isStartingDiscordRuntime ? t(uiLanguage, "runtime.starting") : t(uiLanguage, "runtime.start")}
                </button>
              )}
            </div>
            <div className="workspace-feedback">
              {discordRuntimeStatus.running ? t(uiLanguage, "runtime.running") : t(uiLanguage, "runtime.notRunning")}
              <br />
              {discordRuntimeStatus.accounts.length
                ? discordRuntimeStatus.accounts
                    .map((account) =>
                      account.running
                        ? `${account.characterName ?? account.accountId}: ${account.botTag ?? account.botUserId ?? t(uiLanguage, "runtime.loggedIn")}`
                        : `${account.characterName ?? account.accountId}: ${t(uiLanguage, "runtime.stopped")}`
                    )
                    .join(" | ")
                : ""}
              {discordRuntimeMessage || discordRuntimeStatus.error || ""}
            </div>
          </details>
        </div>
      </section>

      {showWorkspacePicker && (
        <div className="workspace-picker-overlay" onClick={() => setShowWorkspacePicker(false)}>
          <div className="workspace-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-picker-header">
              <h3>{t(uiLanguage, "workspacePicker.title")}</h3>
              <button
                className="button-ghost"
                onClick={() => setShowWorkspacePicker(false)}
                type="button"
              >
                {t(uiLanguage, "button.close")}
              </button>
            </div>
            <p className="workspace-picker-desc">
              {t(uiLanguage, "workspacePicker.description")}
            </p>
            {isLoadingWorkspaces ? (
              <div className="workspace-picker-loading">{t(uiLanguage, "workspacePicker.loading")}</div>
            ) : availableWorkspaces.length === 0 ? (
              <div className="workspace-picker-empty">
                {t(uiLanguage, "workspacePicker.empty")}
              </div>
            ) : (
              <div className="workspace-picker-list">
                {availableWorkspaces.map((ws) => (
                  <div className="workspace-picker-item" key={ws.workspacePath}>
                    <div className="workspace-picker-item-info">
                      <strong>{ws.characterName || ws.dirName}</strong>
                      <span className="workspace-picker-item-path">{ws.dirName}</span>
                      <div className="meta-line">
                        {ws.hasIdentityMd && <span className="pill">IDENTITY.md</span>}
                        {ws.hasSoulMd && <span className="pill">SOUL.md</span>}
                        {ws.hasUserMd && <span className="pill">USER.md</span>}
                        {ws.hasMemoryMd && <span className="pill">MEMORY.md</span>}
                        {ws.hasDiscordLink && <span className="pill warm">Discord</span>}
                        {ws.hasTuquConfig && <span className="pill warm">TuQu</span>}
                        {ws.hasCharacterRecord && <span className="pill">{t(uiLanguage, "workspacePicker.fullRecord")}</span>}
                      </div>
                    </div>
                    <button
                      className="button-primary"
                      disabled={isImportingWorkspace}
                      onClick={() => handleImportWorkspace(ws.workspacePath)}
                      type="button"
                    >
                      {isImportingWorkspace ? t(uiLanguage, "workspacePicker.importing") : t(uiLanguage, "workspacePicker.import")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ChoiceField({
  label,
  language,
  options,
  field,
  onChange
}: {
  label: string;
  language: AppLanguage;
  options: readonly string[];
  field: SingleChoiceInput;
  onChange: (field: keyof SingleChoiceInput, value: string) => void;
}) {
  return (
    <div className="field-full">
      <label>{label}</label>
      <select onChange={(event) => onChange("selected", event.target.value)} value={field.selected}>
        {options.map((option) => (
          <option key={option} value={option}>
            {translateOption(language, option)}
          </option>
        ))}
      </select>
      <input
        onChange={(event) => onChange("custom", event.target.value)}
        placeholder={t(language, "placeholder.other")}
        value={field.custom}
      />
    </div>
  );
}

function CheckboxField({
  label,
  language,
  options,
  field,
  onToggle,
  onCustomChange
}: {
  label: string;
  language: AppLanguage;
  options: readonly string[];
  field: MultiChoiceInput;
  onToggle: (value: string) => void;
  onCustomChange: (value: string) => void;
}) {
  return (
    <div className="field-full">
      <label>{label}</label>
      <div className="checkbox-grid">
        {options.map((option) => (
          <label className="checkbox-item" key={option}>
            <input
              checked={field.selected.includes(option)}
              onChange={() => onToggle(option)}
              type="checkbox"
            />
            <span>{translateOption(language, option)}</span>
          </label>
        ))}
      </div>
      <input
        onChange={(event) => onCustomChange(event.target.value)}
        placeholder={t(language, "placeholder.otherTraits")}
        value={field.custom}
      />
    </div>
  );
}

function axisLabel(
  key: keyof typeof PERSONALITY_AXIS_OPTIONS,
  isCharacter: boolean,
  language: AppLanguage
) {
  return t(language, `axis.${isCharacter ? "character" : "user"}.${key}`);
}

function draftFromCharacter(character: CharacterRecord): DraftCharacterInput {
  return {
    name: character.name,
    age: character.age,
    gender: character.gender,
    occupation: character.occupation,
    heritage: character.heritage,
    worldSetting: character.worldSetting,
    concept: character.concept,
    mbti: character.mbti,
    personality: { ...character.personality },
    language: character.language,
    photos: [...character.photos],
    preset: character.preset ?? "Custom"
  };
}
