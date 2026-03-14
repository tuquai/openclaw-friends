import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { resolveOptionalPathEnv } from "@/lib/env-path";
import { CharacterRecord, DiscordLink, TuquConfig } from "@/lib/types";
import { normalizeLanguage } from "@/lib/i18n";

function getWorkspaceRoot() {
  return resolveOptionalPathEnv(process.env.OPENCLAW_WORKSPACE_ROOT, path.join(os.homedir(), ".openclaw"));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "character";
}

function inferAvatarPath(source: string) {
  const extension = path.extname(source) || ".jpg";
  return `profile${extension}`;
}

function staticAgentsMd(name: string) {
  return `# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## First Run

If \`BOOTSTRAP.md\` exists, that's your birth certificate. Follow it, figure out who you are, then delete it. You won't need it again.

## Every Session

Before doing anything else:

1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
4. **If in MAIN SESSION** (direct chat with your human): Also read \`MEMORY.md\`

Don't ask permission. Just do it.

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** \`memory/YYYY-MM-DD.md\` — raw logs of what happened
- **Long-term:** \`MEMORY.md\` — your curated memory

Capture what matters. Decisions, context, things to remember. Skip the secrets unless asked to keep them.

### MEMORY.md

- Only load in main session
- Do not load in shared contexts
- Write significant events, lessons, decisions, and stable preferences
- Keep it curated rather than bloated

### Write It Down

- Memory is limited, files persist
- When someone says "remember this" → update a file
- When you learn a lesson → update the relevant workspace doc
- Text beats vague intention

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- When in doubt, ask.

## External vs Internal

**Safe to do freely:**

- Read files, explore, organize, learn
- Work within this workspace
- Improve local docs and notes

**Ask first:**

- Sending messages, emails, posts, or anything public
- Anything that leaves the machine
- Anything you're uncertain about

## Persona Realism

- Stay inside ${name}'s lived perspective
- Avoid meta phrasing about setups or prompts
- Prefer natural conversation over assistant boilerplate
- If a reply reads like customer support, rewrite it more casually before sending
- Let taste be selective; real people do not try to cover every angle

## Group Chats

- You're a participant, not the user's proxy
- Reply when directly asked or when you add real value
- Stay quiet when the chat is flowing fine without you
- One thoughtful response beats several fragments

## Tools

Skills live at \`~/.openclaw/skills/\`. When you need one, read its \`SKILL.md\`. Keep local notes in \`TOOLS.md\`.

### Task Routing

| Task type | Where to look |
|-----------|---------------|
| Image generation / TUQU photo API | \`~/.openclaw/skills/tuqu-photo-api/SKILL.md\` |
| Discord gateway issues | \`openclaw-gateway-recovery/SKILL.md\` (in this workspace) |
| Everything else (browser, messages, etc.) | Use native tools directly |

### Image Generation Routing

Read \`~/.openclaw/skills/tuqu-photo-api/SKILL.md\` for full API reference, then pick the right endpoint:

| User intent | Endpoint |
|-------------|----------|
| Named preset: 明朝汉服, 吉卜力, 杂志封面, etc. | \`GET /api/catalog\` → \`POST /api/v2/apply-preset\` |
| Free creation, no preset mentioned | \`POST /api/v2/generate-image\` |
| ${name} must be recognizable in the photo | \`POST /api/v2/generate-for-character\` (needs characterId) |
| 充值, 余额, INSUFFICIENT_BALANCE | Recharge flow in the same skill |

### Service Key

TUQU API calls need the service key from \`tuqu_service_key.txt\` in this workspace. If missing, guide the user to register at the TuQu billing page or configure it in the UI's TuQu settings.

### Character Creation

If character-consistent photos are needed but \`tuqu_character.json\` is missing:

1. Read \`.openclaw/character-photo-profile.json\` for ${name}'s physical description
2. Read \`profile.jpeg\` (or \`profile.jpg\`/\`profile.png\`) and encode as base64 data URL
3. Call \`POST /api/characters\` with \`name\`, \`photoBase64\`, and \`description\` fields
4. Save the returned \`_id\` to \`tuqu_character.json\` as \`{ "characterId": "...", "characterName": "..." }\`

Then use that \`characterId\` with \`POST /api/v2/generate-for-character\`.

### Media Rules

- Send the remote TUQU image URL directly as a media attachment. Do not download to local files.
- After each TUQU API call, log key info (endpoint, imageUrl, balance, transactionId) in \`memory/YYYY-MM-DD.md\`.

## Make It Yours

This is a starting point. Add your own conventions, style, and rules as you figure out what works.
`;
}

