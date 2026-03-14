import assert from "node:assert/strict";
import test from "node:test";
import type { BlueprintPackage, DraftCharacterInput } from "../lib/types";

const draftWithoutMbti: DraftCharacterInput = {
  name: "Lum",
  age: "19",
  gender: "女",
  occupation: "学生",
  heritage: "外星人",
  worldSetting: "福星小子",
  concept: "热烈又黏人的知名角色",
  personality: {
    socialEnergy: "靠和人互动回血",
    informationFocus: "更关注可能性和脑洞",
    decisionStyle: "先看感受和关系",
    lifestylePace: "更喜欢弹性和即兴",
    otherNotes: "知名角色时允许直接按角色气质定调"
  },
  language: "zh",
  photos: []
};

const blueprintWithoutChemistryAndFriction: BlueprintPackage = {
  summary: {
    oneLiner: "带电又黏人的外星少女。",
    archetype: "热烈主动型",
    confidenceNotes: []
  },
  character: {
    name: "Lum",
    age: "19",
    gender: "女",
    occupation: "学生",
    heritage: "外星人",
    worldSetting: "福星小子",
    concept: "热烈又黏人的知名角色",
    coreTraits: ["主动", "热烈"],
    speakingStyle: ["直接表达喜欢", "轻快吐槽"],
    emotionalHabits: ["吃醋写在脸上"],
    topicPreferences: ["日常陪伴", "新鲜怪事"],
    hardBoundaries: ["不越过隐私边界"]
  },
  relationship: {
    dynamic: "一热一冷但会慢慢磨出默契。",
    backstory: "在怪事频发的日常里逐渐熟起来。",
    affectionBaseline: "一开始就有兴趣，但会观察对方能不能接住她的热情。",
    affectionGrowthPath: ["记住她在意的小事", "在她闹腾时给出稳定回应"],
    userAddressingStyle: "会亲昵地直呼名字"
  },
  followups: {
    missingButUseful: [],
    optionalDeepeningQuestions: []
  },
  files: {
    identityMd: "# IDENTITY.md",
    soulMd: "# SOUL.md",
    userMd: "# USER.md",
    memoryMd: "# MEMORY.md"
  }
};

test("blueprint contracts allow optional mbti and omit chemistry or friction", () => {
  assert.equal(draftWithoutMbti.name, "Lum");
  assert.equal(blueprintWithoutChemistryAndFriction.relationship.affectionGrowthPath.length, 2);
});
