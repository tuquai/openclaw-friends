import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { resolveOptionalPathEnv } from "@/lib/env-path";
import { readAssociatesFile, type WorkspaceAssociate, writeAssociatesFile } from "@/lib/associates";
import { CharacterRecord, DiscordLink, TuquConfig } from "@/lib/types";
import { normalizeLanguage } from "@/lib/i18n";
import { normalizeTuquRegistrationUrl, TUQU_BILLING_DASHBOARD_URL } from "@/lib/tuqu-config";

const TUQU_SKILL_NAME = "tuqu-photo-skill";

export type TuquSkillSyncResult = {
  status: "present" | "installed";
  skillPath: string;
};

type SharedRoleEntry = {
  name: string;
  workspacePath: string;
};

function getWorkspaceRoot() {
  return resolveOptionalPathEnv(process.env.OPENCLAW_WORKSPACE_ROOT, path.join(os.homedir(), ".openclaw"));
}

function getBundledTuquSkillPath() {
  return path.join(process.cwd(), "skills", TUQU_SKILL_NAME);
}

function getInstalledTuquSkillPath() {
  return path.join(getWorkspaceRoot(), "skills", TUQU_SKILL_NAME);
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
5. If \`../SKILL_ROUTE.md\` exists and the task touches images, recharge, or other shared tool routing, read it too
6. If \`ASSOCIATES.json\` exists and the task is about close friends, recurring cast, or multi-character photos, read it too

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

Keep local notes in \`TOOLS.md\`. Shared routing rules, if present, live in \`../SKILL_ROUTE.md\`.

### Service Key

TUQU API calls need the service key from \`tuqu_service_key.txt\` in this workspace. If missing, guide the user to register at the TuQu billing page or configure it in the UI's TuQu settings.

### Media Rules

- Send the remote TUQU image URL directly as a media attachment. Do not download to local files.
- After each TUQU API call, log key info (endpoint, imageUrl, balance, transactionId) in \`memory/YYYY-MM-DD.md\`.

### TUQU Workflow

- Treat 自拍、拍照、写真、发张图 and similar requests as executable image requests, not just casual chat.
- If the requested image should show you, first ensure your own TUQU character exists. If you have a service key but no character ID yet, create your TUQU character from your profile image and role data before continuing.
- Before any TUQU image generation, check the remaining balance. If balance is low or empty, remind the user and help them recharge.
- If the image is your own selfie / portrait / a scene where you are visibly in frame, prefer \`/api/v2/generate-for-character\`.
- If the image is scenery, objects, edits, templates, or anything where you are not visibly in frame, prefer \`/api/v2/generate-image\`.
- If you create or learn a TUQU character for someone who should appear with you in future photos, add or update them in \`ASSOCIATES.json\`.
- If the user wants a new person in frame and you cannot find them in \`ASSOCIATES.json\`, ask for a clear reference photo first so you can create their TUQU character.

### Image Generation

When generating an image for a character (e.g., via TUQU API), you MUST first use the following logic to generate a "Prompt for Generating the Image":

- Use the character's details (SOUL.md) and current scene context.
- Follow the rules: Chinese only, 150-400 words, high visual detail (lighting, lens, textures), cinematic and vivid style.
- The output should be ONLY the final Chinese prompt string, ready to be sent to the generation tool.
- Refer to \`prompt.md\` (if available in your root environment) for the full meta-prompt logic on how to optimize these prompts.

## Make It Yours

This is a starting point. Add your own conventions, style, and rules as you figure out what works.
`;
}

function staticToolsMd() {
  return `# TOOLS.md - Local Notes

Write environment-specific notes here when needed.
`;
}

