import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildDiscordAccountId, normalizeDiscordBotToken } from "@/lib/discord-account";
import { readDiscordRuntimeAccount, readDiscordRuntimeConfig } from "@/lib/discord-config";
import { resolveOptionalPathEnv } from "@/lib/env-path";
import { CharacterRecord } from "@/lib/types";

type OpenClawConfig = {
  agents?: {
    list?: Array<Record<string, unknown>>;
  };
  bindings?: Array<Record<string, unknown>>;
  channels?: {
    discord?: {
      enabled?: boolean;
      allowFrom?: string[];
      accounts?: Record<string, Record<string, unknown>>;
    };
  };
  tools?: {
    elevated?: {
      enabled?: boolean;
      allowFrom?: {
        discord?: string[];
      };
    };
  };
  [key: string]: unknown;
};

type DiscordBindingMatch = {
  channel?: string;
  accountId?: string;
  peer?: { kind?: string; id?: string };
  guildId?: string;
};

function getOpenClawRoot() {
  return resolveOptionalPathEnv(process.env.OPENCLAW_HOME, path.join(os.homedir(), ".openclaw"));
}

function buildStableAgentId(id: string) {
  const normalized = id.trim().toLowerCase().slice(0, 8);
  return normalized || "character";
}

function buildLegacyAgentId(value: string, id: string) {
  return (
    `${value}-${id.slice(0, 8)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "character"
  );
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTypedMentionPatterns(name: string, botId?: string) {
  const patterns: string[] = [];
  const trimmed = name.trim();

  if (trimmed) {
    const normalizedName = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => escapeRegExp(part))
      .join(String.raw`\s+`);

    // Keep plain-text triggering strict: only a leading "@name" counts.
    patterns.push(String.raw`^\s*@${normalizedName}`);
  }

  if (botId?.trim()) {
    // OpenClaw's explicit Discord mention detection can miss nickname mention syntax.
    patterns.push(String.raw`<@!?${escapeRegExp(botId.trim())}>`);
  }

  return patterns;
}

async function buildAllowedDiscordUserIds(userId: string, currentBotId?: string) {
  const runtimeConfig = await readDiscordRuntimeConfig();
  const ids = new Set<string>();

  if (userId.trim()) {
    ids.add(userId.trim());
  }

  if (currentBotId?.trim()) {
    ids.add(currentBotId.trim());
  }

  for (const account of Object.values(runtimeConfig.accounts)) {
    if (account.botId?.trim()) {
      ids.add(account.botId.trim());
    }
  }

  return Array.from(ids);
}

function defaultOpenClawConfig(): OpenClawConfig {
  return {
    agents: {
      list: []
    },
    bindings: [],
    channels: {
      discord: {
        enabled: true,
        accounts: {}
      }
    },
    tools: {
      elevated: {
        enabled: true,
        allowFrom: {
          discord: []
        }
      }
    }
  };
}

function defaultAgentModelsJson() {
  return {
    providers: {}
  };
}

function defaultAgentAuthProfilesJson() {
  return {
    version: 1,
    profiles: {},
    lastGood: {},
    usageStats: {}
  };
}

function configLockPath() {
  return path.join(getOpenClawRoot(), "openclaw.json.lock");
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireConfigLock() {
  const lockPath = configLockPath();
  const ownerPath = path.join(lockPath, "owner.json");
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    try {
      await fs.mkdir(lockPath);
      await fs.writeFile(
        ownerPath,
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }, null, 2),
        "utf8"
      );
      return lockPath;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EEXIST") {
        throw error;
      }

      try {
        const raw = await fs.readFile(ownerPath, "utf8");
        const owner = JSON.parse(raw) as { pid?: number; acquiredAt?: string };
        const acquiredAt = owner.acquiredAt ? Date.parse(owner.acquiredAt) : NaN;
        const stale = Number.isNaN(acquiredAt) || Date.now() - acquiredAt > 30_000;
        const alive = typeof owner.pid === "number" && isProcessAlive(owner.pid);
        if (stale || !alive) {
          await fs.rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        await fs.rm(lockPath, { recursive: true, force: true });
        continue;
      }

      await sleep(100);
    }
  }

  throw new Error("Timed out while waiting to update OpenClaw config");
}

async function releaseConfigLock(lockPath: string) {
  await fs.rm(lockPath, { recursive: true, force: true });
}

async function ensureOpenClawBootstrap() {
  const root = getOpenClawRoot();
  const configPath = path.join(root, "openclaw.json");
  await fs.mkdir(root, { recursive: true });

  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(defaultOpenClawConfig(), null, 2), "utf8");
  }
}

async function readOpenClawConfig() {
  await ensureOpenClawBootstrap();
  const configPath = path.join(getOpenClawRoot(), "openclaw.json");
  const raw = await fs.readFile(configPath, "utf8");
  return {
    configPath,
    config: JSON.parse(raw) as OpenClawConfig
  };
}

async function writeOpenClawConfigAtomic(configPath: string, config: OpenClawConfig) {
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(config, null, 2), "utf8");
  await fs.rename(tempPath, configPath);
}

async function resolveGuildId(channelId: string, botToken: string, explicitGuildId?: string) {
  if (explicitGuildId?.trim()) {
    return explicitGuildId.trim();
  }

  const token = normalizeDiscordBotToken(botToken);
  if (!token) {
    return "";
  }

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${token}`
    }
  });

  if (!response.ok) {
    return "";
  }

  const json = (await response.json()) as { guild_id?: string };
  return json.guild_id?.trim() ?? "";
}

