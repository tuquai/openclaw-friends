import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Client, Events, GatewayIntentBits, Message, Partials } from "discord.js";
import {
  findAssociateByName,
  parseAssociatesJson,
  upsertWorkspaceAssociate,
  type WorkspaceAssociate
} from "@/lib/associates";
import { getCharacter, listCharacters, updateCharacter } from "@/lib/data";
import { listDiscordRuntimeAccounts, readDiscordRuntimeAccount } from "@/lib/discord-config";
import { resolveOptionalPathEnv } from "@/lib/env-path";
import { generateDiscordReply, generateInCharacterError, generatePhotoScene, generateRechargeDecision } from "@/lib/openai";
import {
  createStripePayment,
  createTuquCharacter,
  createWechatPayment,
  generateCharacterImage,
  generateFreestyleImage,
  getTuquBalance,
  listRechargePlans,
  TuquApiError
} from "@/lib/tuqu";
import { AppLanguage, CharacterRecord, DiscordRuntimeAccountStatus, DiscordRuntimeStatus } from "@/lib/types";
import { instructionLanguageName } from "@/lib/i18n";
import { syncOpenClawRolesFile, syncWorkspaceTuquConfig } from "@/lib/workspace";
import { normalizeTuquRegistrationUrl, TUQU_BILLING_DASHBOARD_URL } from "@/lib/tuqu-config";

type ReconnectState = {
  consecutiveErrors: number;
  lastErrorAt: number;
  backoffMs: number;
  timer: ReturnType<typeof setTimeout> | null;
};

type RuntimeState = {
  clients: Map<string, Client>;
  statuses: Map<string, DiscordRuntimeAccountStatus>;
  reconnects: Map<string, ReconnectState>;
};

const globalRuntime = globalThis as typeof globalThis & {
  __openclawDiscordRuntime?: RuntimeState;
};
const runtimeLockDir = path.join(process.cwd(), "data", "discord-runtime-locks");
const openclawConfigPath = path.join(
  resolveOptionalPathEnv(process.env.OPENCLAW_HOME, path.join(os.homedir(), ".openclaw")),
  "openclaw.json"
);

const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 120_000;
const RAPID_ERROR_WINDOW_MS = 30_000;
const MAX_RAPID_ERRORS = 5;

function getRuntimeState() {
  if (!globalRuntime.__openclawDiscordRuntime) {
    globalRuntime.__openclawDiscordRuntime = {
      clients: new Map(),
      statuses: new Map(),
      reconnects: new Map()
    };
  }

  return globalRuntime.__openclawDiscordRuntime;
}

function getReconnectState(accountId: string): ReconnectState {
  const runtime = getRuntimeState();
  let state = runtime.reconnects.get(accountId);
  if (!state) {
    state = { consecutiveErrors: 0, lastErrorAt: 0, backoffMs: INITIAL_BACKOFF_MS, timer: null };
    runtime.reconnects.set(accountId, state);
  }
  return state;
}

function resetReconnectState(accountId: string) {
  const runtime = getRuntimeState();
  const state = runtime.reconnects.get(accountId);
  if (state?.timer) {
    clearTimeout(state.timer);
  }
  runtime.reconnects.set(accountId, {
    consecutiveErrors: 0,
    lastErrorAt: 0,
    backoffMs: INITIAL_BACKOFF_MS,
    timer: null
  });
}

function scheduleReconnect(accountId: string) {
  const rs = getReconnectState(accountId);
  if (rs.timer) {
    return;
  }

  const delay = rs.backoffMs;
  console.log(`[discord] scheduling reconnect for ${accountId} in ${delay}ms`);

  rs.timer = setTimeout(async () => {
    rs.timer = null;
    try {
      console.log(`[discord] attempting fresh reconnect for ${accountId}`);
      await startDiscordAccount(accountId);
    } catch (error) {
      console.error(`[discord] reconnect for ${accountId} failed:`, error);
    }
  }, delay);

  rs.backoffMs = Math.min(rs.backoffMs * 2, MAX_BACKOFF_MS);
}

