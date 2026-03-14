export type AppLanguage = "zh" | "en" | "ja";

export type PersonalityAxes = {
  socialEnergy: string;
  informationFocus: string;
  decisionStyle: string;
  lifestylePace: string;
  otherNotes: string;
};

export type SingleChoiceInput = {
  selected: string;
  custom: string;
};

export type MultiChoiceInput = {
  selected: string[];
  custom: string;
};

export type DiscordLink = {
  accountId?: string;
  guildId?: string;
  channelId: string;
  botId?: string;
  userId: string;
  linkedAt: string;
  workspacePath?: string;
};

export type TuquConfig = {
  registrationUrl: string;
  serviceKey: string;
  characterId?: string;
  updatedAt: string;
};

export type DiscordRuntimeAccountConfig = {
  accountId: string;
  botToken: string;
  botId?: string;
  characterId?: string;
  characterName?: string;
  updatedAt: string;
};

export type DiscordRuntimeConfig = {
  accounts: Record<string, DiscordRuntimeAccountConfig>;
  updatedAt: string;
};

export type DiscordRuntimeAccountStatus = {
  accountId: string;
  running: boolean;
  botUserId?: string;
  botTag?: string;
  characterId?: string;
  characterName?: string;
  startedAt?: string;
  error?: string;
};

export type DiscordRuntimeStatus = {
  running: boolean;
  accounts: DiscordRuntimeAccountStatus[];
  error?: string;
};

export type BlueprintPackage = {
  summary: {
    oneLiner: string;
    archetype: string;
    confidenceNotes: string[];
  };
  character: {
    name: string;
    age: string;
    gender: string;
    occupation: string;
    heritage: string;
    worldSetting: string;
    concept: string;
    mbti?: string;
    coreTraits: string[];
    speakingStyle: string[];
    emotionalHabits: string[];
    topicPreferences: string[];
    hardBoundaries: string[];
  };
  relationship: {
    dynamic: string;
    backstory: string;
    affectionBaseline: string;
    affectionGrowthPath: string[];
    userAddressingStyle: string;
  };
  followups: {
    missingButUseful: string[];
    optionalDeepeningQuestions: string[];
  };
  files: {
    identityMd: string;
    soulMd: string;
    userMd: string;
    memoryMd: string;
  };
};

export type CharacterRecord = {
  id: string;
  name: string;
  age: string;
  gender: string;
  occupation: string;
  heritage: string;
  worldSetting: string;
  concept: string;
  mbti?: string;
  personality: PersonalityAxes;
  language: AppLanguage;
  photos: string[];
  createdAt: string;
  updatedAt: string;
  questionnaire?: RelationshipQuestionnaireInput;
  blueprintPackage?: BlueprintPackage;
  discordLink?: DiscordLink;
  tuquConfig?: TuquConfig;
  workspacePath?: string;
  preset?: string;
};

export type DraftCharacterInput = {
  name: string;
  age: string;
  gender: string;
  occupation: string;
  heritage: string;
  worldSetting: string;
  concept: string;
  mbti?: string;
  personality: PersonalityAxes;
  language: AppLanguage;
  photos: string[];
  preset?: string;
};

export type UserProfileInput = {
  language: AppLanguage;
  userMbti: string;
  userPersonality: PersonalityAxes;
  lifeStage: SingleChoiceInput;
  communicationPreference: SingleChoiceInput;
};

export type RelationshipQuestionnaireInput = {
  userNameForRole: string;
  desiredBond: SingleChoiceInput;
  treatmentPreference: MultiChoiceInput;
  specialTraits: MultiChoiceInput;
  affectionPlan: {
    initialFavorability: number;
    growthRoute: string;
    growthRouteCustom: string;
  };
};

export type QuestionnaireInput = UserProfileInput & RelationshipQuestionnaireInput;