async function ensureAgentDir(agentId: string) {
  const root = getOpenClawRoot();
  const sourceDir = path.join(root, "agents", "main", "agent");
  const targetDir = path.join(root, "agents", agentId, "agent");
  await fs.mkdir(targetDir, { recursive: true });

  const files = [
    {
      name: "models.json",
      fallback: defaultAgentModelsJson()
    },
    {
      name: "auth-profiles.json",
      fallback: defaultAgentAuthProfilesJson()
    }
  ];

  for (const file of files) {
    const source = path.join(sourceDir, file.name);
    const target = path.join(targetDir, file.name);
    try {
      await fs.access(target);
      continue;
    } catch {
      // target missing, continue
    }

    try {
      await fs.copyFile(source, target);
    } catch {
      await fs.writeFile(target, JSON.stringify(file.fallback, null, 2), "utf8");
    }
  }

  return targetDir;
}

function inferAvatar(character: CharacterRecord) {
  if (character.photos[0]) {
    const extension = path.extname(character.photos[0]) || ".jpg";
    return `profile${extension}`;
  }

  return undefined;
}

function upsertArray<T>(items: T[], predicate: (item: T) => boolean, value: T) {
  const index = items.findIndex(predicate);
  if (index === -1) {
    items.push(value);
    return items;
  }

  items[index] = value;
  return items;
}

function shouldDropBinding(
  agentIds: Set<string>,
  bindingAgentId: string | undefined,
  match: DiscordBindingMatch | undefined
) {
  if (!bindingAgentId || !agentIds.has(bindingAgentId)) {
    return false;
  }

  if (match?.channel !== "discord") {
    return false;
  }

  return true;
}

function isAmbiguousLegacyDiscordChannelBinding(entry: Record<string, unknown>, agentIds: Set<string>) {
  const match = entry.match as DiscordBindingMatch | undefined;
  return (
    typeof entry.agentId === "string" &&
    agentIds.has(entry.agentId) &&
    match?.channel === "discord" &&
    match.peer?.kind === "channel" &&
    typeof match.peer.id === "string" &&
    !match.accountId
  );
}

function findCharacterAgentIds(
  agentsList: Array<Record<string, unknown>>,
  character: CharacterRecord,
  stableAgentId: string
) {
  const idSuffix = character.id.trim().toLowerCase().slice(0, 8);
  const legacyAgentId = buildLegacyAgentId(character.name, character.id);
  const ids = new Set<string>([stableAgentId, legacyAgentId]);

  for (const entry of agentsList) {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      continue;
    }

    const workspace = typeof entry.workspace === "string" ? entry.workspace : "";
    if (workspace && workspace === character.workspacePath) {
      ids.add(entry.id);
      continue;
    }

    if (entry.id === stableAgentId || entry.id === legacyAgentId) {
      ids.add(entry.id);
      continue;
    }

    if (idSuffix && (entry.id === idSuffix || entry.id.endsWith(`-${idSuffix}`))) {
      ids.add(entry.id);
    }
  }

  return ids;
}

