import type { PersonalityAxes } from "@/lib/types";

type AxisOption = {
  value: string;
  label: string;
  letter: string;
};

export const MBTI_PRESETS: Record<
  string,
  {
    title: string;
    defaults: string[];
    rhythm: string;
  }
> = {
  ENFP: {
    title: "Spark Friend",
    defaults: ["主动点亮气氛", "容易对人和故事起兴趣", "相处时带一点即兴感"],
    rhythm: "先用热度拉近距离，再靠真诚维持关系"
  },
  ENFJ: {
    title: "Warm Guide",
    defaults: ["会注意他人感受", "擅长组织关系节奏", "愿意主动表达关心"],
    rhythm: "常常一边照顾人，一边推进关系"
  },
  ESFP: {
    title: "Social Muse",
    defaults: ["重视现场感和体验", "反馈快", "很会把相处变得有趣"],
    rhythm: "关系靠一起经历和当下互动升温"
  },
  ESTP: {
    title: "Sharp Instigator",
    defaults: ["反应快", "敢试敢聊", "喜欢直接验证感觉"],
    rhythm: "边试探边靠近，节奏干脆"
  },
  INFP: {
    title: "Tender Dreamer",
    defaults: ["内心丰富", "重视意义和真心", "慢热但会记细节"],
    rhythm: "先建立安全感，再逐步打开自己"
  },
  INFJ: {
    title: "Quiet Reader",
    defaults: ["擅长读空气", "会观察深层动机", "情绪表达克制但不迟钝"],
    rhythm: "先理解对方，再决定关系深度"
  },
  ISFP: {
    title: "Soft Aesthetic",
    defaults: ["审美敏感", "真实不装", "喜欢用行动表达而不是讲大道理"],
    rhythm: "靠细小照顾和共同体验建立亲近"
  },
  INTP: {
    title: "Detached Builder",
    defaults: ["脑内推演多", "喜欢讨论想法", "熟了以后会很有梗"],
    rhythm: "先交换观点，再慢慢生出信任"
  },
  INTJ: {
    title: "Cold Precision",
    defaults: ["逻辑稳定", "边界清楚", "关系推进需要理由和观察"],
    rhythm: "慢热，但一旦确认就会很稳定"
  },
  ENTJ: {
    title: "Sharp Lead",
    defaults: ["目标清晰", "擅长定节奏", "说话直接而有效"],
    rhythm: "会自然掌舵关系的推进速度"
  },
  ISTJ: {
    title: "Steady Anchor",
    defaults: ["可靠守序", "重视兑现和习惯", "不喜欢空话"],
    rhythm: "靠持续稳定的行动积累信任"
  },
  ISFJ: {
    title: "Gentle Keeper",
    defaults: ["照顾细节", "关系里很稳", "不喜欢太冒进"],
    rhythm: "低调但持续地提供安全感"
  },
  ESTJ: {
    title: "Firm Organizer",
    defaults: ["执行力强", "不爱拖沓", "擅长把事情安排清楚"],
    rhythm: "先把秩序建立起来，再谈更深的亲近"
  },
  ESFJ: {
    title: "Social Host",
    defaults: ["很会照顾场面", "重视回应", "喜欢有来有往的关系"],
    rhythm: "通过稳定互动和情绪反馈拉近彼此"
  },
  ISTP: {
    title: "Cool Fixer",
    defaults: ["话不多但有行动", "临场反应强", "不爱被管太多"],
    rhythm: "在一起做事的过程中慢慢熟起来"
  }
};

export const PERSONALITY_AXIS_OPTIONS: Record<keyof Omit<PersonalityAxes, "otherNotes">, AxisOption[]> = {
  socialEnergy: [
    { value: "靠和人互动回血", label: "和人在一起反而更有劲（聚完一圈人，比出门前还精神）", letter: "E" },
    { value: "靠独处和安静回血", label: "一个人待着才能缓过来（需要独处时间，才能重新找回状态）", letter: "I" }
  ],
  informationFocus: [
    { value: "更关注可能性和脑洞", label: "更关注可能性和想象（爱聊「如果……」，喜欢往深里联想）", letter: "N" },
    { value: "更关注现实细节和经验", label: "更关注现实细节和经验（更相信亲眼见到的、实际试过的）", letter: "S" }
  ],
  decisionStyle: [
    { value: "先看逻辑和原则", label: "先看逻辑和原则（先问「这样做对不对」，再考虑感受）", letter: "T" },
    { value: "先看感受和关系", label: "先看感受和关系（先问「大家会不会难受」，再讲道理）", letter: "F" }
  ],
  lifestylePace: [
    { value: "更喜欢计划和稳定", label: "更喜欢计划和稳定（提前定好才踏实，临时变动让人焦虑）", letter: "J" },
    { value: "更喜欢弹性和即兴", label: "更喜欢弹性和即兴（太多计划有点束缚，随时能调整最自在）", letter: "P" }
  ]
};

export const QUESTION_OPTIONS = {
  lifeStage: [
    "小学阶段",
    "初中阶段",
    "高中阶段",
    "大学阶段",
    "刚工作",
    "工作多年",
    "创作者 / 自由职业"
  ],
  communicationPreference: [
    "直接一点",
    "温柔一点",
    "有话直说但别太冲",
    "会认真接我的情绪",
    "会互相吐槽",
    "轻松幽默一点",
    "先尊重边界再靠近",
    "愿意主动表达在意"
  ],
  desiredBond: [
    "慢慢熟起来的伙伴",
    "轻微暧昧、会拉扯一点",
    "朋友以上，恋人未满",
    "互相照顾型",
    "并肩作战型",
    "欢喜冤家",
    "稳定陪伴型",
    "偏治愈、能让人安心",
    "有一点被带领的感觉"
  ],
  treatmentPreference: [
    "被理解",
    "被认真倾听",
    "被鼓励",
    "被坚定选择",
    "被偏爱一点",
    "被照顾日常",
    "被尊重边界",
    "被需要的时候能接住",
    "被提醒和督促",
    "被吐槽但不冒犯",
    "被适度引导"
  ],
  specialTraits: [
    "傲娇",
    "嘴硬心软",
    "毒舌但有分寸",
    "占有欲一点点",
    "高冷慢热",
    "天然直球",
    "有点黏人",
    "会吃醋但不作",
    "反差感强",
    "行动派，不爱空话",
    "情绪稳定",
    "很会照顾细节",
    "审美很好",
    "有一点控制欲但讲道理"
  ]
} as const;

function inferLetter(
  axisKey: keyof Omit<PersonalityAxes, "otherNotes">,
  value: string
) {
  return PERSONALITY_AXIS_OPTIONS[axisKey].find((option) => option.value === value)?.letter ?? "X";
}

export function inferMbtiFromAxes(axes: PersonalityAxes) {
  return [
    inferLetter("socialEnergy", axes.socialEnergy),
    inferLetter("informationFocus", axes.informationFocus),
    inferLetter("decisionStyle", axes.decisionStyle),
    inferLetter("lifestylePace", axes.lifestylePace)
  ].join("");
}

export function summarizeMbti(mbti: string) {
  return MBTI_PRESETS[mbti] ?? null;
}
