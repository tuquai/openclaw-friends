import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { buildDiscordAccountId, normalizeDiscordBotToken } from "@/lib/discord-account";
import { readDiscordRuntimeAccount } from "@/lib/discord-config";
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
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function slugifyAgentId(value: string, id: string) {
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

async function readOpenClawConfig() {
  const configPath = path.join(getOpenClawRoot(), "openclaw.json");
  const raw = await fs.readFile(configPath, "utf8");
  return {
    configPath,
    config: JSON.parse(raw) as OpenClawConfig
  };
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

  for (const fileName of ["models.json", "auth-profiles.json"]) {
    const source = path.join(sourceDir, fileName);
    const target = path.join(targetDir, fileName);
    try {
      await fs.access(target);
    } catch {
      await fs.copyFile(source, target);
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
  agentId: string,
  bindingAgentId: string | undefined,
  match: DiscordBindingMatch | undefined,
  accountId: string,
  channelId: string,
  userId: string
) {
  if (bindingAgentId !== agentId) {
    return false;
  }

  if (match?.channel !== "discord") {
    return false;
  }

  return (
    (match.peer?.kind === "dm" && match.peer.id === userId) ||
    (match.peer?.kind === "channel" && match.peer.id === channelId)
  );
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

  const guildId = await resolveGuildId(
    discordLink.channelId,
    runtimeAccount.botToken,
    discordLink.guildId
  );
  if (!guildId) {
    throw new Error("Unable to resolve Discord guildId from the current channelId. Please provide guildId.");
  }

  const { configPath, config } = await readOpenClawConfig();
  const agentId = slugifyAgentId(character.name, character.id);
  const agentDir = await ensureAgentDir(agentId);
  const avatar = inferAvatar(character);

  const agentsList = Array.isArray(config.agents?.list) ? [...config.agents.list] : [];
  upsertArray(
    agentsList,
    (entry) => typeof entry === "object" && entry !== null && (entry as { id?: string }).id === agentId,
    {
      id: agentId,
      name: agentId,
      workspace: character.workspacePath,
      agentDir,
      identity: {
        name: character.name,
        theme: character.blueprintPackage?.summary.archetype ?? character.concept ?? "OpenClaw character",
        avatar
      },
      tools: {
        elevated: {
          enabled: true,
          allowFrom: {
            discord: [discordLink.userId]
          }
        }
      }
    }
  );

  const bindings = Array.isArray(config.bindings) ? [...config.bindings] : [];
  const nextBindings = bindings.filter((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return true;
    }

    return !shouldDropBinding(
      agentId,
      (entry as { agentId?: string }).agentId,
      (entry as { match?: DiscordBindingMatch }).match,
      accountId,
      discordLink.channelId,
      discordLink.userId
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

  const discord = config.channels?.discord ?? {};
  const accounts = typeof discord.accounts === "object" && discord.accounts ? { ...discord.accounts } : {};
  const currentAccount =
    typeof accounts[accountId] === "object" && accounts[accountId] ? { ...accounts[accountId] } : {};
  const accountGuilds =
    typeof currentAccount.guilds === "object" && currentAccount.guilds
      ? ({ ...currentAccount.guilds } as Record<string, Record<string, unknown>>)
      : {};
  const currentGuild =
    typeof accountGuilds[guildId] === "object" && accountGuilds[guildId]
      ? (accountGuilds[guildId] as Record<string, unknown>)
      : {};
  const currentChannels =
    typeof currentGuild.channels === "object" && currentGuild.channels ? (currentGuild.channels as Record<string, unknown>) : {};

  accountGuilds[guildId] = {
    ...currentGuild,
    users: Array.from(new Set([...normalizeStringArray(currentGuild.users), discordLink.userId])),
    channels: {
      ...currentChannels,
      [discordLink.channelId]: {
        allow: true,
        requireMention: true,
        users: Array.from(
          new Set([
            ...normalizeStringArray((currentChannels[discordLink.channelId] as { users?: unknown })?.users),
            discordLink.userId
          ])
        )
      }
    }
  };

  const approvers = Array.from(new Set([...(normalizeStringArray(currentAccount.execApprovals && (currentAccount.execApprovals as { approvers?: unknown }).approvers)), discordLink.userId]));
  const agentFilter = Array.from(
    new Set([
      ...normalizeStringArray(currentAccount.execApprovals && (currentAccount.execApprovals as { agentFilter?: unknown }).agentFilter),
      agentId
    ])
  );

  accounts[accountId] = {
    ...currentAccount,
    name: currentAccount.name ?? character.name,
    enabled: true,
    token: runtimeAccount.botToken,
    allowFrom: Array.from(new Set([...normalizeStringArray(currentAccount.allowFrom), discordLink.userId])),
    guilds: accountGuilds,
    execApprovals: {
      enabled: true,
      ...(typeof currentAccount.execApprovals === "object" && currentAccount.execApprovals ? currentAccount.execApprovals : {}),
      approvers,
      agentFilter
    }
  };

  const nextConfig: OpenClawConfig = {
    ...config,
    agents: {
      ...config.agents,
      list: agentsList
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
        enabled: true,
        ...(config.tools?.elevated ?? {}),
        allowFrom: {
          ...(config.tools?.elevated?.allowFrom ?? {}),
          discord: Array.from(
            new Set([...(config.tools?.elevated?.allowFrom?.discord ?? []), discordLink.userId])
          )
        }
      }
    }
  };

  await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2), "utf8");
  return { agentId, guildId, configPath, accountId };
}
