import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import zh from "@/locales/zh.json";
import type { AppLanguage } from "@/lib/types";

type Dictionary = Record<string, string>;

const dictionaries: Record<AppLanguage, Dictionary> = {
  zh,
  en,
  ja
};

export const APP_LANGUAGES: AppLanguage[] = ["zh", "en", "ja"];

const optionKeys: Record<string, string> = {
  靠和人互动回血: "choice.personality.socialEnergy.extrovert",
  靠独处和安静回血: "choice.personality.socialEnergy.introvert",
  更关注可能性和脑洞: "choice.personality.informationFocus.intuitive",
  更关注现实细节和经验: "choice.personality.informationFocus.sensing",
  先看逻辑和原则: "choice.personality.decisionStyle.thinking",
  先看感受和关系: "choice.personality.decisionStyle.feeling",
  更喜欢计划和稳定: "choice.personality.lifestylePace.judging",
  更喜欢弹性和即兴: "choice.personality.lifestylePace.perceiving",
  小学阶段: "choice.lifeStage.elementary",
  初中阶段: "choice.lifeStage.middle",
  高中阶段: "choice.lifeStage.high",
  大学阶段: "choice.lifeStage.college",
  刚工作: "choice.lifeStage.firstJob",
  工作多年: "choice.lifeStage.workYears",
  "创作者 / 自由职业": "choice.lifeStage.creator",
  直接一点: "choice.communication.direct",
  温柔一点: "choice.communication.gentle",
  有话直说但别太冲: "choice.communication.directSoft",
  会认真接我的情绪: "choice.communication.emotion",
  会互相吐槽: "choice.communication.teasing",
  轻松幽默一点: "choice.communication.humor",
  先尊重边界再靠近: "choice.communication.boundary",
  愿意主动表达在意: "choice.communication.expressCare",
  慢慢熟起来的伙伴: "choice.bond.slowPartner",
  "轻微暧昧、会拉扯一点": "choice.bond.flirty",
  "朋友以上，恋人未满": "choice.bond.moreThanFriend",
  互相照顾型: "choice.bond.caring",
  并肩作战型: "choice.bond.fighting",
  欢喜冤家: "choice.bond.enemies",
  稳定陪伴型: "choice.bond.steady",
  "偏治愈、能让人安心": "choice.bond.healing",
  有一点被带领的感觉: "choice.bond.guided",
  被理解: "choice.treatment.understood",
  被认真倾听: "choice.treatment.listened",
  被鼓励: "choice.treatment.encouraged",
  被坚定选择: "choice.treatment.chosen",
  被偏爱一点: "choice.treatment.favored",
  被照顾日常: "choice.treatment.cared",
  被尊重边界: "choice.treatment.boundary",
  被需要的时候能接住: "choice.treatment.caught",
  被提醒和督促: "choice.treatment.reminded",
  被吐槽但不冒犯: "choice.treatment.teased",
  被适度引导: "choice.treatment.guided",
  傲娇: "choice.trait.tsundere",
  嘴硬心软: "choice.trait.softInside",
  毒舌但有分寸: "choice.trait.sharp",
  占有欲一点点: "choice.trait.possessive",
  高冷慢热: "choice.trait.coolSlow",
  天然直球: "choice.trait.direct",
  有点黏人: "choice.trait.clingy",
  会吃醋但不作: "choice.trait.jealous",
  反差感强: "choice.trait.gap",
  "行动派，不爱空话": "choice.trait.action",
  情绪稳定: "choice.trait.stable",
  很会照顾细节: "choice.trait.detail",
  审美很好: "choice.trait.aesthetic",
  有一点控制欲但讲道理: "choice.trait.control",
  从陌生到熟悉慢慢升温: "choice.growth.slow",
  "已经有高好感，重点是稳定关系": "choice.growth.high",
  先互相试探再逐步信任: "choice.growth.testing",
  一起经历事件后快速升温: "choice.growth.event"
};

export function normalizeLanguage(value?: string): AppLanguage {
  return value === "en" || value === "ja" || value === "zh" ? value : "zh";
}

export function t(language: AppLanguage, key: string, vars?: Record<string, string | number>) {
  const template = dictionaries[language][key] ?? dictionaries.zh[key] ?? key;
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, token) => String(vars[token] ?? ""));
}

export function translateOption(language: AppLanguage, raw: string) {
  const key = optionKeys[raw];
  return key ? t(language, key) : raw;
}

export function getLanguageLabel(language: AppLanguage, value: AppLanguage) {
  return t(language, `language.${value}`);
}

export function getUiLanguageName(value: AppLanguage) {
  return getLanguageLabel(value, value);
}

export function instructionLanguageName(language: AppLanguage) {
  switch (language) {
    case "en":
      return "English";
    case "ja":
      return "Japanese";
    case "zh":
    default:
      return "Chinese";
  }
}