function staticToolsMd() {
  return `# TOOLS.md - Local Notes

Write environment-specific notes here when needed.
`;
}

function staticHeartbeatMd() {
  return `# HEARTBEAT.md

# Keep this file empty unless you want periodic checks.
`;
}



function buildCharacterPhotoProfile(character: CharacterRecord) {
  return {
    name: character.name,
    age: character.age,
    heritage: character.heritage,
    gender: character.gender,
    occupation: character.occupation,
    personality: character.personality.otherNotes || character.mbti || "",
    clothingStyle: character.concept || "符合角色设定的日常穿搭",
    other: `${character.worldSetting}；${character.concept || ""}；优先真实自然、生活感强；保持角色既有年龄与边界；不要海报感，不要过度磨皮。`
  };
}

function buildWorkspaceState(character: CharacterRecord) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    characterId: character.id,
    characterName: character.name,
    workspacePath: character.workspacePath ?? null
  };
}

function buildTuquConfigPayload(character: CharacterRecord, workspacePath: string) {
  if (!character.tuquConfig) {
    return null;
  }

  return {
    recordCharacterId: character.id,
    characterName: character.name,
    workspacePath,
    registrationUrl: character.tuquConfig.registrationUrl,
    serviceKey: character.tuquConfig.serviceKey,
    tuquCharacterId: character.tuquConfig.characterId ?? null,
    updatedAt: character.tuquConfig.updatedAt
  };
}

function buildDiscordLinkPayload(character: CharacterRecord, workspacePath: string) {
  if (!character.discordLink) {
    return null;
  }

  return {
    characterId: character.id,
    characterName: character.name,
    workspacePath,
    linkedAt: character.discordLink.linkedAt,
    accountId: character.discordLink.accountId ?? null,
    guildId: character.discordLink.guildId ?? null,
    channelId: character.discordLink.channelId,
    botId: character.discordLink.botId ?? null,
    userId: character.discordLink.userId
  };
}

