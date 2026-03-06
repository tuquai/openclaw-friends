"use client";

import { useEffect, useState, useTransition } from "react";
import { buildDiscordAccountId } from "@/lib/discord-account";
import {
  BlueprintPackage,
  CharacterRecord,
  DiscordLink,
  DiscordRuntimeConfig,
  DiscordRuntimeStatus,
  DraftCharacterInput,
  MultiChoiceInput,
  QuestionnaireInput,
  SingleChoiceInput
} from "@/lib/types";
import type { WorkspaceSummary } from "@/lib/workspace";
import type { TuquConfig } from "@/lib/types";
import {
  inferMbtiFromAxes,
  PERSONALITY_AXIS_OPTIONS,
  QUESTION_OPTIONS,
  summarizeMbti
} from "@/lib/mbti";

type DesignerAppProps = {
  initialCharacters: CharacterRecord[];
};

type DesignerViewMode = "browse" | "edit";

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

const initialDraft: DraftCharacterInput = {
  name: "",
  age: "",
  gender: "",
  occupation: "",
  heritage: "",
  worldSetting: "当代地球",
  concept: "",
  mbti: inferMbtiFromAxes(defaultCharacterPersonality),
  personality: defaultCharacterPersonality,
  photos: [],
  preset: "Custom"
};