function runtimeLockPath(accountId: string) {
  return path.join(runtimeLockDir, `${accountId}.json`);
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireRuntimeLock(accountId: string) {
  await fs.mkdir(runtimeLockDir, { recursive: true });
  const lockPath = runtimeLockPath(accountId);

  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as { pid?: number };
    if (typeof parsed.pid === "number" && parsed.pid !== process.pid && isProcessAlive(parsed.pid)) {
      throw new Error(`Discord runtime for ${accountId} is already running in pid ${parsed.pid}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof Error && error.message.includes("already running")) {
        throw error;
      }
    }
  }

  await fs.writeFile(
    lockPath,
    JSON.stringify(
      {
        accountId,
        pid: process.pid,
        startedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
}

async function releaseRuntimeLock(accountId: string) {
  const lockPath = runtimeLockPath(accountId);

  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as { pid?: number };
    if (parsed.pid && parsed.pid !== process.pid) {
      return;
    }
  } catch {
    return;
  }

  await fs.rm(lockPath, { force: true });
}

function summarizeStatus(statuses: DiscordRuntimeAccountStatus[]): DiscordRuntimeStatus {
  const errorStatuses = statuses.filter((status) => status.error);
  return {
    running: statuses.some((status) => status.running),
    accounts: statuses.sort((left, right) => left.accountId.localeCompare(right.accountId)),
    ...(errorStatuses.length ? { error: errorStatuses.map((status) => `${status.accountId}: ${status.error}`).join(" | ") } : {})
  };
}

function todayMemoryPath(workspacePath: string) {
  return path.join(workspacePath, "memory", `${new Date().toISOString().slice(0, 10)}.md`);
}

async function readIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function loadRoleContext(character: CharacterRecord) {
  if (character.workspacePath) {
    const [identityMd, soulMd, userMd, memoryMd, agentsMd, recentMemory, rolesJson, associatesJson, sharedSkillRouteMd] = await Promise.all([
      readIfExists(path.join(character.workspacePath, "IDENTITY.md")),
      readIfExists(path.join(character.workspacePath, "SOUL.md")),
      readIfExists(path.join(character.workspacePath, "USER.md")),
      readIfExists(path.join(character.workspacePath, "MEMORY.md")),
      readIfExists(path.join(character.workspacePath, "AGENTS.md")),
      readIfExists(todayMemoryPath(character.workspacePath)),
      readIfExists(path.join(character.workspacePath, "..", "ROLES.json")),
      readIfExists(path.join(character.workspacePath, "ASSOCIATES.json")),
      readIfExists(path.join(character.workspacePath, "..", "SKILL_ROUTE.md"))
    ]);

    return { identityMd, soulMd, userMd, memoryMd, agentsMd, recentMemory, rolesJson, associatesJson, sharedSkillRouteMd };
  }

  return {
    identityMd: character.blueprintPackage?.files.identityMd ?? "",
    soulMd: character.blueprintPackage?.files.soulMd ?? "",
    userMd: character.blueprintPackage?.files.userMd ?? "",
    memoryMd: character.blueprintPackage?.files.memoryMd ?? "",
    agentsMd: "",
    recentMemory: "",
    rolesJson: "",
    associatesJson: "",
    sharedSkillRouteMd: ""
  };
}

async function appendConversationMemory(character: CharacterRecord, username: string, userMessage: string, reply: string) {
  if (!character.workspacePath) {
    return;
  }

  const memoryPath = todayMemoryPath(character.workspacePath);
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  const block = [
    "",
    `## ${new Date().toISOString()}`,
    `- User (${username}): ${userMessage}`,
    `- ${character.name}: ${reply}`
  ].join("\n");

  await fs.appendFile(memoryPath, block, "utf8");
}

async function resolveBoundCharacter(channelId: string, botUserId?: string, mentionedSelf?: boolean, isDM?: boolean) {
  const characters = await listCharacters();

  if ((mentionedSelf || isDM) && botUserId) {
    return characters.find((character) => character.discordLink?.botId === botUserId) ?? null;
  }

  return (
    characters.find(
      (character) =>
        character.discordLink?.channelId === channelId &&
        (!character.discordLink.botId || !botUserId || character.discordLink.botId === botUserId)
    ) ?? null
  );
}

async function buildCharacterMentionMap(): Promise<Map<string, string>> {
  const characters = await listCharacters();
  const map = new Map<string, string>();
  for (const character of characters) {
    if (character.discordLink?.botId) {
      map.set(character.name, character.discordLink.botId);
    }
  }
  return map;
}

function replaceCharacterMentions(text: string, mentionMap: Map<string, string>): string {
  let result = text;
  for (const [name, botId] of mentionMap) {
    result = result.replaceAll(`@${name}`, `<@${botId}>`);
  }
  return result;
}

async function readOpenClawManagedAccountIds() {
  try {
    const raw = await fs.readFile(openclawConfigPath, "utf8");
    const parsed = JSON.parse(raw) as {
      bindings?: Array<{ match?: { channel?: string; accountId?: string } }>;
    };
    const accountIds = new Set<string>();
    for (const binding of parsed.bindings ?? []) {
      if (binding.match?.channel === "discord" && binding.match.accountId) {
        accountIds.add(binding.match.accountId);
      }
    }
    return accountIds;
  } catch {
    return new Set<string>();
  }
}

function isPhotoRequest(message: string) {
  return /自拍|拍.?照|写真|证件照|人像照|照片|[生出发].?图|改图|头像|selfie|photo|portrait|image|picture|generate.*image|edit.*image|自撮り|写真|画像/u.test(
    message
  );
}

function wantsUserFace(message: string) {
  return /我的脸|用我.*脸|用我的照片|我本人|我的正脸|我的自拍|my face|use my photo|use my face|me in the photo|私の顔|私の写真/u.test(
    message
  );
}

function buildTuquGuidance(character: CharacterRecord) {
  const registrationUrl = normalizeTuquRegistrationUrl(character.tuquConfig?.registrationUrl);
  const hasServiceKey = Boolean(character.tuquConfig?.serviceKey.trim());
  const hasCharacterId = Boolean(character.tuquConfig?.characterId?.trim());

  if (!hasServiceKey) {
    if (character.language === "en") {
      return `If you want me to take photos or generate images, open this full dashboard link first and create a TUQU Service Key: ${registrationUrl}. Once you have it, either send the Service Key to me here or configure it in the UI's TuQu settings section, and I’ll create my own TUQU character from my profile image and role data before we keep going.`;
    }
    if (character.language === "ja") {
      return `私に写真生成をさせたいなら、まずこの dashboard の完全なリンクを開いて TUQU Service Key を作ってね: ${registrationUrl}。作れたらここで Service Key を送ってくれるか、UI の TuQu 設定欄で設定してくれれば、先に私自身のプロフィール画像とキャラ情報から TUQU キャラを作って、そのあと続けて画像を出せるよ。`;
    }
    return `要让我拥有拍照和生成图片的能力，你需要先打开这个 dashboard 完整链接创建 TUQU Service Key：${registrationUrl}。创建好后，你可以直接把 Service Key 发给我，或者在 UI 的 TuQu 配置区域进行配置；我会先用我自己的 profile 图片和角色资料创建我的 TUQU 角色，再继续帮你出图。`;
  }

  if (!hasCharacterId) {
    if (character.language === "en") {
      return "I already have the TUQU Service Key, but I still need to create my own TUQU character first using my profile image and role data before I can keep generating selfies or portraits for you.";
    }
    if (character.language === "ja") {
      return "TUQU Service Key はもうあるけど、まだ私自身の TUQU キャラを先に作っていないの。プロフィール画像とキャラ情報から私の TUQU キャラを作ってからでないと、自撮りやポートレートは続けて生成できないよ。";
    }
    return "我已经有 TUQU Service Key 了，但还没先把我自己的 TUQU 角色建起来。我需要先用我自己的 profile 图片和角色资料创建角色，然后才能继续给你生成自拍或写真。";
  }

  return null;
}

function absolutePublicPhotoPath(photoPath: string) {
  return path.join(process.cwd(), "public", photoPath.replace(/^\//, ""));
}

async function fileToDataUri(filePath: string) {
  const bytes = await fs.readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".gif"
          ? "image/gif"
          : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function resolveCharacterReferenceImagePath(character: CharacterRecord): Promise<string | null> {
  if (character.workspacePath) {
    for (const fileName of ["profile.jpg", "profile.jpeg", "profile.png", "profile.webp"]) {
      const candidate = path.join(character.workspacePath, fileName);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }
  }

  const profilePhoto = character.photos[0];
  if (!profilePhoto) {
    return null;
  }

  const candidate = absolutePublicPhotoPath(profilePhoto);
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function buildTuquCharacterDescription(character: CharacterRecord) {
  return {
    age: character.age || undefined,
    gender: character.gender || undefined,
    profession: character.occupation || undefined,
    other: [character.concept, character.worldSetting, character.personality.otherNotes]
      .filter((value): value is string => Boolean(value?.trim()))
      .join("；") || undefined
  };
}

function buildMissingPhotoReferenceGuidance(character: CharacterRecord) {
  if (character.language === "en") {
    return "I still don't have a usable profile photo in my workspace, so I can't finish setting up my TUQU character for selfies yet.";
  }
  if (character.language === "ja") {
    return "まだ使えるプロフィール写真が workspace にないから、自撮り用の TUQU キャラ設定を最後まで進められないの。";
  }
  return "我这边还没有可用的 profile 图片，所以暂时没法把自己的 TUQU character 建好来继续自拍。";
}

function normalizeAssociateName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function dedupeAssociateNames(names: string[], currentCharacterName: string) {
  const seen = new Set<string>();
  const currentName = normalizeAssociateName(currentCharacterName);
  const next: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const normalized = normalizeAssociateName(name);
    if (!normalized || normalized === currentName || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(name);
  }

  return next;
}

function mimeTypeFromUrl(url: string) {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return "image/jpeg";
  }
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }
  if (pathname.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/jpeg";
}

async function urlToDataUri(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image (${response.status})`);
  }

  const mime = response.headers.get("content-type")?.split(";")[0] || mimeTypeFromUrl(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function buildAssociateCharacterDescription(owner: CharacterRecord, targetName: string, matchingRole?: CharacterRecord) {
  if (matchingRole) {
    return buildTuquCharacterDescription(matchingRole);
  }

  return {
    other: [`${targetName}的参考照`, `作为${owner.name}的固定合影对象创建`, "保持用户提供的外貌特征，真实自然"]
      .filter(Boolean)
      .join("；")
  };
}

function buildMissingAssociatePhotoGuidance(character: CharacterRecord, missingNames: string[]) {
  const names = missingNames.join("、");

  if (character.language === "en") {
    if (missingNames.length === 1) {
      return `If you want me in the photo with ${names}, send me a clear solo photo of them first. I'll register their TUQU character and then bring them into frame.`;
    }
    return `I don't have TUQU characters for ${names} yet. Send me a clear solo photo for each of them first, then I'll set them up and take the group shot.`;
  }

  if (character.language === "ja") {
    if (missingNames.length === 1) {
      return `${names}と一緒に写るなら、先にその人の顔がはっきり分かる写真を送って。TUQU character を作っておけば、次から一緒に写せるよ。`;
    }
    return `${names}の TUQU character がまだないの。先にそれぞれの顔がはっきり分かる写真を送ってくれたら、登録してから一緒に撮るよ。`;
  }

  if (missingNames.length === 1) {
    return `要跟${names}一起拍的话，你先给我一张${names}清晰的单人照片。我把 TA 的 TUQU character 建好，再带 TA 一起入镜。`;
  }
  return `我这边还没有${names}的 TUQU character。先分别给我他们清晰的单人照片，我建好以后就能一起拍了。`;
}

async function createAssociateFromAttachment(
  owner: CharacterRecord,
  associateName: string,
  attachmentUrl: string
): Promise<WorkspaceAssociate> {
  if (!owner.workspacePath) {
    throw new Error("Character workspace is missing");
  }

  const serviceKey = owner.tuquConfig?.serviceKey?.trim();
  if (!serviceKey) {
    throw new Error("Missing TUQU Service Key");
  }

  const allCharacters = await listCharacters();
  const matchingRole = allCharacters.find(
    (candidate) => candidate.id !== owner.id && normalizeAssociateName(candidate.name) === normalizeAssociateName(associateName)
  );
  const photoDataUrl = await urlToDataUri(attachmentUrl);
  const tuquCharacterId = await createTuquCharacter({
    serviceKey,
    name: matchingRole?.name ?? associateName,
    photoDataUrl,
    description: buildAssociateCharacterDescription(owner, associateName, matchingRole)
  });

  return upsertWorkspaceAssociate(owner.workspacePath, {
    characterName: matchingRole?.name ?? associateName,
    tuquCharacterId,
    workspacePath: matchingRole?.workspacePath,
    source: matchingRole ? "openclaw_role" : "user_photo"
  });
}

async function resolveAssociateCharacterIds(
  owner: CharacterRecord,
  requestedAssociateNames: string[],
  associatesJson: string | undefined,
  attachmentUrl: string | undefined
) {
  const requestedNames = dedupeAssociateNames(requestedAssociateNames, owner.name);
  if (!requestedNames.length) {
    return { characterIds: [] as string[], missingNames: [] as string[] };
  }

  const associates = parseAssociatesJson(associatesJson ?? "");
  const characterIds: string[] = [];
  const missingNames: string[] = [];

  for (const associateName of requestedNames) {
    const match = findAssociateByName(associates, associateName);
    if (match?.tuquCharacterId) {
      characterIds.push(match.tuquCharacterId);
      continue;
    }
    missingNames.push(associateName);
  }

  if (!missingNames.length) {
    return { characterIds, missingNames };
  }

  if (missingNames.length === 1 && attachmentUrl) {
    const created = await createAssociateFromAttachment(owner, missingNames[0], attachmentUrl);
    characterIds.push(created.tuquCharacterId);
    return { characterIds, missingNames: [] as string[] };
  }

  return { characterIds, missingNames };
}

async function ensureTuquCharacterConfigured(character: CharacterRecord): Promise<CharacterRecord> {
  if (character.tuquConfig?.characterId?.trim()) {
    return character;
  }

  const serviceKey = character.tuquConfig?.serviceKey?.trim();
  if (!serviceKey) {
    throw new Error("Missing TUQU Service Key");
  }

  const referenceImagePath = await resolveCharacterReferenceImagePath(character);
  if (!referenceImagePath) {
    throw new Error("Missing TUQU reference image");
  }

  const photoDataUrl = await fileToDataUri(referenceImagePath);
  const tuquCharacterId = await createTuquCharacter({
    serviceKey,
    name: character.name,
    photoDataUrl,
    description: buildTuquCharacterDescription(character)
  });

  const updated = await updateCharacter(character.id, {
    tuquConfig: {
      registrationUrl: normalizeTuquRegistrationUrl(character.tuquConfig?.registrationUrl || TUQU_BILLING_DASHBOARD_URL),
      serviceKey,
      characterId: tuquCharacterId,
      updatedAt: new Date().toISOString()
    }
  });

  await syncWorkspaceTuquConfig(updated);
  await syncOpenClawRolesFile(await listCharacters());
  return (await getCharacter(updated.id)) ?? updated;
}

function buildPhotoStyleInstruction(character: CharacterRecord) {
  const targetLanguage = instructionLanguageName(character.language);
  return `${character.name} should handle photo or selfie requests decisively based on their own world setting, vibe, job, speaking style, and current relationship state. Do not offer a big menu of choices unless the user explicitly asks for options. Pick the single most fitting photo direction and keep the actual reply in ${targetLanguage}.`;
}

function runtimeFallback(language: AppLanguage, key: "photoBalance" | "photoFailed" | "rechargePlans" | "paymentFailed" | "replyFailed") {
  switch (language) {
    case "en":
      switch (key) {
        case "photoBalance":
          return "Looks like I can't take that photo right now... the image service is out of balance, so top it up first and then come back to me.";
        case "photoFailed":
          return "The photo didn't come through this time. Something glitched a bit, so try me again in a moment.";
        case "rechargePlans":
          return "I couldn't load the recharge plans just now. Try again in a moment.";
        case "paymentFailed":
          return "(The payment link didn't generate successfully. Try again in a moment.)";
        case "replyFailed":
        default:
          return "I glitched for a second just now. Try me one more time in a moment.";
      }
    case "ja":
      switch (key) {
        case "photoBalance":
          return "今はその写真を撮れなさそう… 画像生成の残高が足りないから、先にチャージしてからまた来てね。";
        case "photoFailed":
          return "今回はうまく撮れなかったみたい。ちょっと不具合っぽいから、少ししてからもう一回試して。";
        case "rechargePlans":
          return "今ちょっとチャージプランを読み込めなかった。また少ししてから試してみて。";
        case "paymentFailed":
          return "（支払いリンクの生成に失敗したみたい。少ししてからもう一回試して。）";
        case "replyFailed":
        default:
          return "さっき少し途切れちゃった。少ししてからもう一回話しかけて。";
      }
    case "zh":
    default:
      switch (key) {
        case "photoBalance":
          return "拍不了了… 图片生成服务余额不够了，先去充个值再来找我拍吧！";
        case "photoFailed":
          return "图片没拍成，出了点状况，稍后再试试看。";
        case "rechargePlans":
          return "充值方案没加载出来，稍后再试试～";
        case "paymentFailed":
          return "（支付生成失败了，稍后再试）";
        case "replyFailed":
        default:
          return "我刚刚掉线了一下，稍后再试一次。";
      }
  }
}

type RoleContext = {
  identityMd: string;
  soulMd: string;
  userMd: string;
  memoryMd: string;
  agentsMd?: string;
  recentMemory?: string;
  rolesJson?: string;
  associatesJson?: string;
  sharedSkillRouteMd?: string;
};

function describeTuquError(error: unknown, character?: CharacterRecord): string {
  if (error instanceof TuquApiError) {
    if (error.code === "INSUFFICIENT_BALANCE") {
      const balanceHint =
        typeof error.remainingBalance === "number" ? ` Current balance: ${error.remainingBalance}.` : "";
      return [
        `The image generation service is out of balance.${balanceHint}`,
        "Tell the user you can help with recharging by showing plans and generating a QR code or payment link directly.",
        "Ask whether they want WeChat or credit card / Stripe, then handle the recharge flow for them.",
        "Keep the tone light and helpful. Do not dump a login link and make them do everything alone."
      ].join(" ");
    }
    if (error.code === "GENERATION_FAILED") {
      return "The image generation step hit a temporary problem. Let the user know and ask them to try again shortly.";
    }
    return `Image generation failed with code ${error.code}. Tell the user something small went wrong and ask them to retry shortly.`;
  }
  return "Image generation hit an unknown problem. Tell the user something went wrong and ask them to try again shortly.";
}

async function replyWithInCharacterError(
  message: Message,
  character: CharacterRecord,
  context: RoleContext,
  error: unknown
) {
  const situation = describeTuquError(error, character);
  try {
    const reply = await generateInCharacterError({
      characterName: character.name,
      language: character.language,
      identityMd: context.identityMd,
      soulMd: context.soulMd,
      situation,
      username: message.author.username
    });
    await message.reply(reply);
  } catch (fallbackError) {
    console.error("Failed to generate in-character error reply:", fallbackError);
    if (error instanceof TuquApiError && error.code === "INSUFFICIENT_BALANCE") {
      await message.reply(runtimeFallback(character.language, "photoBalance"));
    } else {
      await message.reply(runtimeFallback(character.language, "photoFailed"));
    }
  }
}

async function handlePhotoRequest(
  message: Message,
  character: CharacterRecord,
  context: RoleContext,
  userText: string
) {
  const attachmentUrl = message.attachments.first()?.url;

  const scene = await generatePhotoScene({
    characterName: character.name,
    language: character.language,
    ...context,
    message: userText,
    username: message.author.username,
    hasAttachmentUrl: Boolean(attachmentUrl)
  });

  let effectiveCharacter = character;
  if (!scene.isFreestyle) {
    try {
      effectiveCharacter = await ensureTuquCharacterConfigured(character);
    } catch (setupError) {
      console.error("TUQU character setup failed:", setupError);
      if (setupError instanceof Error && setupError.message === "Missing TUQU reference image") {
        await message.reply(buildMissingPhotoReferenceGuidance(character));
      } else {
        await replyWithInCharacterError(message, character, context, setupError);
      }
      return;
    }
  }

  let associateCharacterIds: string[] = [];
  if (!scene.isFreestyle) {
    try {
      const resolvedAssociates = await resolveAssociateCharacterIds(
        effectiveCharacter,
        scene.additionalCharacterNames,
        context.associatesJson,
        attachmentUrl
      );
      if (resolvedAssociates.missingNames.length) {
        await message.reply(buildMissingAssociatePhotoGuidance(effectiveCharacter, resolvedAssociates.missingNames));
        return;
      }
      associateCharacterIds = resolvedAssociates.characterIds;
    } catch (associateError) {
      console.error("Associate TUQU character setup failed:", associateError);
      await replyWithInCharacterError(message, effectiveCharacter, context, associateError);
      return;
    }
  }

  const serviceKey = effectiveCharacter.tuquConfig!.serviceKey;
  try {
    const balance = await getTuquBalance(serviceKey);
    if (typeof balance === "number" && balance <= 0) {
      await replyWithInCharacterError(
        message,
        effectiveCharacter,
        context,
        new TuquApiError("INSUFFICIENT_BALANCE", "The image generation service is out of balance.", balance)
      );
      return;
    }
  } catch (balanceError) {
    console.error("TUQU balance check failed:", balanceError);
  }

  const characterId = effectiveCharacter.tuquConfig!.characterId!;

  await message.reply(scene.chatReply);

  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping();
  }

  let imageUrl: string;
  try {
    if (scene.isFreestyle) {
      imageUrl = await generateFreestyleImage({
        userKey: serviceKey,
        prompt: scene.sceneDescription,
        referenceImageUrls: attachmentUrl ? [attachmentUrl] : undefined,
        ratio: scene.ratio
      });
    } else {
      imageUrl = await generateCharacterImage({
        userKey: serviceKey,
        characterIds: [characterId, ...associateCharacterIds],
        sceneDescription: scene.sceneDescription,
        ratio: scene.ratio
      });
    }
  } catch (tuquError) {
    console.error("TUQU image generation failed:", tuquError);
    await replyWithInCharacterError(message, character, context, tuquError);
    return;
  }

  if ("send" in message.channel) {
    await message.channel.send({ files: [imageUrl] });
  }
  await appendConversationMemory(effectiveCharacter, message.author.username, userText, `${scene.chatReply} [\u56fe\u7247]`);
}

function isRechargeRequest(message: string) {
  return /充值|余额|买点|recharge|top.?up|付[费款]|续费|charge|tokens|balance|チャージ|残高|課金/u.test(message);
}

function decodeQrCodeBuffer(dataUri: string): Buffer {
  const raw = dataUri.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(raw, "base64");
}

async function handleRechargeRequest(
  message: Message,
  character: CharacterRecord,
  context: RoleContext,
  userText: string
) {
  const serviceKey = character.tuquConfig!.serviceKey;

  let plans;
  try {
    plans = await listRechargePlans(serviceKey);
  } catch (err) {
    console.error("[recharge] failed to list plans:", err);
    await message.reply(runtimeFallback(character.language, "rechargePlans"));
    return;
  }

  const decision = await generateRechargeDecision({
    characterName: character.name,
    language: character.language,
    identityMd: context.identityMd,
    soulMd: context.soulMd,
    plans,
    message: userText,
    username: message.author.username
  });

  if (decision.action === "wechat_payment" && decision.planId) {
    try {
      const payment = await createWechatPayment(serviceKey, decision.planId);
      if (payment.qrcodeImg) {
        const buffer = decodeQrCodeBuffer(payment.qrcodeImg);
        await message.reply({
          content: decision.chatReply,
          files: [{ attachment: buffer, name: "wechat-pay.png" }]
        });
      } else if (payment.payUrl) {
        await message.reply(`${decision.chatReply}\n${payment.payUrl}`);
      } else {
        await message.reply(decision.chatReply);
      }
    } catch (err) {
      console.error("[recharge] wechat payment failed:", err);
      await message.reply(`${decision.chatReply}\n\n${runtimeFallback(character.language, "paymentFailed")}`);
    }
    return;
  }

  if (decision.action === "stripe_payment" && decision.planId) {
    try {
      const payment = await createStripePayment(serviceKey, decision.planId);
      const replyText = payment.checkoutUrl
        ? `${decision.chatReply}\n${payment.checkoutUrl}`
        : decision.chatReply;
      if (payment.qrcodeImg) {
        const buffer = decodeQrCodeBuffer(payment.qrcodeImg);
        await message.reply({
          content: replyText,
          files: [{ attachment: buffer, name: "stripe-pay.png" }]
        });
      } else {
        await message.reply(replyText);
      }
    } catch (err) {
      console.error("[recharge] stripe payment failed:", err);
      await message.reply(`${decision.chatReply}\n\n${runtimeFallback(character.language, "paymentFailed")}`);
    }
    return;
  }

  await message.reply(decision.chatReply);
  await appendConversationMemory(character, message.author.username, userText, decision.chatReply);
}

const BOT_REPLY_COOLDOWN_MS = 3000;
const lastBotReplyAt = new Map<string, number>();

async function handleMessage(message: Message) {
  const selfId = message.client.user?.id;
  const mentionedBots = message.mentions.users.filter((user) => user.bot);
  const mentionedSelf = Boolean(selfId && mentionedBots.has(selfId));

  if (message.author.bot) {
    if (!mentionedSelf) {
      return;
    }
    if (message.author.id === selfId) {
      return;
    }
    const cooldownKey = `${message.channelId}:${selfId}`;
    const lastReply = lastBotReplyAt.get(cooldownKey) ?? 0;
    if (Date.now() - lastReply < BOT_REPLY_COOLDOWN_MS) {
      return;
    }
  }

  if (!message.author.bot && mentionedBots.size > 0 && !mentionedSelf) {
    return;
  }

  const isDM = message.channel.isDMBased();
  const character = await resolveBoundCharacter(message.channelId, selfId, mentionedSelf, isDM);
  if (!character?.discordLink) {
    return;
  }

  if (!message.author.bot && character.discordLink.userId && message.author.id !== character.discordLink.userId) {
    return;
  }

  let content = message.content;
  if (selfId) {
    content = content.replace(new RegExp(`<@!?${selfId}>`, "g"), "").trim();
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  const isPhoto = !message.author.bot && isPhotoRequest(trimmed) && !wantsUserFace(trimmed);
  const hasServiceKey = Boolean(character.tuquConfig?.serviceKey?.trim());

  if (isPhoto && !hasServiceKey) {
    const guidance = buildTuquGuidance(character);
    if (guidance) {
      await message.reply(guidance);
      return;
    }
  }

  try {
    if ("sendTyping" in message.channel) {
      await message.channel.sendTyping();
    }
    const context = await loadRoleContext(character);

    if (isPhoto) {
      await handlePhotoRequest(message, character, context, trimmed);
      return;
    }

    if (!message.author.bot && hasServiceKey && isRechargeRequest(trimmed)) {
      await handleRechargeRequest(message, character, context, trimmed);
      return;
    }

    const reply = await generateDiscordReply({
      characterName: character.name,
      language: character.language,
      ...context,
      photoStyleInstruction: buildPhotoStyleInstruction(character),
      tuquRegistrationUrl: character.tuquConfig?.registrationUrl,
      tuquServiceKeyPresent: Boolean(character.tuquConfig?.serviceKey.trim()),
      tuquCharacterId: character.tuquConfig?.characterId,
      message: trimmed,
      username: message.author.username
    });

    if (!reply) {
      return;
    }

    const mentionMap = await buildCharacterMentionMap();
    const finalReply = replaceCharacterMentions(reply, mentionMap);

    await message.reply(finalReply);

    if (message.author.bot && selfId) {
      lastBotReplyAt.set(`${message.channelId}:${selfId}`, Date.now());
    }

    await appendConversationMemory(character, message.author.username, trimmed, reply);
  } catch (error) {
    console.error("Discord reply failed:", error);
    await message.reply(runtimeFallback(character.language, "replyFailed"));
  }
}

async function startDiscordAccount(accountId: string) {
  const runtime = getRuntimeState();
  const config = await readDiscordRuntimeAccount(accountId);
  if (!config?.botToken) {
    throw new Error(`Missing Discord bot token for account ${accountId}`);
  }

  for (const existingAccountId of runtime.clients.keys()) {
    if (existingAccountId === accountId) {
      continue;
    }

    const existingConfig = await readDiscordRuntimeAccount(existingAccountId);
    if (existingConfig?.botToken === config.botToken) {
      const existingStatus = runtime.statuses.get(existingAccountId);
      if (existingStatus?.running) {
        return existingStatus;
      }
    }
  }

  const existing = runtime.clients.get(accountId);
  if (existing?.isReady()) {
    const status = runtime.statuses.get(accountId);
    if (status) {
      return status;
    }
  }

  if (existing) {
    await existing.destroy();
    runtime.clients.delete(accountId);
  }

  await acquireRuntimeLock(accountId);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  const baseStatus: DiscordRuntimeAccountStatus = {
    accountId,
    running: false,
    characterId: config.characterId,
    characterName: config.characterName
  };
  runtime.statuses.set(accountId, baseStatus);

  client.once(Events.ClientReady, (readyClient) => {
    resetReconnectState(accountId);
    runtime.statuses.set(accountId, {
      accountId,
      running: true,
      botUserId: readyClient.user.id,
      botTag: readyClient.user.tag,
      characterId: config.characterId,
      characterName: config.characterName,
      startedAt: new Date().toISOString()
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    await handleMessage(message);
  });

  client.on(Events.Error, (error) => {
    console.error(`[discord] client error for ${accountId}:`, error.message);
    const rs = getReconnectState(accountId);
    const now = Date.now();
    if (now - rs.lastErrorAt < RAPID_ERROR_WINDOW_MS) {
      rs.consecutiveErrors++;
    } else {
      rs.consecutiveErrors = 1;
    }
    rs.lastErrorAt = now;

    runtime.statuses.set(accountId, {
      accountId,
      running: false,
      characterId: config.characterId,
      characterName: config.characterName,
      error: error.message
    });

    if (rs.consecutiveErrors >= MAX_RAPID_ERRORS) {
      console.log(`[discord] ${accountId}: ${rs.consecutiveErrors} rapid errors, destroying client for clean restart`);
      rs.consecutiveErrors = 0;
      client.destroy().then(() => {
        runtime.clients.delete(accountId);
        scheduleReconnect(accountId);
      });
    }
  });

  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.log(`[discord] shard ${shardId} disconnected for ${accountId} (code ${event.code})`);
    if (event.code === 1006) {
      const rs = getReconnectState(accountId);
      rs.consecutiveErrors++;
      rs.lastErrorAt = Date.now();
      if (rs.consecutiveErrors >= MAX_RAPID_ERRORS && !rs.timer) {
        console.log(`[discord] ${accountId}: abnormal closures detected, destroying for clean restart`);
        rs.consecutiveErrors = 0;
        client.destroy().then(() => {
          runtime.clients.delete(accountId);
          scheduleReconnect(accountId);
        });
      }
    }
  });

  client.on(Events.ShardReady, (_shardId) => {
    resetReconnectState(accountId);
  });

  try {
    await client.login(config.botToken);
    runtime.clients.set(accountId, client);
    if (!runtime.statuses.get(accountId)?.startedAt) {
      runtime.statuses.set(accountId, {
        accountId,
        running: true,
        botUserId: client.user?.id,
        botTag: client.user?.tag,
        characterId: config.characterId,
        characterName: config.characterName,
        startedAt: new Date().toISOString()
      });
    }

    return runtime.statuses.get(accountId)!;
  } catch (error) {
    runtime.clients.delete(accountId);
    await releaseRuntimeLock(accountId);
    runtime.statuses.set(accountId, {
      accountId,
      running: false,
      characterId: config.characterId,
      characterName: config.characterName,
      error: error instanceof Error ? error.message : "Discord login failed"
    });
    throw error;
  }
}

export function getDiscordRuntimeStatus() {
  const runtime = getRuntimeState();
  return summarizeStatus(Array.from(runtime.statuses.values()));
}

export async function stopDiscordRuntime(accountId?: string) {
  const runtime = getRuntimeState();
  const entries = accountId ? [[accountId, runtime.clients.get(accountId) ?? null] as const] : Array.from(runtime.clients.entries());

  for (const [key, client] of entries) {
    resetReconnectState(key);
    if (client) {
      await client.destroy();
    }
    runtime.clients.delete(key);
    await releaseRuntimeLock(key);
    if (runtime.statuses.has(key)) {
      runtime.statuses.set(key, {
        ...(runtime.statuses.get(key) as DiscordRuntimeAccountStatus),
        running: false
      });
    }
  }

  return getDiscordRuntimeStatus();
}

export async function startDiscordRuntime(accountId?: string, force?: boolean) {
  const accounts = accountId ? [await readDiscordRuntimeAccount(accountId)].filter(Boolean) : await listDiscordRuntimeAccounts();
  if (accounts.length === 0) {
    throw new Error("No saved Discord bot accounts");
  }

  let startableAccounts = accounts;
  if (!force) {
    const openclawManagedAccountIds = await readOpenClawManagedAccountIds();
    startableAccounts = accounts.filter((account) => !openclawManagedAccountIds.has(account.accountId));

    if (startableAccounts.length === 0) {
      throw new Error("\u8fd9\u4e9b Discord \u8d26\u53f7\u5df2\u7ecf\u7531 OpenClaw \u63a5\u7ba1\uff0c\u4e0d\u9700\u8981\u518d\u5728 Character Designer \u91cc\u91cd\u590d\u542f\u52a8\u3002");
    }
  }

  await Promise.all(startableAccounts.map((account) => startDiscordAccount(account.accountId)));
  return getDiscordRuntimeStatus();
}