export async function registerCharacterInOpenClaw(character: CharacterRecord) {
  if (!character.workspacePath) {
    throw new Error("Character workspace is missing");
  }

  if (!character.discordLink?.channelId || !character.discordLink.userId) {
    throw new Error("Character is missing Discord channel or user binding");
  }

  const discordLink = character.discordLink;
  const accountId = discordLink.accountId ?? buildDiscordAccountId(character.name, character.id);
  const runtimeAccount = await readDiscordRuntimeAccount(accountId);
  if (!runtimeAccount?.botToken) {
    throw new Error("Character is missing a saved Discord bot token");
  }
  const allowedDiscordUserIds = await buildAllowedDiscordUserIds(discordLink.userId, runtimeAccount.botId);

  const guildId = await resolveGuildId(
    discordLink.channelId,
    runtimeAccount.botToken,
    discordLink.guildId
  );
  if (!guildId) {
    throw new Error("Unable to resolve Discord Server ID from the current Channel ID. Please provide Server ID.");
  }

  const agentId = buildStableAgentId(character.id);
  const agentDir = await ensureAgentDir(agentId);
  const avatar = inferAvatar(character);
  const configPath = path.join(getOpenClawRoot(), "openclaw.json");
  const lockPath = await acquireConfigLock();
  try {
    const { config } = await readOpenClawConfig();
    const agentsList = Array.isArray(config.agents?.list) ? [...config.agents.list] : [];
    const characterAgentIds = findCharacterAgentIds(agentsList, character, agentId);

    const filteredAgents = agentsList.filter((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string") {
        return true;
      }
      return !characterAgentIds.has(entry.id);
    });

    filteredAgents.push({
      id: agentId,
      name: agentId,
      workspace: character.workspacePath,
      agentDir,
      identity: {
        name: character.name,
        theme: character.blueprintPackage?.summary.archetype ?? character.concept ?? "OpenClaw character",
        avatar
      },
      groupChat: {
        mentionPatterns: buildTypedMentionPatterns(character.name, runtimeAccount.botId)
      },
      tools: {
        elevated: {
          enabled: true,
          allowFrom: {
            discord: [discordLink.userId]
          }
        }
      }
    });

    const bindings = Array.isArray(config.bindings) ? [...config.bindings] : [];
    const nextBindings = bindings.filter((entry) => {
      if (!isRecord(entry)) {
        return true;
      }

      if (isAmbiguousLegacyDiscordChannelBinding(entry, characterAgentIds)) {
        return false;
      }

      return !shouldDropBinding(
        characterAgentIds,
        typeof entry.agentId === "string" ? entry.agentId : undefined,
        isRecord(entry.match) ? (entry.match as DiscordBindingMatch) : undefined
      );
    });

    nextBindings.push(
      {
        agentId,
        match: {
          channel: "discord",
          accountId,
          peer: {
            kind: "dm",
            id: discordLink.userId
          }
        }
      },
      {
        agentId,
        match: {
          channel: "discord",
          accountId,
          peer: {
            kind: "channel",
            id: discordLink.channelId
          },
          guildId
        }
      }
    );

    const discord = isRecord(config.channels?.discord) ? config.channels.discord : {};
    const accounts = isRecord(discord.accounts) ? { ...discord.accounts } : {};
    const currentAccount = isRecord(accounts[accountId]) ? { ...accounts[accountId] } : {};
    const accountGuilds = isRecord(currentAccount.guilds)
      ? ({ ...currentAccount.guilds } as Record<string, Record<string, unknown>>)
      : {};
    const currentGuild = isRecord(accountGuilds[guildId]) ? (accountGuilds[guildId] as Record<string, unknown>) : {};
    const currentChannels = isRecord(currentGuild.channels) ? (currentGuild.channels as Record<string, unknown>) : {};
    const currentChannel = isRecord(currentChannels[discordLink.channelId])
      ? (currentChannels[discordLink.channelId] as Record<string, unknown>)
      : {};
    const execApprovals = isRecord(currentAccount.execApprovals)
      ? (currentAccount.execApprovals as Record<string, unknown>)
      : {};

    accountGuilds[guildId] = {
      ...currentGuild,
      users: Array.from(new Set([...normalizeStringArray(currentGuild.users), ...allowedDiscordUserIds])),
      channels: {
        ...currentChannels,
        [discordLink.channelId]: {
          ...currentChannel,
          allow: true,
          requireMention: true,
          users: Array.from(
            new Set([
              ...normalizeStringArray(currentChannel.users),
              ...allowedDiscordUserIds
            ])
          )
        }
      }
    };

    const approvers = Array.from(new Set([...normalizeStringArray(execApprovals.approvers), discordLink.userId]));
    const agentFilter = Array.from(new Set([...normalizeStringArray(execApprovals.agentFilter), agentId]));

    accounts[accountId] = {
      ...currentAccount,
      name: character.name,
      enabled: true,
      allowBots: true,
      token: runtimeAccount.botToken,
      allowFrom: Array.from(new Set([...normalizeStringArray(currentAccount.allowFrom), discordLink.userId])),
      guilds: accountGuilds,
      execApprovals: {
        enabled: true,
        ...execApprovals,
        approvers,
        agentFilter
      }
    };

    const elevated = isRecord(config.tools?.elevated) ? config.tools.elevated : {};
    const elevatedAllowFrom = isRecord(elevated.allowFrom) ? elevated.allowFrom : {};
    const nextConfig: OpenClawConfig = {
      ...config,
      agents: {
        ...config.agents,
        list: filteredAgents
      },
      bindings: nextBindings,
      channels: {
        ...config.channels,
        discord: {
          ...discord,
          enabled: true,
          accounts
        }
      },
      tools: {
        ...config.tools,
        elevated: {
          ...elevated,
          enabled: true,
          allowFrom: {
            ...elevatedAllowFrom,
            discord: Array.from(new Set([...normalizeStringArray(elevatedAllowFrom.discord), discordLink.userId]))
          }
        }
      }
    };

    await writeOpenClawConfigAtomic(configPath, nextConfig);
  } finally {
    await releaseConfigLock(lockPath);
  }

  return { agentId, guildId, configPath, accountId };
}
