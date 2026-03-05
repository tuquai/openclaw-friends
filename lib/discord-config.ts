import { promises as fs } from "fs";
import path from "path";
import { decodeDiscordBotIdFromToken, normalizeDiscordBotToken } from "@/lib/discord-account";
import { DiscordRuntimeAccountConfig, DiscordRuntimeConfig } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const configFile = path.join(dataDir, "discord-config.json");

async function ensureConfigStorage() {
  await fs.mkdir(dataDir, { recursive: true });
}

function normalizeAccountConfig(
  accountId: string,
  raw: Partial<DiscordRuntimeAccountConfig> | undefined
): DiscordRuntimeAccountConfig | null {
  const botToken = normalizeDiscordBotToken(raw?.botToken ?? "");
  if (!botToken) {
    return null;
  }

  const botId = raw?.botId?.trim() || decodeDiscordBotIdFromToken(botToken) || undefined;

  return {
    accountId,
    botToken,
    botId,
    characterId: raw?.characterId?.trim() || undefined,
    characterName: raw?.characterName?.trim() || undefined,
    updatedAt: raw?.updatedAt ?? new Date().toISOString()
  };
}

function normalizeConfig(raw: unknown): DiscordRuntimeConfig {
  if (!raw || typeof raw !== "object") {
    return {
      accounts: {},
      updatedAt: ""
    };
  }

  const candidate = raw as Partial<DiscordRuntimeConfig> & { botToken?: string };
  const accounts: Record<string, DiscordRuntimeAccountConfig> = {};

  if (candidate.accounts && typeof candidate.accounts === "object") {
    for (const [accountId, value] of Object.entries(candidate.accounts)) {
      const normalized = normalizeAccountConfig(accountId, value as Partial<DiscordRuntimeAccountConfig>);
      if (normalized) {
        accounts[accountId] = normalized;
      }
    }
  }

  if (candidate.botToken?.trim()) {
    const legacy = normalizeAccountConfig("default", {
      accountId: "default",
      botToken: candidate.botToken,
      updatedAt: candidate.updatedAt
    });

    if (legacy && !accounts.default) {
      accounts.default = legacy;
    }
  }

  return {
    accounts: dedupeAccountsByToken(accounts),
    updatedAt: candidate.updatedAt ?? ""
  };
}

function dedupeAccountsByToken(accounts: Record<string, DiscordRuntimeAccountConfig>) {
  const deduped = new Map<string, DiscordRuntimeAccountConfig>();

  for (const account of Object.values(accounts).sort((left, right) => {
    const leftPriority = left.accountId === "default" ? 1 : 0;
    const rightPriority = right.accountId === "default" ? 1 : 0;
    return leftPriority - rightPriority;
  })) {
    if (!deduped.has(account.botToken)) {
      deduped.set(account.botToken, account);
    }
  }

  return Object.fromEntries(Array.from(deduped.values()).map((account) => [account.accountId, account]));
}

export async function readDiscordRuntimeConfig() {
  await ensureConfigStorage();

  try {
    const raw = await fs.readFile(configFile, "utf8");
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return {
      accounts: {},
      updatedAt: ""
    } satisfies DiscordRuntimeConfig;
  }
}

export async function readDiscordRuntimeAccount(accountId: string) {
  const config = await readDiscordRuntimeConfig();
  return config.accounts[accountId] ?? null;
}

export async function writeDiscordRuntimeAccount(input: {
  accountId: string;
  botToken: string;
  botId?: string;
  characterId?: string;
  characterName?: string;
}) {
  await ensureConfigStorage();
  const config = await readDiscordRuntimeConfig();
  const accountId = input.accountId.trim();
  const normalized = normalizeAccountConfig(accountId, {
    accountId,
    botToken: input.botToken,
    botId: input.botId,
    characterId: input.characterId,
    characterName: input.characterName,
    updatedAt: new Date().toISOString()
  });

  if (!normalized) {
    throw new Error("Discord bot token is required");
  }

  const nextConfig: DiscordRuntimeConfig = {
    accounts: dedupeAccountsByToken({
      ...config.accounts,
      [accountId]: normalized
    }),
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(configFile, JSON.stringify(nextConfig, null, 2), "utf8");
  return nextConfig;
}

export async function listDiscordRuntimeAccounts() {
  const config = await readDiscordRuntimeConfig();
  const accounts = Object.values(config.accounts).sort((left, right) => left.accountId.localeCompare(right.accountId));
  const seenTokens = new Set<string>();
  const deduped: typeof accounts = [];

  for (const account of [...accounts].sort((left, right) => {
    const leftPriority = left.accountId === "default" ? 1 : 0;
    const rightPriority = right.accountId === "default" ? 1 : 0;
    return leftPriority - rightPriority;
  })) {
    if (seenTokens.has(account.botToken)) {
      continue;
    }
    seenTokens.add(account.botToken);
    deduped.push(account);
  }

  return deduped.sort((left, right) => left.accountId.localeCompare(right.accountId));
}
