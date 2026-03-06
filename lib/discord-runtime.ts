import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Client, Events, GatewayIntentBits, Message, Partials } from "discord.js";
import { listCharacters } from "@/lib/data";
import { listDiscordRuntimeAccounts, readDiscordRuntimeAccount } from "@/lib/discord-config";
import { generateDiscordReply, generateInCharacterError, generatePhotoScene, generateRechargeDecision } from "@/lib/openai";
import { generateCharacterImage, generateFreestyleImage, TuquApiError, listRechargePlans, createWechatPayment, createStripePayment } from "@/lib/tuqu";
import { CharacterRecord, DiscordRuntimeAccountStatus, DiscordRuntimeStatus } from "@/lib/types";

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
const openclawConfigPath = path.join(process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw"), "openclaw.json");

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
    const [identityMd, soulMd, userMd, memoryMd, agentsMd, recentMemory] = await Promise.all([
      readIfExists(path.join(character.workspacePath, "IDENTITY.md")),
      readIfExists(path.join(character.workspacePath, "SOUL.md")),
      readIfExists(path.join(character.workspacePath, "USER.md")),
      readIfExists(path.join(character.workspacePath, "MEMORY.md")),
      readIfExists(path.join(character.workspacePath, "AGENTS.md")),
      readIfExists(todayMemoryPath(character.workspacePath))
    ]);

    return { identityMd, soulMd, userMd, memoryMd, agentsMd, recentMemory };
  }

  return {
    identityMd: character.blueprintPackage?.files.identityMd ?? "",
    soulMd: character.blueprintPackage?.files.soulMd ?? "",
    userMd: character.blueprintPackage?.files.userMd ?? "",
    memoryMd: character.blueprintPackage?.files.memoryMd ?? "",
    agentsMd: "",
    recentMemory: ""
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
  return /自拍|拍.?照|写真|证件照|人像照|照片|[生出发].?图|改图|头像/u.test(message);
}

function wantsUserFace(message: string) {
  return /我的脸|用我.*脸|用我的照片|我本人|我的正脸|我的自拍/u.test(message);
}

function buildTuquGuidance(character: CharacterRecord) {
  const registrationUrl = character.tuquConfig?.registrationUrl || "https://billing.tuqu.ai/dream-weaver/login";
  const hasServiceKey = Boolean(character.tuquConfig?.serviceKey.trim());
  const hasCharacterId = Boolean(character.tuquConfig?.characterId?.trim());

  if (!hasServiceKey) {
    return `\u8981\u8ba9\u6211\u62e5\u6709\u62cd\u7167\u548c\u751f\u6210\u56fe\u7247\u7684\u80fd\u529b\uff0c\u4f60\u9700\u8981\u5148\u6253\u5f00\u8fd9\u4e2a\u5b8c\u6574\u94fe\u63a5\u6ce8\u518c\u5e76\u751f\u6210 TUQU Service Key\uff1a${registrationUrl}\u3002\u6ce8\u518c\u597d\u540e\u628a Service Key \u76f4\u63a5\u53d1\u7ed9\u6211\uff0c\u6211\u4f1a\u5148\u7528\u6211\u81ea\u5df1\u7684 profile \u56fe\u7247\u548c\u89d2\u8272\u8d44\u6599\u521b\u5efa\u6211\u7684 TUQU \u89d2\u8272\uff0c\u518d\u7ee7\u7eed\u5e2e\u4f60\u51fa\u56fe\u3002`;
  }

  if (!hasCharacterId) {
    return "\u6211\u5df2\u7ecf\u6709 TUQU Service Key \u4e86\uff0c\u4f46\u8fd8\u6ca1\u5148\u628a\u6211\u81ea\u5df1\u7684 TUQU \u89d2\u8272\u5efa\u8d77\u6765\u3002\u6211\u9700\u8981\u5148\u7528\u6211\u81ea\u5df1\u7684 profile \u56fe\u7247\u548c\u89d2\u8272\u8d44\u6599\u521b\u5efa\u89d2\u8272\uff0c\u7136\u540e\u624d\u80fd\u7ee7\u7eed\u7ed9\u4f60\u751f\u6210\u81ea\u62cd\u6216\u5199\u771f\u3002";
  }

  return null;
}

function buildPhotoStyleInstruction(character: CharacterRecord) {
  return `${character.name}\u5728\u5904\u7406\u62cd\u7167\u6216\u81ea\u62cd\u8bf7\u6c42\u65f6\uff0c\u5e94\u8be5\u76f4\u63a5\u6839\u636e\u81ea\u5df1\u7684\u4e16\u754c\u89c2\u3001\u6c14\u8d28\u3001\u804c\u4e1a\u3001\u8bf4\u8bdd\u98ce\u683c\u548c\u5f53\u524d\u5173\u7cfb\u72b6\u6001\uff0c\u63a8\u6f14\u51fa\u4e00\u5f20\u6700\u9002\u5408\u7684\u7167\u7247\uff0c\u4e0d\u8981\u4e00\u6b21\u7ed9\u7528\u6237\u5217\u51fa\u4e00\u4e32\u9009\u9879\u3001\u83dc\u5355\u6216\u98ce\u683c\u6e05\u5355\u3002\u9664\u975e\u7528\u6237\u660e\u786e\u8981\u6c42\u201c\u7ed9\u6211\u51e0\u4e2a\u9009\u9879\u201d\uff0c\u5426\u5219\u76f4\u63a5\u51b3\u5b9a\u4e00\u4e2a\u6700\u5408\u9002\u7684\u62cd\u6444\u65b9\u6848\u5373\u53ef\u3002`;
}