function staticSkillRouteMd() {
  return `# SKILL_ROUTE.md

Shared task-routing rules for OpenClaw character workspaces. Read this when the task touches images, recharge, or other shared tools.

## Route Map

| Task type | Where to look |
|-----------|---------------|
| The current character's own selfie / portrait / visible-in-frame photo | Ensure TUQU character exists, check balance, then use \`/api/v2/generate-for-character\` |
| Scenery, objects, image edits, templates, or styles without the current character in frame | Check balance, then use \`/api/v2/generate-image\` |
| Balance checks and recharge | \`/api/billing/balance\` then \`/api/v1/recharge/*\` |
| Low-level TUQU API reference | \`~/.openclaw/skills/tuqu-photo-skill/SKILL.md\` |
| Discord gateway issues | \`openclaw-gateway-recovery/SKILL.md\` |
| Everything else | Use native tools directly |

## Selfie Rules

- If the user asks for the current character's own 自拍、照片、写真、发张图, generate that character's photo.
- If the current character should appear in frame, create the current character's TUQU character first when it is missing, then check balance before generation.
- Treat 自拍 / 角色出镜 requests as identity-preserving jobs and route them to \`/api/v2/generate-for-character\`.
- Treat scenery / object / edit-only jobs as freestyle jobs and route them to \`/api/v2/generate-image\`.
- Do not ask for the user's face photo unless the user explicitly wants themselves to appear in the image.
- Treat 自拍 as image-generation ability, not literal phone ownership.
- For a normal 自拍, default to front-camera framing with the device out of frame unless the user explicitly wants a mirror shot or visible phone.

## Other Roles

- Read \`../ROLES.json\` when you need to know other OpenClaw roles in the system.
- Each role entry only includes \`name\` and \`workspacePath\`. Use the workspace path to read the target role's files directly when you need more detail.
- Read \`ASSOCIATES.json\` inside your own workspace when the question is about your current cast or repeat photo partners rather than the whole OpenClaw role directory.
- \`ASSOCIATES.json\` is a per-workspace TUQU companion cache, not a mirror of \`ROLES.json\`.
- \`ASSOCIATES.json\` entries should carry each associate's \`characterName\`, \`tuquCharacterId\`, and optionally \`workspacePath\`, \`source\`, and timestamps.

## Media Rules

- Send remote TUQU image URLs directly as media attachments. Do not download them to local files first.
- After each TUQU API call, log key info in \`memory/YYYY-MM-DD.md\`.

## Prompt Design

When you need to generate a new image prompt for the TUQU API, use these optimization rules to construct the final Chinese prompt string:

1. **Focus:** Character (name, age, features, outfit, mood) + Scene (location, action, lighting, vibe).
2. **Style:** Cinematic, vivid, high-quality, and detailed. Avoid simple keyword stacking; use natural but descriptive language.
3. **Refinement:** Include specific visual details like lens choice, lighting direction, background depth, and textures.
4. **Length:** Aim for 150-400 characters (max 500).
5. **Output:** Return ONLY the final Chinese prompt string. No headers, quotes, or explanations.
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

function sanitizeRoleEntry(character: CharacterRecord): SharedRoleEntry {
  return {
    name: character.name,
    workspacePath: character.workspacePath ?? ""
  };
}

function buildLegacyAssociateMirror(
  currentCharacter: CharacterRecord & { workspacePath: string },
  workspaceCharacters: Array<CharacterRecord & { workspacePath: string }>
): WorkspaceAssociate[] {
  return workspaceCharacters
    .filter(
      (candidate) =>
        candidate.id !== currentCharacter.id &&
        Boolean(candidate.workspacePath) &&
        Boolean(candidate.tuquConfig?.characterId?.trim())
    )
    .map((candidate) => ({
      characterName: candidate.name,
      workspacePath: candidate.workspacePath,
      tuquCharacterId: candidate.tuquConfig!.characterId!.trim()
    }))
    .sort((left, right) => left.characterName.localeCompare(right.characterName));
}

function associateSignature(associate: WorkspaceAssociate) {
  return [
    associate.characterName.trim().toLocaleLowerCase(),
    associate.tuquCharacterId.trim(),
    associate.workspacePath?.trim() ?? ""
  ].join("::");
}

function matchesLegacyAssociateMirror(actual: WorkspaceAssociate[], legacyMirror: WorkspaceAssociate[]) {
  if (!actual.length || actual.length !== legacyMirror.length) {
    return false;
  }

  if (actual.some((associate) => associate.source || associate.createdAt || associate.updatedAt)) {
    return false;
  }

  const left = [...actual].map(associateSignature).sort();
  const right = [...legacyMirror].map(associateSignature).sort();
  return left.every((entry, index) => entry === right[index]);
}

export async function syncOpenClawRolesFile(characters: CharacterRecord[]) {
  const workspaceCharacters = characters.filter(
    (character): character is CharacterRecord & { workspacePath: string } => Boolean(character.workspacePath)
  );

  await Promise.all(
    workspaceCharacters.map(async (character) => {
      const currentAssociates = await readAssociatesFile(character.workspacePath);
      const legacyMirror = buildLegacyAssociateMirror(character, workspaceCharacters);
      if (matchesLegacyAssociateMirror(currentAssociates, legacyMirror)) {
        await writeAssociatesFile(character.workspacePath, []);
      }
    })
  );

  const roles = workspaceCharacters.map((character) => sanitizeRoleEntry(character));

  await fs.mkdir(getWorkspaceRoot(), { recursive: true });
  await fs.writeFile(
    path.join(getWorkspaceRoot(), "ROLES.json"),
    JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        roles: roles.sort((left, right) => left.name.localeCompare(right.name))
      },
      null,
      2
    ),
    "utf8"
  );
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

function sharedSkillRouteMarkerPath(workspacePath: string) {
  return path.join(workspacePath, ".openclaw", "shared-skill-route.enabled");
}

async function installSharedSkillRouteFile() {
  await fs.mkdir(getWorkspaceRoot(), { recursive: true });
  await fs.writeFile(path.join(getWorkspaceRoot(), "SKILL_ROUTE.md"), staticSkillRouteMd(), "utf8");
}

async function markWorkspaceUsesSharedSkillRoute(workspacePath: string) {
  await fs.writeFile(sharedSkillRouteMarkerPath(workspacePath), "shared-root\n", "utf8");
}

export async function ensureTuquPhotoSkillInstalled(): Promise<TuquSkillSyncResult> {
  const sourceRoot = getBundledTuquSkillPath();
  const targetRoot = getInstalledTuquSkillPath();
  const sourceEntry = path.join(sourceRoot, "SKILL.md");
  const targetEntry = path.join(targetRoot, "SKILL.md");

  if (await fileExists(targetEntry)) {
    return {
      status: "present",
      skillPath: targetRoot
    };
  }

  if (!(await fileExists(sourceEntry))) {
    throw new Error(`Bundled TuQu skill is missing: ${sourceEntry}`);
  }

  await fs.mkdir(path.dirname(targetRoot), { recursive: true });
  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.cp(sourceRoot, targetRoot, { recursive: true, force: true });

  if (!(await fileExists(targetEntry))) {
    throw new Error(`Failed to install TuQu skill to ${targetRoot}`);
  }

  return {
    status: "installed",
    skillPath: targetRoot
  };
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

  const tuquSkillSync = await ensureTuquPhotoSkillInstalled();

  const workspaceRoot = getWorkspaceRoot();
  const dirName = `workspace-${slugify(character.name)}-${character.id.slice(0, 8)}`;
  const workspacePath = character.workspacePath || path.join(workspaceRoot, dirName);
  const memoryDir = path.join(workspacePath, "memory");
  const openclawDir = path.join(workspacePath, ".openclaw");

  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(openclawDir, { recursive: true });

  await writeWorkspaceFiles(character, workspacePath);
  await installCharacterPhotoProfile(character, workspacePath);
  await installGatewayRecoverySkill(workspacePath);
  await fs.writeFile(path.join(workspacePath, "AGENTS.md"), staticAgentsMd(character.name), "utf8");
  await installSharedSkillRouteFile();
  await markWorkspaceUsesSharedSkillRoute(workspacePath);
  await fs.writeFile(path.join(workspacePath, "TOOLS.md"), staticToolsMd(), "utf8");
  await fs.writeFile(path.join(workspacePath, "HEARTBEAT.md"), staticHeartbeatMd(), "utf8");
  await writeAssociatesFile(workspacePath, []);
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

  return {
    workspacePath,
    tuquSkillSync
  };
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

  await ensureTuquPhotoSkillInstalled();
  await fs.mkdir(path.join(character.workspacePath, ".openclaw"), { recursive: true });
  await installCharacterPhotoProfile(character, character.workspacePath);
  await installGatewayRecoverySkill(character.workspacePath);

  if (await fileExists(sharedSkillRouteMarkerPath(character.workspacePath))) {
    await installSharedSkillRouteFile();
    await fs.writeFile(path.join(character.workspacePath, "AGENTS.md"), staticAgentsMd(character.name), "utf8");
  }
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
      registrationUrl: normalizeTuquRegistrationUrl(raw.registrationUrl),
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
          registrationUrl: TUQU_BILLING_DASHBOARD_URL,
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
  const personalityInferenceEnabled =
    (base as { personalityInferenceEnabled?: boolean }).personalityInferenceEnabled !== false;
  const record: CharacterRecord = {
    id: base.id ?? crypto.randomUUID(),
    name: base.name ?? "未命名角色",
    age: base.age ?? "",
    gender: base.gender ?? "",
    occupation: base.occupation ?? "",
    heritage: base.heritage ?? "",
    worldSetting: base.worldSetting ?? "当代地球",
    concept: base.concept ?? "",
    famousCharacterMode:
      base.famousCharacterMode === "known" || base.famousCharacterMode === "original"
        ? base.famousCharacterMode
        : "auto",
    famousCharacterName: typeof base.famousCharacterName === "string" ? base.famousCharacterName : "",
    famousCharacterSource: typeof base.famousCharacterSource === "string" ? base.famousCharacterSource : "",
    mbti: personalityInferenceEnabled ? base.mbti ?? undefined : undefined,
    personalityInferenceEnabled,
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