async function writeDiscordLinkFile(character: CharacterRecord, workspacePath: string) {
  const payload = buildDiscordLinkPayload(character, workspacePath);
  if (!payload) {
    return;
  }

  await fs.writeFile(
    path.join(workspacePath, ".openclaw", "discord-link.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
}

async function writeTuquFiles(character: CharacterRecord, workspacePath: string) {
  const payload = buildTuquConfigPayload(character, workspacePath);
  if (!payload) {
    return;
  }

  await fs.writeFile(
    path.join(workspacePath, ".openclaw", "tuqu-config.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  if (payload.serviceKey.trim()) {
    await fs.writeFile(path.join(workspacePath, "tuqu_service_key.txt"), payload.serviceKey, "utf8");
  }

  if (payload.tuquCharacterId) {
    await fs.writeFile(
      path.join(workspacePath, "tuqu_character.json"),
      JSON.stringify(
        {
          characterId: payload.tuquCharacterId,
          characterName: character.name
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function withProfilePath(identityMd: string, profilePath: string) {
  const avatarLine = `- **Avatar:** ${profilePath}`;

  if (identityMd.includes("- **Avatar:**")) {
    return identityMd.replace(/- \*\*Avatar:\*\* .*/u, avatarLine);
  }

  return `${identityMd.trimEnd()}\n${avatarLine}\n`;
}

async function writeWorkspaceFiles(character: CharacterRecord, workspacePath: string) {
  let identityMd = character.blueprintPackage?.files.identityMd ?? "";

  if (character.photos[0]) {
    const sourcePath = path.join(process.cwd(), "public", character.photos[0].replace(/^\//, ""));
    const profileRelativePath = inferAvatarPath(character.photos[0]);
    const profileAbsolutePath = path.join(workspacePath, profileRelativePath);
    await fs.copyFile(sourcePath, profileAbsolutePath);
    identityMd = withProfilePath(identityMd, profileRelativePath);
  }

  await fs.writeFile(path.join(workspacePath, "IDENTITY.md"), identityMd, "utf8");
  await fs.writeFile(path.join(workspacePath, "SOUL.md"), character.blueprintPackage?.files.soulMd ?? "", "utf8");
  await fs.writeFile(path.join(workspacePath, "USER.md"), character.blueprintPackage?.files.userMd ?? "", "utf8");
  await fs.writeFile(path.join(workspacePath, "MEMORY.md"), character.blueprintPackage?.files.memoryMd ?? "", "utf8");
}


function buildGatewayRecoverySkillMd() {
  return `# OpenClaw Gateway Recovery

Use this skill when Discord bots stop responding, gateway is in crash-loop, or port 18789 is stuck.

## Symptoms

- Bots show online but don't reply (or only react without responding)
- \`gateway.err.log\` shows repeated "gateway already running" or "Port 18789 is already in use"
- Bot WebSocket connections closed with code 1005/1006

## Diagnosis

\`\`\`bash
ps aux | grep openclaw-gateway | grep -v grep
lsof -i :18789
tail -30 ~/.openclaw/logs/gateway.err.log
tail -50 ~/.openclaw/logs/gateway.log
\`\`\`

| Log Pattern | Meaning |
|-------------|---------|
| \`WebSocket connection closed with code 1006\` | Network disruption or Discord-side disconnect |
| \`gateway already running (pid XXXX); lock timeout\` | Stale process blocking restart |
| \`Port 18789 is already in use\` | Old gateway still holding the port |

## Recovery

\`\`\`bash
# 1. Stop LaunchAgent
openclaw gateway stop

# 2. Check for stale processes
lsof -i :18789

# 3. Force kill stale gateway
kill -9 <PID>

# 4. Verify port is free (no output expected)
lsof -i :18789

# 5. Restart
openclaw gateway install
\`\`\`

If \`openclaw gateway stop\` doesn't work:

\`\`\`bash
launchctl bootout gui/$UID/ai.openclaw.gateway
pkill -9 -f openclaw-gateway
sleep 2
openclaw gateway install
\`\`\`

## Verify

\`\`\`bash
tail -30 ~/.openclaw/logs/gateway.log
\`\`\`

Should show "logged in to discord as XXXX" for each bot and "qmd memory startup initialization armed" for each agent.

## Root Cause

Gateway Discord WebSocket reconnection can deadlock during mass disconnects. If SIGTERM arrives in that state, the process may not fully exit, leaving port 18789 occupied. LaunchAgent then crash-loops because each new instance finds the port in use.
`;
}

async function installGatewayRecoverySkill(workspacePath: string) {
  const targetRoot = path.join(workspacePath, "openclaw-gateway-recovery");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "SKILL.md"), buildGatewayRecoverySkillMd(), "utf8");
}

async function installCharacterPhotoProfile(character: CharacterRecord, workspacePath: string) {
  await fs.writeFile(
    path.join(workspacePath, ".openclaw", "character-photo-profile.json"),
    JSON.stringify(buildCharacterPhotoProfile(character), null, 2),
    "utf8"
  );
}

export function getWorkspaceRootPath() {
  return getWorkspaceRoot();
}

export async function writeCharacterRecord(character: CharacterRecord) {
  if (!character.workspacePath) {
    return;
  }

  const openclawDir = path.join(character.workspacePath, ".openclaw");
  await fs.mkdir(openclawDir, { recursive: true });
  await fs.writeFile(
    path.join(openclawDir, "character-record.json"),
    JSON.stringify(character, null, 2),
    "utf8"
  );
}

export async function readWorkspaceCharacterRecords(): Promise<Array<{ raw: unknown; workspacePath: string }>> {
  const workspaceRoot = getWorkspaceRoot();
  const results: Array<{ raw: unknown; workspacePath: string }> = [];

  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("workspace-"))
      .map(async (entry) => {
        const workspacePath = path.join(workspaceRoot, entry.name);
        try {
          const raw = JSON.parse(
            await fs.readFile(path.join(workspacePath, ".openclaw", "character-record.json"), "utf8")
          );
          results.push({ raw, workspacePath });
        } catch {
          // no character-record.json in this workspace
        }
      })
  );

  return results;
}

export async function createWorkspaceFromCharacter(character: CharacterRecord) {
  if (!character.blueprintPackage) {
    throw new Error("Character is missing blueprint package");
  }

  const workspaceRoot = getWorkspaceRoot();
  const dirName = `workspace-${slugify(character.name)}-${character.id.slice(0, 8)}`;
  const workspacePath = character.workspacePath || path.join(workspaceRoot, dirName);
  const avatarsDir = path.join(workspacePath, "avatars");
  const memoryDir = path.join(workspacePath, "memory");
  const openclawDir = path.join(workspacePath, ".openclaw");
  const generatedDir = path.join(workspacePath, "generated");

  await fs.mkdir(avatarsDir, { recursive: true });
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(openclawDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });

  await writeWorkspaceFiles(character, workspacePath);
  await installCharacterPhotoProfile(character, workspacePath);
  await installGatewayRecoverySkill(workspacePath);
  await fs.writeFile(path.join(workspacePath, "AGENTS.md"), staticAgentsMd(character.name), "utf8");
  await fs.writeFile(path.join(workspacePath, "TOOLS.md"), staticToolsMd(), "utf8");
  await fs.writeFile(path.join(workspacePath, "HEARTBEAT.md"), staticHeartbeatMd(), "utf8");
  const workspaceCharacter: CharacterRecord = {
    ...character,
    workspacePath
  };

  await fs.writeFile(
    path.join(openclawDir, "workspace-state.json"),
    JSON.stringify(buildWorkspaceState(workspaceCharacter), null, 2),
    "utf8"
  );
  await writeDiscordLinkFile(workspaceCharacter, workspacePath);
  await writeTuquFiles(workspaceCharacter, workspacePath);
  await writeCharacterRecord(workspaceCharacter);

  const memoryDaily = path.join(memoryDir, `${new Date().toISOString().slice(0, 10)}.md`);
  const memoryLines = [
    `Blueprint created for ${character.name}.`,
    "",
    ...(character.mbti ? [`- MBTI: ${character.mbti}`] : []),
    `- World: ${character.worldSetting}`,
    `- Concept: ${character.concept}`
  ];
  await fs.writeFile(
    memoryDaily,
    `${memoryLines.join("\n")}\n`,
    "utf8"
  );

  return workspacePath;
}

export async function syncWorkspaceDiscordLink(character: CharacterRecord) {
  if (!character.workspacePath) {
    return;
  }

  await fs.mkdir(path.join(character.workspacePath, ".openclaw"), { recursive: true });
  await writeDiscordLinkFile(character, character.workspacePath);
}

export async function syncWorkspaceTuquConfig(character: CharacterRecord) {
  if (!character.workspacePath) {
    return;
  }

  await fs.mkdir(path.join(character.workspacePath, ".openclaw"), { recursive: true });
  await writeTuquFiles(character, character.workspacePath);
}

export async function syncWorkspaceSkills(character: CharacterRecord) {
  if (!character.workspacePath) {
    return;
  }

  await fs.mkdir(path.join(character.workspacePath, ".openclaw"), { recursive: true });
  await installCharacterPhotoProfile(character, character.workspacePath);
  await installGatewayRecoverySkill(character.workspacePath);
  await fs.writeFile(path.join(character.workspacePath, "AGENTS.md"), staticAgentsMd(character.name), "utf8");
}

export async function syncWorkspaceFiles(character: CharacterRecord) {
  if (!character.workspacePath || !character.blueprintPackage) {
    return;
  }

  await writeWorkspaceFiles(character, character.workspacePath);
}

export type WorkspaceSummary = {
  workspacePath: string;
  dirName: string;
  characterName: string | null;
  characterId: string | null;
  hasIdentityMd: boolean;
  hasSoulMd: boolean;
  hasUserMd: boolean;
  hasMemoryMd: boolean;
  hasDiscordLink: boolean;
  hasTuquConfig: boolean;
  hasCharacterRecord: boolean;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listAvailableWorkspaces(): Promise<WorkspaceSummary[]> {
  const workspaceRoot = getWorkspaceRoot();
  const results: WorkspaceSummary[] = [];

  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("workspace-"))
      .map(async (entry) => {
        const workspacePath = path.join(workspaceRoot, entry.name);
        const openclawDir = path.join(workspacePath, ".openclaw");

        let characterName: string | null = null;
        let characterId: string | null = null;

        try {
          const stateRaw = JSON.parse(
            await fs.readFile(path.join(openclawDir, "workspace-state.json"), "utf8")
          ) as { characterName?: string; characterId?: string };
          characterName = stateRaw.characterName ?? null;
          characterId = stateRaw.characterId ?? null;
        } catch {
          // try character-record.json instead
        }

        if (!characterName) {
          try {
            const recordRaw = JSON.parse(
              await fs.readFile(path.join(openclawDir, "character-record.json"), "utf8")
            ) as { name?: string; id?: string };
            characterName = recordRaw.name ?? null;
            characterId = characterId ?? recordRaw.id ?? null;
          } catch {
            // no record either, use dir name
          }
        }

        const [hasIdentityMd, hasSoulMd, hasUserMd, hasMemoryMd, hasDiscordLink, hasTuquConfig, hasCharacterRecord] =
          await Promise.all([
            fileExists(path.join(workspacePath, "IDENTITY.md")),
            fileExists(path.join(workspacePath, "SOUL.md")),
            fileExists(path.join(workspacePath, "USER.md")),
            fileExists(path.join(workspacePath, "MEMORY.md")),
            fileExists(path.join(openclawDir, "discord-link.json")),
            fileExists(path.join(openclawDir, "tuqu-config.json")),
            fileExists(path.join(openclawDir, "character-record.json"))
          ]);

        results.push({
          workspacePath,
          dirName: entry.name,
          characterName,
          characterId,
          hasIdentityMd,
          hasSoulMd,
          hasUserMd,
          hasMemoryMd,
          hasDiscordLink,
          hasTuquConfig,
          hasCharacterRecord
        });
      })
  );

  results.sort((a, b) => a.dirName.localeCompare(b.dirName));
  return results;
}

export async function importWorkspaceAsCharacter(workspacePath: string): Promise<CharacterRecord> {
  const openclawDir = path.join(workspacePath, ".openclaw");

  let base: Partial<CharacterRecord> = {};
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(openclawDir, "character-record.json"), "utf8")
    );
    base = raw as Partial<CharacterRecord>;
  } catch {
    // no existing record — build from workspace files
  }

  if (!base.name) {
    try {
      const stateRaw = JSON.parse(
        await fs.readFile(path.join(openclawDir, "workspace-state.json"), "utf8")
      ) as { characterName?: string; characterId?: string };
      base.name = stateRaw.characterName ?? undefined;
      base.id = base.id ?? stateRaw.characterId ?? undefined;
    } catch {
      // no state file
    }
  }

  const dirBasename = path.basename(workspacePath);
  if (!base.name) {
    const slug = dirBasename.replace(/^workspace-/, "").replace(/-[a-f0-9]{8}$/, "");
    base.name = slug || "未命名角色";
  }

  const [identityMd, soulMd, userMd, memoryMd] = await Promise.all([
    fs.readFile(path.join(workspacePath, "IDENTITY.md"), "utf8").catch(() => ""),
    fs.readFile(path.join(workspacePath, "SOUL.md"), "utf8").catch(() => ""),
    fs.readFile(path.join(workspacePath, "USER.md"), "utf8").catch(() => ""),
    fs.readFile(path.join(workspacePath, "MEMORY.md"), "utf8").catch(() => "")
  ]);

  const hasFiles = Boolean(identityMd || soulMd || userMd || memoryMd);

  if (hasFiles && !base.blueprintPackage) {
    base.blueprintPackage = {
      summary: {
        oneLiner: base.concept || "",
        archetype: "",
        confidenceNotes: []
      },
      character: {
        name: base.name ?? "未命名角色",
        age: base.age ?? "",
        gender: base.gender ?? "",
        occupation: base.occupation ?? "",
        heritage: base.heritage ?? "",
        worldSetting: base.worldSetting ?? "当代地球",
        concept: base.concept ?? "",
        mbti: base.mbti ?? undefined,
        coreTraits: [],
        speakingStyle: [],
        emotionalHabits: [],
        topicPreferences: [],
        hardBoundaries: []
      },
      relationship: {
        dynamic: "",
        backstory: "",
        affectionBaseline: "",
        affectionGrowthPath: [],
        userAddressingStyle: ""
      },
      followups: {
        missingButUseful: [],
        optionalDeepeningQuestions: []
      },
      files: { identityMd, soulMd, userMd, memoryMd }
    };
  } else if (hasFiles && base.blueprintPackage) {
    base.blueprintPackage = {
      ...base.blueprintPackage,
      files: { identityMd, soulMd, userMd, memoryMd }
    };
  }

  let discordLink: DiscordLink | undefined;
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(openclawDir, "discord-link.json"), "utf8")
    ) as Partial<DiscordLink>;
    if (raw.channelId || raw.userId) {
      discordLink = {
        accountId: raw.accountId,
        guildId: raw.guildId,
        channelId: raw.channelId ?? "",
        botId: raw.botId,
        userId: raw.userId ?? "",
        linkedAt: raw.linkedAt ?? new Date().toISOString(),
        workspacePath
      };
    }
  } catch {
    // no discord link
  }

  let tuquConfig: TuquConfig | undefined;
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(openclawDir, "tuqu-config.json"), "utf8")
    ) as Partial<TuquConfig> & { tuquCharacterId?: string };
    tuquConfig = {
      registrationUrl: raw.registrationUrl ?? "https://billing.tuqu.ai/dream-weaver/login",
      serviceKey: raw.serviceKey ?? "",
      characterId: raw.characterId ?? raw.tuquCharacterId,
      updatedAt: raw.updatedAt ?? new Date().toISOString()
    };
  } catch {
    // no tuqu config
  }

  if (!tuquConfig) {
    try {
      const key = (await fs.readFile(path.join(workspacePath, "tuqu_service_key.txt"), "utf8")).trim();
      if (key) {
        tuquConfig = {
          registrationUrl: "https://billing.tuqu.ai/dream-weaver/login",
          serviceKey: key,
          updatedAt: new Date().toISOString()
        };
      }
    } catch {
      // no service key file
    }
  }

  if (tuquConfig) {
    try {
      const raw = JSON.parse(
        await fs.readFile(path.join(workspacePath, "tuqu_character.json"), "utf8")
      ) as { characterId?: string };
      if (raw.characterId) {
        tuquConfig.characterId = tuquConfig.characterId ?? raw.characterId;
      }
    } catch {
      // no tuqu character file
    }
  }

  let photos: string[] = base.photos ?? [];
  if (!photos.length) {
    const profileCandidates = ["profile.jpg", "profile.png", "profile.jpeg", "profile.webp"];
    for (const candidate of profileCandidates) {
      if (await fileExists(path.join(workspacePath, candidate))) {
        photos = [`/uploads/${path.basename(workspacePath)}-${candidate}`];
        try {
          const dest = path.join(process.cwd(), "public", "uploads", `${path.basename(workspacePath)}-${candidate}`);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(path.join(workspacePath, candidate), dest);
        } catch {
          photos = [];
        }
        break;
      }
    }
  }

  const now = new Date().toISOString();
  const record: CharacterRecord = {
    id: base.id ?? crypto.randomUUID(),
    name: base.name ?? "未命名角色",
    age: base.age ?? "",
    gender: base.gender ?? "",
    occupation: base.occupation ?? "",
    heritage: base.heritage ?? "",
    worldSetting: base.worldSetting ?? "当代地球",
    concept: base.concept ?? "",
    mbti: base.mbti ?? undefined,
    personality: base.personality ?? {
      socialEnergy: "",
      informationFocus: "",
      decisionStyle: "",
      lifestylePace: "",
      otherNotes: ""
    },
    language: normalizeLanguage((base as { language?: string }).language),
    photos,
    createdAt: base.createdAt ?? now,
    updatedAt: now,
    questionnaire: base.questionnaire,
    blueprintPackage: base.blueprintPackage,
    discordLink: discordLink ?? base.discordLink,
    tuquConfig: tuquConfig ?? base.tuquConfig,
    workspacePath,
    preset: base.preset
  };

  await fs.mkdir(openclawDir, { recursive: true });
  await fs.writeFile(
    path.join(openclawDir, "character-record.json"),
    JSON.stringify(record, null, 2),
    "utf8"
  );

  return record;
}