type RoleContext = {
  identityMd: string;
  soulMd: string;
  userMd: string;
  memoryMd: string;
  agentsMd?: string;
  recentMemory?: string;
};

function describeTuquError(error: unknown, character?: CharacterRecord): string {
  if (error instanceof TuquApiError) {
    if (error.code === "INSUFFICIENT_BALANCE") {
      const balanceHint = typeof error.remainingBalance === "number" ? `（当前余额: ${error.remainingBalance}）` : "";
      return [
        `图片生成服务余额不足${balanceHint}，需要帮用户充值才能继续生成图片。`,
        "告诉用户你可以帮忙查看充值方案并直接生成付款二维码或付款链接。",
        "问用户要用微信扫码还是信用卡（Stripe），然后你来调用充值API帮他们搞定。",
        "语气轻松友好，不要让用户觉得尴尬。不要只甩一个登录链接让用户自己去操作。"
      ].join(" ");
    }
    if (error.code === "GENERATION_FAILED") {
      return "图片生成过程出了点意外，可能是暂时性故障。让用户稍后再试一次。";
    }
    return `图片生成时遇到了问题（${error.code}）。让用户知道出了点小状况，稍后重试。`;
  }
  return "图片生成时遇到了未知问题。告诉用户出了点状况，稍后再试。";
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
      identityMd: context.identityMd,
      soulMd: context.soulMd,
      situation,
      username: message.author.username
    });
    await message.reply(reply);
  } catch (fallbackError) {
    console.error("Failed to generate in-character error reply:", fallbackError);
    if (error instanceof TuquApiError && error.code === "INSUFFICIENT_BALANCE") {
      await message.reply("\u62cd\u4e0d\u4e86\u4e86\u2026\u56fe\u7247\u751f\u6210\u670d\u52a1\u4f59\u989d\u4e0d\u591f\u4e86\uff0c\u5148\u53bb\u5145\u4e2a\u503c\u518d\u6765\u627e\u6211\u62cd\u5427\uff01");
    } else {
      await message.reply("\u56fe\u7247\u6ca1\u62cd\u6210\uff0c\u51fa\u4e86\u70b9\u72b6\u51b5\uff0c\u7a0d\u540e\u518d\u8bd5\u8bd5\u770b\u3002");
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
    ...context,
    message: userText,
    username: message.author.username,
    hasAttachmentUrl: Boolean(attachmentUrl)
  });

  await message.reply(scene.chatReply);

  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping();
  }

  const serviceKey = character.tuquConfig!.serviceKey;
  const characterId = character.tuquConfig!.characterId!;

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
        characterIds: [characterId],
        sceneDescription: scene.sceneDescription,
        ratio: scene.ratio
      });
    }
  } catch (tuquError) {
    console.error("TUQU image generation failed:", tuquError);
    await replyWithInCharacterError(message, character, context, tuquError);
    return;
  }

  await message.channel.send({ files: [imageUrl] });
  await appendConversationMemory(character, message.author.username, userText, `${scene.chatReply} [\u56fe\u7247]`);
}

function isRechargeRequest(message: string) {
  return /充值|余额|买点|recharge|top.?up|付[费款]|续费/u.test(message);
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
    await message.reply("充值方案没加载出来，稍后再试试～");
    return;
  }

  const decision = await generateRechargeDecision({
    characterName: character.name,
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
      await message.reply(`${decision.chatReply}\n\n（支付生成失败了，稍后再试）`);
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
      await message.reply(`${decision.chatReply}\n\n（支付生成失败了，稍后再试）`);
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
  const tuquReady = Boolean(character.tuquConfig?.serviceKey?.trim() && character.tuquConfig?.characterId?.trim());

  if (isPhoto && !tuquReady) {
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

    if (isPhoto && tuquReady) {
      await handlePhotoRequest(message, character, context, trimmed);
      return;
    }

    const hasServiceKey = Boolean(character.tuquConfig?.serviceKey?.trim());
    if (!message.author.bot && hasServiceKey && isRechargeRequest(trimmed)) {
      await handleRechargeRequest(message, character, context, trimmed);
      return;
    }

    const reply = await generateDiscordReply({
      characterName: character.name,
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
    await message.reply("\u6211\u521a\u521a\u6389\u7ebf\u4e86\u4e00\u4e0b\uff0c\u7a0d\u540e\u518d\u8bd5\u4e00\u6b21\u3002");
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