const initialQuestionnaire: QuestionnaireInput = {
  userNameForRole: "",
  userMbti: inferMbtiFromAxes(defaultUserPersonality),
  userPersonality: defaultUserPersonality,
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

function characterPreview(character: CharacterRecord) {
  return (
    character.blueprintPackage?.summary.oneLiner ||
    character.concept ||
    `${character.occupation || "未填身份"} / ${character.worldSetting || "未设定世界观"}`
  ).trim();
}

function characterAvatarSrc(character: Pick<CharacterRecord, "id" | "updatedAt">) {
  const query = character.updatedAt ? `?v=${encodeURIComponent(character.updatedAt)}` : "";
  return `/api/characters/${character.id}/avatar${query}`;
}

export function DesignerApp({ initialCharacters }: DesignerAppProps) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [selectedId, setSelectedId] = useState(initialCharacters[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<DesignerViewMode>(initialCharacters.length ? "browse" : "edit");
  const [draft, setDraft] = useState(initialDraft);
  const [questionnaire, setQuestionnaire] = useState(initialQuestionnaire);
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
  const [status, setStatus] = useState("准备创建新角色。");
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [discordStatus, setDiscordStatus] = useState("");
  const [blueprintFilesStatus, setBlueprintFilesStatus] = useState("");
  const [tuquStatus, setTuquStatus] = useState("");
  const [discordRuntimeMessage, setDiscordRuntimeMessage] = useState("");
  
  const [isSaving, startSaving] = useTransition();
  const [isComposing, startComposing] = useTransition();
  const [isCreatingWorkspace, startCreatingWorkspace] = useTransition();
  const [isSavingDiscord, startSavingDiscord] = useTransition();
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
  

  const selected = characters.find((character) => character.id === selectedId) ?? null;
  const selectedDiscordAccountId = selected ? buildDiscordAccountId(selected.name, selected.id) : "";
  const savedDiscordAccounts = Object.values(discordRuntimeConfig.accounts);
  const isEditingExisting = Boolean(selected);
  const inferredCharacterMbti = inferMbtiFromAxes(draft.personality);
  const inferredUserMbti = inferMbtiFromAxes(questionnaire.userPersonality);
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

  useEffect(() => {
    setDraft(selected ? draftFromCharacter(selected) : initialDraft);
    setQuestionnaire(selected?.questionnaire ?? initialQuestionnaire);
    setDiscordLinkDraft(selected?.discordLink ?? emptyDiscordLink());
    setTuquConfigDraft(selected?.tuquConfig ?? defaultTuquConfig());
    setBlueprintFilesDraft(selected?.blueprintPackage?.files ?? emptyBlueprintFiles());
    setDiscordStatus("");
    setTuquStatus("");
    setBlueprintFilesStatus("");
  }, [selected]);

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

  function handleUserPersonalityChange(key: keyof QuestionnaireInput["userPersonality"], value: string) {
    setQuestionnaire((current) => {
      const userPersonality = { ...current.userPersonality, [key]: value };
      return { ...current, userPersonality, userMbti: inferMbtiFromAxes(userPersonality) };
    });
  }

  function handleSingleChoiceChange<K extends keyof Pick<
    QuestionnaireInput,
    "lifeStage" | "communicationPreference" | "desiredBond"
  >>(key: K, field: keyof SingleChoiceInput, value: string) {
    setQuestionnaire((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value
      }
    }));
  }

  function handleMultiChoiceToggle<K extends keyof Pick<QuestionnaireInput, "treatmentPreference" | "specialTraits">>(
    key: K,
    value: string
  ) {
    setQuestionnaire((current) => {
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

  function handleMultiChoiceCustomChange<K extends keyof Pick<QuestionnaireInput, "treatmentPreference" | "specialTraits">>(
    key: K,
    value: string
  ) {
    setQuestionnaire((current) => ({
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
    return {
      ...questionnaire,
      userMbti: inferredUserMbti
    };
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
        questionnaire: serializedQuestionnaire()
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
    setDraft(initialDraft);
    setQuestionnaire(initialQuestionnaire);
    setDiscordLinkDraft(emptyDiscordLink());
    setTuquConfigDraft(defaultTuquConfig());
    setBlueprintFilesDraft(emptyBlueprintFiles());
    setDiscordBotTokenDraft("");
    setViewMode("edit");
    setStatus("已切换到新建模式。");
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
        setStatus(`已导入 workspace 角色「${json.character.name}」，可以编辑并补全缺失的配置。`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "导入 workspace 失败");
      }
    });
  }

  function startEditingCharacter(characterId: string) {
    setSelectedId(characterId);
    setViewMode("edit");
    setStatus("已进入角色编辑页。");
  }

  function goBackToBrowse() {
    if (!selectedId && characters[0]?.id) {
      setSelectedId(characters[0].id);
    }
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

  function handleCreate() {
    startSaving(async () => {
      try {
        setWorkspaceStatus("");
        if (!selected) {
          setStatus("正在创建角色...");
          await createCharacterRecord();
          setStatus("角色已创建。下一步可以填写问卷并生成角色信息。");
          return;
        }

        setStatus("正在保存基础信息和问卷...");
        await updateCharacterRecord(selected.id);
        setStatus("角色基础信息和问卷已保存。");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function handleCompose() {
    startComposing(async () => {
      try {
        setWorkspaceStatus("");
        setStatus("正在保存当前内容并生成角色信息...");

        const character = selected ? await updateCharacterRecord(selected.id) : await createCharacterRecord();
        await composeBlueprint(character);
        setViewMode("browse");
        setStatus("角色信息已生成，已返回角色详情。");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "生成失败");
      }
    });
  }

  function handleCreateWorkspace() {
    if (!selected?.blueprintPackage) {
      setWorkspaceStatus("请先生成角色信息，再同步 workspace。");
      setStatus("请先生成角色信息，再同步 workspace。");
      return;
    }

    startCreatingWorkspace(async () => {
      try {
        setWorkspaceStatus("正在同步 OpenClaw workspace...");
        setStatus("正在同步 OpenClaw workspace...");
        const response = await fetch("/api/workspaces/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            characterId: selected.id
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
        mergeCharacterRecord({
          ...selected,
          workspacePath: json.workspacePath,
          discordLink: selected.discordLink
            ? {
                ...selected.discordLink,
                accountId: json.openclawRegistration?.accountId ?? selected.discordLink.accountId,
                guildId: json.openclawRegistration?.guildId ?? selected.discordLink.guildId,
                workspacePath: json.workspacePath
              }
            : selected.discordLink
        });
        const openclawNote = json.openclawRegistration
          ? ` · OpenClaw 已注册 agent ${json.openclawRegistration.agentId}，平台将自动接管 bot 运行。`
          : json.openclawRegistrationError
            ? ` · OpenClaw 注册失败：${json.openclawRegistrationError}`
            : "";
        setWorkspaceStatus(`创建完成：${json.workspacePath}${openclawNote}`);
        setStatus(`workspace 已同步：${json.workspacePath}${openclawNote}`);
      } catch (error) {
        setWorkspaceStatus(error instanceof Error ? error.message : "同步 workspace 失败");
        setStatus(error instanceof Error ? error.message : "同步 workspace 失败");
      }
    });
  }

  function handleSaveDiscordLink() {
    if (!selected) {
      setDiscordStatus("请先创建并选中一个角色。");
      return;
    }

    startSavingDiscord(async () => {
      try {
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
        const json = (await response.json()) as { character?: CharacterRecord; error?: string };
        if (!response.ok || !json.character) {
          throw new Error(json.error ?? "保存 Discord 绑定失败");
        }

        mergeCharacterRecord(json.character);
        setDiscordLinkDraft(json.character.discordLink ?? emptyDiscordLink());
        setDiscordStatus(
          json.character.workspacePath
            ? "Discord 绑定和 Bot Token 已保存，并同步写入当前 workspace。"
            : "Discord 绑定和 Bot Token 已保存。创建 workspace 后会自动写入该角色的 workspace。"
        );
      } catch (error) {
        setDiscordStatus(error instanceof Error ? error.message : "保存 Discord 绑定失败");
      }
    });
  }

  function handleSaveBlueprintFiles() {
    if (!selected?.blueprintPackage) {
      setBlueprintFilesStatus("请先生成角色信息，再编辑 markdown 文件。");
      return;
    }

    startSavingBlueprintFiles(async () => {
      try {
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
        const json = (await response.json()) as { character?: CharacterRecord; error?: string };
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
      } catch (error) {
        setBlueprintFilesStatus(error instanceof Error ? error.message : "保存 markdown 文件失败");
      }
    });
  }

  function handleSaveTuquConfig() {
    if (!selected) {
      setTuquStatus("请先创建并选中一个角色。");
      return;
    }

    startSavingTuqu(async () => {
      try {
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
      } catch (error) {
        setTuquStatus(error instanceof Error ? error.message : "保存 TuQu AI 配置失败");
      }
    });
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

  function renderQuestionnairePanel() {
    return (
      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h3>关系问卷</h3>
              <p>这里改成了更一般的问题。你不需要先知道自己的 MBTI，也可以描述想被怎样对待，以及关系如何升温。</p>
            </div>
          </div>

          <div className="question-grid">
            <div className="field-full">
              <label htmlFor="user-name-for-role">角色如何称呼你</label>
              <input
                id="user-name-for-role"
                onChange={(event) =>
                  setQuestionnaire((current) => ({
                    ...current,
                    userNameForRole: event.target.value
                  }))
                }
                placeholder="例如：admin、周一舟、哥哥、主人"
                value={questionnaire.userNameForRole}
              />
            </div>

            <div className="field-full">
              <label>你的性格倾向</label>
              <div className="option-grid">
                {(Object.keys(PERSONALITY_AXIS_OPTIONS) as Array<keyof typeof PERSONALITY_AXIS_OPTIONS>).map((key) => (
                  <div className="option-card" key={key}>
                    <span className="option-title">{axisLabel(key, false)}</span>
                    <select
                      onChange={(event) => handleUserPersonalityChange(key, event.target.value)}
                      value={questionnaire.userPersonality[key]}
                    >
                      {PERSONALITY_AXIS_OPTIONS[key].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <textarea
                onChange={(event) => handleUserPersonalityChange("otherNotes", event.target.value)}
                placeholder="其他补充：比如社恐但熟了会很能聊，或很理性但会心软。"
                value={questionnaire.userPersonality.otherNotes}
              />
              <div className="inline-note">
                推测 MBTI：<strong>{inferredUserMbti}</strong>
                {activeUserPreset ? ` · ${activeUserPreset.title}` : ""}
              </div>
            </div>

            <ChoiceField
              field={questionnaire.lifeStage}
              label="你现在的阶段"
              onChange={(field, value) => handleSingleChoiceChange("lifeStage", field, value)}
              options={QUESTION_OPTIONS.lifeStage}
            />

            <ChoiceField
              field={questionnaire.communicationPreference}
              label="你更喜欢对方用什么方式和你沟通"
              onChange={(field, value) => handleSingleChoiceChange("communicationPreference", field, value)}
              options={QUESTION_OPTIONS.communicationPreference}
            />

            <ChoiceField
              field={questionnaire.desiredBond}
              label="你希望你们之间是什么样的相处感觉"
              onChange={(field, value) => handleSingleChoiceChange("desiredBond", field, value)}
              options={QUESTION_OPTIONS.desiredBond}
            />

            <CheckboxField
              field={questionnaire.treatmentPreference}
              label="你更希望对方怎么对待你"
              onCustomChange={(value) => handleMultiChoiceCustomChange("treatmentPreference", value)}
              onToggle={(value) => handleMultiChoiceToggle("treatmentPreference", value)}
              options={QUESTION_OPTIONS.treatmentPreference}
            />

            <CheckboxField
              field={questionnaire.specialTraits}
              label="你愿意让角色带哪些属性"
              onCustomChange={(value) => handleMultiChoiceCustomChange("specialTraits", value)}
              onToggle={(value) => handleMultiChoiceToggle("specialTraits", value)}
              options={QUESTION_OPTIONS.specialTraits}
            />

            <div className="field-full">
              <label htmlFor="favorability">初始好感值：{questionnaire.affectionPlan.initialFavorability}</label>
              <input
                id="favorability"
                max={100}
                min={0}
                onChange={(event) =>
                  setQuestionnaire((current) => ({
                    ...current,
                    affectionPlan: {
                      ...current.affectionPlan,
                      initialFavorability: Number(event.target.value)
                    }
                  }))
                }
                type="range"
                value={questionnaire.affectionPlan.initialFavorability}
              />
              <div className="range-labels">
                <span>陌生</span>
                <span>普通熟悉</span>
                <span>高好感开局</span>
              </div>
            </div>

            <ChoiceField
              field={{
                selected: questionnaire.affectionPlan.growthRoute,
                custom: questionnaire.affectionPlan.growthRouteCustom
              }}
              label="好感值提升路线"
              onChange={(field, value) =>
                setQuestionnaire((current) => ({
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

          <div className="actions">
            <span className="status">问卷会跟随“保存角色和问卷”或“生成并预览角色信息”一起保存。</span>
          </div>
          <div className="footer-note">
            <span className="status">问卷修改会在保存角色或生成角色信息时一并保存。</span>
            <br />
            生成后会返回角色详情页，查看结构化蓝图以及 `IDENTITY.md`、`SOUL.md`、`USER.md`、`MEMORY.md`
            的内容。
            <br />
            <span className="status">{status}</span>
          </div>
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
              <h2>现有角色</h2>
              <p>先在这里选择角色；需要修改时再进入独立编辑页。</p>
            </div>
            <div className="panel-title-actions">
              <button className="button-primary" onClick={startNewCharacter} type="button">
                新建角色
              </button>
              <button className="button-secondary" onClick={openWorkspacePicker} type="button">
                同步现有 Workspace
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
                  {character.photos[0] ? (
                    <img alt={character.name} className="thumb" src={characterAvatarSrc(character)} />
                  ) : (
                    <div className="thumb thumb-placeholder">{character.name.slice(0, 1)}</div>
                  )}
                  <div style={{ textAlign: "left" }}>
                    <strong>{character.name}</strong>
                    <div className="meta-line">
                      {character.age ? <span className="pill">{character.age} 岁</span> : null}
                      {character.mbti ? <span className="pill">{character.mbti}</span> : null}
                      {character.occupation ? <span className="pill warm">{character.occupation}</span> : null}
                      {character.discordLink ? <span className="pill">Discord 已绑定</span> : null}
                      {character.workspacePath ? <span className="pill">Workspace 已创建</span> : null}
                    </div>
                    <p className="character-preview">{characterPreview(character)}</p>
                  </div>
                </button>
                <div className="card-actions">
                  <button
                    className="button-ghost button-inline-action"
                    onClick={() => startEditingCharacter(character.id)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="button-danger button-inline-action"
                    disabled={isSaving}
                    onClick={() => handleDeleteCharacter(character.id, character.name)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}

            {characters.length === 0 ? (
              <div className="empty-state">还没有角色。先点右上角“新建角色”。</div>
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
              <h2>{isEditingExisting ? "编辑角色" : "创建角色"}</h2>
              <p>
                {isEditingExisting
                  ? "修改基础信息、问卷或 Discord 绑定后，都可以单独保存。"
                  : "先给角色一个世界、一个感觉，再用更一般的行为问题推测她的 MBTI。"}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">姓名</label>
              <input id="name" onChange={(event) => handleDraftChange("name", event.target.value)} value={draft.name} />
            </div>

            <div className="field">
              <label htmlFor="age">年龄</label>
              <input id="age" onChange={(event) => handleDraftChange("age", event.target.value)} value={draft.age} />
            </div>

            <div className="field">
              <label htmlFor="gender">性别</label>
              <input id="gender" onChange={(event) => handleDraftChange("gender", event.target.value)} value={draft.gender} />
            </div>

            <div className="field">
              <label htmlFor="occupation">身份</label>
              <input
                id="occupation"
                onChange={(event) => handleDraftChange("occupation", event.target.value)}
                value={draft.occupation}
              />
            </div>

            <div className="field">
              <label htmlFor="heritage">背景 / 籍贯</label>
              <input
                id="heritage"
                onChange={(event) => handleDraftChange("heritage", event.target.value)}
                value={draft.heritage}
              />
            </div>

            <div className="field">
              <label htmlFor="worldSetting">角色所处世界</label>
              <input
                id="worldSetting"
                onChange={(event) => handleDraftChange("worldSetting", event.target.value)}
                placeholder="例如：当代地球、修仙界、未来都市、架空王朝"
                value={draft.worldSetting}
              />
            </div>

            <div className="field-full">
              <label htmlFor="concept">角色概念</label>
              <textarea
                id="concept"
                onChange={(event) => handleDraftChange("concept", event.target.value)}
                placeholder="把你对这个角色的所有看法写在这里：气质、标签、关系想象、审美、设计备注，都可以塞进来。"
                value={draft.concept}
              />
            </div>

            <div className="field-full">
              <label>角色性格推测</label>
              <div className="option-grid">
                {(Object.keys(PERSONALITY_AXIS_OPTIONS) as Array<keyof typeof PERSONALITY_AXIS_OPTIONS>).map((key) => (
                  <div className="option-card" key={key}>
                    <span className="option-title">{axisLabel(key, true)}</span>
                    <select
                      onChange={(event) => handleCharacterPersonalityChange(key, event.target.value)}
                      value={draft.personality[key]}
                    >
                      {PERSONALITY_AXIS_OPTIONS[key].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <textarea
                onChange={(event) => handleCharacterPersonalityChange("otherNotes", event.target.value)}
                placeholder="其他补充：比如傲娇、会嘴硬、轻微占有欲、话少但行动派。"
                value={draft.personality.otherNotes}
              />
            </div>

            <div className="field-full">
              <label htmlFor="photos">角色照片</label>
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
              {draft.photos.length ? (
                <div className="photo-strip">
                  {draft.photos.map((photo, idx) => (
                    <img
                      alt="uploaded"
                      key={`${photo}-${idx}`}
                      src={photo}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hint-box">
            <strong>{inferredCharacterMbti}</strong>
            <p style={{ marginBottom: 8 }}>
              {activePreset ? `${activePreset.title}：${activePreset.defaults.join("、")}。` : "当前维度还不足以稳定推测。"}
            </p>
            {activePreset ? <span className="footer-note">建议节奏：{activePreset.rhythm}</span> : null}
          </div>

          <div className="actions">
            <button className="button-primary" disabled={isSaving} onClick={handleCreate} type="button">
              {isSaving ? (isEditingExisting ? "保存中..." : "创建中...") : isEditingExisting ? "保存角色和问卷" : "先创建角色"}
            </button>
            <button className="button-secondary" disabled={isComposing} onClick={handleCompose} type="button">
              {isComposing ? "生成中..." : "生成并预览角色信息"}
            </button>
            <span className="status">
              {selected ? "保存按钮只更新角色和问卷；生成按钮会重新生成角色信息并跳回详情页。" : "可以先创建角色，或直接生成并预览角色信息。"}
            </span>
          </div>

          <div className="stack-sm">
            <h4>Discord 绑定</h4>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="discord-guild-id">Server ID</label>
                <input
                  id="discord-guild-id"
                  onChange={(event) => handleDiscordDraftChange("guildId", event.target.value)}
                  placeholder="可选；留空时会尝试从 Channel ID 自动解析"
                  value={discordLinkDraft.guildId ?? ""}
                />
              </div>

              <div className="field">
                <label htmlFor="discord-channel-id">Channel ID</label>
                <input
                  id="discord-channel-id"
                  onChange={(event) => handleDiscordDraftChange("channelId", event.target.value)}
                  placeholder="OpenClaw 绑定目标频道；当前接管模式下频道内仍需 @mention"
                  value={discordLinkDraft.channelId}
                />
              </div>

              <div className="field">
                <label htmlFor="discord-user-id">User ID</label>
                <input
                  id="discord-user-id"
                  onChange={(event) => handleDiscordDraftChange("userId", event.target.value)}
                  placeholder="你的 Discord 用户 ID；只允许这个账号和角色交互"
                  value={discordLinkDraft.userId}
                />
              </div>

              <div className="field-full">
                <label htmlFor="discord-bot-token">Discord Login Token</label>
                <input
                  id="discord-bot-token"
                  onChange={(event) => handleDiscordRuntimeConfigChange(event.target.value)}
                  placeholder="这只角色 bot 的登录 token"
                  type="password"
                  value={discordBotTokenDraft}
                />
              </div>
            </div>
            <div className="actions">
              <button className="button-secondary" disabled={isSavingDiscord} onClick={handleSaveDiscordLink} type="button">
                {isSavingDiscord ? "保存中..." : "保存 Discord 配置"}
              </button>
            </div>
            <div className="workspace-feedback">
              {selected?.workspacePath ? `当前 workspace：${selected.workspacePath}` : "当前角色还没有 workspace。"}
              <br />
              {selected
                ? `OpenClaw Discord Account ID：${selectedDiscordAccountId}${discordLinkDraft.botId ? ` · Bot User ID：${discordLinkDraft.botId}` : ""}`
                : "先创建角色，再为这个角色保存专属 Discord 账号。"}
              <br />
              {discordStatus || "保存 Discord 配置后，同步 Workspace 即可完成 OpenClaw 注册，平台会自动管理 bot 运行和消息路由。"}

            </div>
          </div>

          <div className="stack-sm">
            <h4>TuQu AI 配置</h4>
            <div className="form-grid">
              <div className="field-full">
                <label>注册/充值</label>
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
                  placeholder="明文保存的 TuQu AI Service Key"
                  value={tuquConfigDraft.serviceKey}
                />
              </div>

              <div className="field-full">
                <label>TuQu AI Character ID</label>
                <div className="tuqu-character-status-row">
                  {tuquConfigDraft.characterId ? (
                    <span className="pill" style={{ fontSize: "0.92rem" }}>
                      已注册：{tuquConfigDraft.characterId}
                    </span>
                  ) : (
                    <span className="pill warm" style={{ fontSize: "0.92rem" }}>尚未注册</span>
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
                          <strong style={{ fontSize: "0.92rem" }}>什么是 TuQu Character？</strong>
                          <button
                            className="button-ghost"
                            onClick={() => setShowTuquCharacterInfo(false)}
                            style={{ padding: "4px 10px", fontSize: "0.82rem", borderRadius: "8px" }}
                            type="button"
                          >
                            关闭
                          </button>
                        </div>
                        <p style={{ margin: "8px 0 0", lineHeight: 1.6, fontSize: "0.9rem", color: "var(--muted)" }}>
                          TuQu Character 是用指定角色的照片及特征介绍创建的一个参考用人物。创建后可以无限为该角色生成照片，而无需提供除了该角色 ID 之外的参数。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="button-secondary" disabled={isSavingTuqu} onClick={handleSaveTuquConfig} type="button">
                {isSavingTuqu ? "保存中..." : "保存 TuQu AI 配置"}
              </button>
              <button className="button-ghost" disabled={isCreatingTuquCharacter} onClick={handleCreateTuquCharacter} type="button">
                {isCreatingTuquCharacter ? "创建中..." : "创建 TuQu AI Character"}
              </button>
            </div>
            <div className="workspace-feedback">
              {selected?.workspacePath ? `当前 workspace：${selected.workspacePath}` : "当前角色还没有 workspace。"}
              <br />
              {tuquStatus || "这里会明文保存 TuQu AI Service Key，并同步到 workspace。"}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderDetailPanel() {
    return (
      <section className="panel">
        <div className="panel-inner">
          <div className="panel-title">
            <div>
              <h3>角色详情</h3>
              <p>生成后会看到结构化蓝图和可继续编辑的角色信息。</p>
            </div>
          </div>

          {selected ? (
            <div className="detail-block">
              <div>
                <strong style={{ fontSize: "1.4rem" }}>{selected.name}</strong>
                <div className="meta-line">
                  {selected.age ? <span className="pill">{selected.age} 岁</span> : null}
                  {selected.gender ? <span className="pill">{selected.gender}</span> : null}
                  {selected.mbti ? <span className="pill warm">{selected.mbti}</span> : null}
                </div>
              </div>

              <div>
                <h4>基础信息</h4>
                <p>
                  {selected.occupation || "未填身份"}
                  {selected.heritage ? ` / ${selected.heritage}` : ""}
                </p>
                <p>世界观：{selected.worldSetting || "未设定"}</p>
                <p>{selected.concept || "还没有角色概念描述。"}</p>
              </div>

              <div>
                <h4>人格推测</h4>
                <p>
                  {selected.mbti} · {selected.personality.socialEnergy} / {selected.personality.informationFocus} /{" "}
                  {selected.personality.decisionStyle} / {selected.personality.lifestylePace}
                </p>
                {selected.personality.otherNotes ? <p>{selected.personality.otherNotes}</p> : null}
              </div>

              {selected.blueprintPackage ? (
                <>
                  <div>
                    <h4>一句话摘要</h4>
                    <p>{selected.blueprintPackage.summary.oneLiner}</p>
                    <p>原型：{selected.blueprintPackage.summary.archetype}</p>
                  </div>

                  <div>
                    <h4>核心特质</h4>
                    <ul>
                      {coreTraits.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>说话方式</h4>
                    <ul>
                      {speakingStyle.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>关系叙事</h4>
                    <p>{selected.blueprintPackage.relationship.backstory}</p>
                    <p>关系动态：{selected.blueprintPackage.relationship.dynamic}</p>
                    <p>初始好感：{selected.blueprintPackage.relationship.affectionBaseline}</p>
                  </div>

                  <div>
                    <h4>好感提升路线</h4>
                    <ul>
                      {affectionGrowthPath.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>如何称呼用户</h4>
                    <p>{questionnaire.userNameForRole || selected.blueprintPackage.relationship.userAddressingStyle || "未设定"}</p>
                  </div>

                  <div>
                    <h4>关系化学反应</h4>
                    <ul>
                      {chemistry.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>边界与避免项</h4>
                    <ul>
                      {hardBoundaries.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>下一步该补什么</h4>
                    <ul>
                      {optionalDeepeningQuestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>编辑 IDENTITY.md</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("identityMd", event.target.value)}
                      value={blueprintFilesDraft.identityMd}
                    />
                  </div>

                  <div>
                    <h4>编辑 SOUL.md</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("soulMd", event.target.value)}
                      value={blueprintFilesDraft.soulMd}
                    />
                  </div>

                  <div>
                    <h4>编辑 USER.md</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("userMd", event.target.value)}
                      value={blueprintFilesDraft.userMd}
                    />
                  </div>

                  <div>
                    <h4>编辑 MEMORY.md</h4>
                    <textarea
                      className="markdown-editor"
                      onChange={(event) => handleBlueprintFileChange("memoryMd", event.target.value)}
                      value={blueprintFilesDraft.memoryMd}
                    />
                  </div>

                  <div className="actions">
                    <button
                      className="button-secondary"
                      disabled={isSavingBlueprintFiles}
                      onClick={handleSaveBlueprintFiles}
                      type="button"
                    >
                      {isSavingBlueprintFiles ? "保存中..." : "保存 Markdown 文件"}
                    </button>
                      <button
                        className="button-primary"
                        disabled={isCreatingWorkspace}
                        onClick={handleCreateWorkspace}
                        type="button"
                      >
                        {isCreatingWorkspace ? "同步中..." : "同步 OpenClaw Workspace"}
                      </button>
                    </div>
                    <div className="workspace-feedback">
                      {blueprintFilesStatus || "这里的四个 Markdown 文件可以直接手动编辑。保存后会覆盖角色包里的最终内容。"}
                      <br />
                      {workspaceStatus || "同步成功后，这里会显示 workspace 路径。已有 workspace 也会被当前角色包内容覆盖更新。"}
                    </div>
                </>
              ) : (
                <div className="empty-state">这个角色还没有生成角色信息。完成编辑后点“生成并预览角色信息”。</div>
              )}
            </div>
          ) : (
            <div className="empty-state">还没有选中的角色。</div>
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
            <h1>OpenClaw Friends</h1>
            <p>
              这一版把“直接填 MBTI + 粗糙关系标签”改成了“更一般的性格问题 + 世界观 + 好感路线”。
              目标不是做心理测试，而是给角色和关系一个更自然的起点。
            </p>
            <div className="badge-row">
              <span className="badge">世界观设定</span>
              <span className="badge">MBTI 自动推测</span>
              <span className="badge">多选关系偏好</span>
              <span className="badge">好感值路线</span>
              <a
                className="badge discord-badge"
                href="https://discord.gg/Y5EExWtP"
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg width="20" height="16" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.9 58.9 0 0017.7 9 .2.2 0 00.3-.1 42.1 42.1 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0070.7 45.7v-.2c1.4-15.2-2.4-28.4-10-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1zm23.3 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1z" fill="currentColor"/>
                </svg>
                官方 Discord
              </a>
            </div>
          </div>
          <div className="hint-box">
            <strong>为什么改成这种问法：</strong>
            <p>
              不是每个人都知道自己的 MBTI，但大多数人知道自己是更外向还是更慢热、喜欢被直接沟通还是被温柔接住。把问题拆开以后，角色和关系都更容易落地。
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner stack">
          <div className="panel-title">
            <div>
              <h2>Discord Bots</h2>
              <p>
                保存 Discord 配置并同步 Workspace 后，OpenClaw 会自动接管所有角色 bot 的运行和 @mention 路由。
                <br />
                下方的本地启动仅用于调试——直接在 Designer 进程内运行 bot，不经过 OpenClaw。
              </p>
            </div>
          </div>

          <div className="workspace-feedback">
            {savedDiscordAccounts.length
              ? savedDiscordAccounts.map((account) => `${account.characterName ?? account.accountId}: 已注册`).join(" | ")
              : "还没有保存任何角色级 Discord 账号。先在角色详情里保存 Discord 配置，再同步 Workspace。"}
          </div>

          <details>
            <summary>本地调试：在 Designer 进程内启动 Bots</summary>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              {discordRuntimeStatus.running ? (
                <button className="button-ghost" disabled={isStoppingDiscordRuntime} onClick={handleStopDiscordRuntime} type="button">
                  {isStoppingDiscordRuntime ? "停止中..." : "停止调试 Bots"}
                </button>
              ) : (
                <button className="button-ghost" disabled={isStartingDiscordRuntime} onClick={handleStartDiscordRuntime} type="button">
                  {isStartingDiscordRuntime ? "启动中..." : "启动调试 Bots"}
                </button>
              )}
            </div>
            <div className="workspace-feedback">
              {discordRuntimeStatus.running ? "至少有一个 Discord bot 正在本地运行。" : "当前没有正在本地运行的 Discord bot。"}
              <br />
              {discordRuntimeStatus.accounts.length
                ? discordRuntimeStatus.accounts
                    .map((account) =>
                      account.running
                        ? `${account.characterName ?? account.accountId}: ${account.botTag ?? account.botUserId ?? "已登录"}`
                        : `${account.characterName ?? account.accountId}: 未运行`
                    )
                    .join(" | ")
                : ""}
              {discordRuntimeMessage || discordRuntimeStatus.error || ""}
            </div>
          </details>
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
                返回
              </button>
            ) : null}
            <div>
              <strong>{selected ? `正在编辑：${selected.name}` : "正在创建新角色"}</strong>
              <div className="status">保存后可返回角色页查看详情。</div>
            </div>
          </div>
          <section className="panel-grid">
            {renderEditorPanel()}
            {renderQuestionnairePanel()}
          </section>
        </section>
      )}

      {showWorkspacePicker && (
        <div className="workspace-picker-overlay" onClick={() => setShowWorkspacePicker(false)}>
          <div className="workspace-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-picker-header">
              <h3>同步现有 Workspace</h3>
              <button
                className="button-ghost"
                onClick={() => setShowWorkspacePicker(false)}
                type="button"
              >
                关闭
              </button>
            </div>
            <p className="workspace-picker-desc">
              选择一个已有的 workspace 导入为设计器角色。导入后可以编辑并补全缺失的配置，然后同步回 workspace。
            </p>
            {isLoadingWorkspaces ? (
              <div className="workspace-picker-loading">正在扫描 workspace 目录...</div>
            ) : availableWorkspaces.length === 0 ? (
              <div className="workspace-picker-empty">
                没有找到可导入的 workspace。已被设计器管理的 workspace 不会重复显示。
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
                        {ws.hasCharacterRecord && <span className="pill">完整记录</span>}
                      </div>
                    </div>
                    <button
                      className="button-primary"
                      disabled={isImportingWorkspace}
                      onClick={() => handleImportWorkspace(ws.workspacePath)}
                      type="button"
                    >
                      {isImportingWorkspace ? "导入中..." : "导入"}
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
  options,
  field,
  onChange
}: {
  label: string;
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
            {option}
          </option>
        ))}
      </select>
      <input
        onChange={(event) => onChange("custom", event.target.value)}
        placeholder="其他：如果选项不够，直接补充"
        value={field.custom}
      />
    </div>
  );
}

function CheckboxField({
  label,
  options,
  field,
  onToggle,
  onCustomChange
}: {
  label: string;
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
            <span>{option}</span>
          </label>
        ))}
      </div>
      <input
        onChange={(event) => onCustomChange(event.target.value)}
        placeholder="其他：自己补充想要的相处特征"
        value={field.custom}
      />
    </div>
  );
}

function axisLabel(key: keyof typeof PERSONALITY_AXIS_OPTIONS, isCharacter: boolean) {
  switch (key) {
    case "socialEnergy":
      return isCharacter ? "ta 累了更需要" : "你累了更需要";
    case "informationFocus":
      return isCharacter ? "ta 更关注什么" : "你更关注什么";
    case "decisionStyle":
      return isCharacter ? "ta 做判断时更先看什么" : "你做判断时更先看什么";
    case "lifestylePace":
      return isCharacter ? "ta 的生活节奏" : "你的生活节奏";
    default:
      return key;
  }
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
    photos: [...character.photos],
    preset: character.preset ?? "Custom"
  };
}
