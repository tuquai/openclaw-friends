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

Skills provide your tools. When you need one, check its \`SKILL.md\`. Keep local notes in \`TOOLS.md\`.

### Image Generation Routing

Before generating any image, determine the user's intent and pick the correct endpoint. **Do not default to character-selfie for every image request.**

| User intent | Endpoint | Skill / Script |
|-------------|----------|----------------|
| ${name} 自拍, 拍照, or any photo where ${name} appears in frame | \`POST /api/generate-character\` | \`character-selfie/\` |
| 风景, 美食, 物品, 海报, 概念图, or any image where no person appears | \`POST /api/generate-freestyle\` | \`tuqu-catalog/generate-freestyle.sh\` |
| 证件照, 杂志封面, 黄金圣衣, or any named template | \`POST /api/generate\` with \`templateId\` | \`tuqu-catalog/generate-from-catalog.sh template <ID>\` |
| 吉卜力, 皮克斯3D, 水墨画, or any named style applied to ${name} | \`POST /api/generate\` with \`styleId\` | \`tuqu-catalog/generate-from-catalog.sh style <ID>\` |
| 给已有照片换风格 | \`POST /api/apply-style\` | \`tuqu-catalog/\` |
| 浏览可用模板和风格 | \`GET /api/catalog\` | \`tuqu-catalog/refresh-catalog.sh\` |

**Short rule:** if the person must remain recognizable, use character generation. If the image content matters more than any person's identity, use freestyle. If a named template or style is involved, use the catalog skill.

### Skill Discovery

- When routing leads to \`character-selfie/\`: inspect \`character-selfie/SKILL.md\` and \`character-selfie/README.md\`.
- When routing leads to \`tuqu-catalog/\`: inspect \`tuqu-catalog/SKILL.md\`. It teaches how to discover and use templates and styles from the live TUQU catalog.
- When the user asks "有什么模板", "有什么风格可以用", "有什么新的": run \`zsh ./tuqu-catalog/refresh-catalog.sh\` and read \`tuqu-catalog/catalog-cache.json\`.
- When the user asks about 充值, 余额, 买点数, or when INSUFFICIENT_BALANCE occurs: inspect \`tuqu-recharge/SKILL.md\`.
- When Discord bots stop responding or gateway issues arise: inspect \`openclaw-gateway-recovery/SKILL.md\`.

### Freestyle Generation

For images where no specific person needs to appear (landscapes, food, objects, posters, concept art, room interiors, scenery from the character's world, etc.):

\`\`\`bash
zsh ./tuqu-catalog/generate-freestyle.sh "详细的中文描述" [ratio] [model]
\`\`\`

Examples:

\`\`\`bash
zsh ./tuqu-catalog/generate-freestyle.sh "写实东方修仙世界，波涛汹涌的星辰之海，远处岛屿若隐若现，氛围危险而神秘，电影感光线" "16:9" "seedream45"
zsh ./tuqu-catalog/generate-freestyle.sh "午后咖啡厅窗边，一杯拿铁和一本打开的书，温暖自然光" "1:1"
\`\`\`

Write a detailed Chinese prompt covering subject, composition, lighting, style, and mood. The script prints an \`IMAGE_URL:\` line with the remote HTTPS URL — send that URL directly as a media attachment.

**Do NOT use \`generate-selfie.sh\` for this.** That script forces character identity and calls the wrong endpoint.

### Character Photo Workflow

Only for photos where ${name} must appear and be recognizable:

- First check whether \`tuqu_service_key.txt\` exists. If missing, send the user the TUQU registration URL and ask them to register, then either send the Service Key in chat or configure it in the UI's TuQu settings section.
- Once the key exists, ensure a TUQU character is created: if \`tuqu_character.json\` is missing, run \`create-character.sh\` automatically as an internal prerequisite.
- Then run \`generate-selfie.sh\` with a scene description built from dialogue context.
- Do not show a phone in-frame for normal selfies. Only include a visible phone when the user asks for 对镜自拍 or mirror selfie.
- Do not give the user a menu of options. Infer the best photo concept from the character's background and current context.

### TUQU API Logging

**Every TUQU API call must be logged.** The workspace scripts log automatically. If you write an inline script or curl command, log the response yourself:

\`\`\`bash
TUQU_LOG_WORKSPACE="$WORKSPACE_DIR" zsh ./tuqu-catalog/log-tuqu-call.sh "<endpoint>" "<method>" "$RESPONSE" "<note>"
\`\`\`

Example for an inline character creation:

\`\`\`bash
RESPONSE="$(curl -sS -X POST ...)"
TUQU_LOG_WORKSPACE="$(pwd)" zsh ./tuqu-catalog/log-tuqu-call.sh "/api/characters" "POST" "$RESPONSE" "create 紫菱"
\`\`\`

Logs are written to \`tuqu-logs/YYYY-MM-DD.jsonl\`. Each entry records timestamp, endpoint, success status, image URL, character ID, model, balance, and transaction ID.

### Common Rules

- When a photo is ready, send the remote TUQU image URL as a media attachment. Do not download images to local files — the runtime media sandbox blocks local workspace paths.
- Always check \`tuqu_service_key.txt\` before any generation call. If missing, guide the user to register first.

### Recharge / Top-Up

When the user asks about 充值, 余额, 买点数, recharge, or when image generation fails with INSUFFICIENT_BALANCE:

1. Read \`tuqu-recharge/SKILL.md\` for the full API reference.
2. **Call the API yourself** — you have the service key in \`tuqu_service_key.txt\`. Use it to list plans, then generate a payment QR code or checkout link.
3. **Send the QR image or payment link directly to the user.** Do NOT just tell them to "go log in and recharge" — that defeats the purpose.

The flow: list plans → user picks one → call WeChat or Stripe API → send QR code / link → done.

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

function escapeShellDoubleQuoted(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildLogTuquCallScript() {
  return `#!/bin/zsh
# Usage: log-tuqu-call.sh <endpoint> <method> <response_json> [extra_note]
# Appends a structured log entry to tuqu-logs/YYYY-MM-DD.jsonl
set -euo pipefail

WORKSPACE_DIR="\${TUQU_LOG_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_DIR="$WORKSPACE_DIR/tuqu-logs"
TODAY="$(date +%Y-%m-%d)"
LOG_FILE="$LOG_DIR/$TODAY.jsonl"

mkdir -p "$LOG_DIR"

ENDPOINT="\${1:-unknown}"
METHOD="\${2:-POST}"
RAW_RESPONSE="$3"
[[ -z "$RAW_RESPONSE" ]] && RAW_RESPONSE="{}"
NOTE="\${4:-}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

SUCCESS="$(echo "$RAW_RESPONSE" | jq -r '.success // false' 2>/dev/null || echo "parse_error")"
ERROR_CODE="$(echo "$RAW_RESPONSE" | jq -r '.error.code // empty' 2>/dev/null || true)"
IMAGE_URL="$(echo "$RAW_RESPONSE" | jq -r '.data.imageUrl // empty' 2>/dev/null || true)"
CHARACTER_ID="$(echo "$RAW_RESPONSE" | jq -r '.data._id // empty' 2>/dev/null || true)"
MODEL="$(echo "$RAW_RESPONSE" | jq -r '.data.model // empty' 2>/dev/null || true)"
BALANCE="$(echo "$RAW_RESPONSE" | jq -r '.data.remainingBalance // empty' 2>/dev/null || true)"
TX_ID="$(echo "$RAW_RESPONSE" | jq -r '.data.transactionId // empty' 2>/dev/null || true)"

jq -nc \\
  --arg ts "$TIMESTAMP" \\
  --arg ep "$ENDPOINT" \\
  --arg method "$METHOD" \\
  --arg success "$SUCCESS" \\
  --arg errorCode "$ERROR_CODE" \\
  --arg imageUrl "$IMAGE_URL" \\
  --arg characterId "$CHARACTER_ID" \\
  --arg model "$MODEL" \\
  --arg balance "$BALANCE" \\
  --arg txId "$TX_ID" \\
  --arg note "$NOTE" \\
  '{
    timestamp: $ts,
    endpoint: $ep,
    method: $method,
    success: ($success == "true"),
    errorCode: (if $errorCode == "" then null else $errorCode end),
    imageUrl: (if $imageUrl == "" then null else $imageUrl end),
    characterId: (if $characterId == "" then null else $characterId end),
    model: (if $model == "" then null else $model end),
    remainingBalance: (if $balance == "" then null else ($balance | tonumber? // $balance) end),
    transactionId: (if $txId == "" then null else $txId end),
    note: (if $note == "" then null else $note end)
  }' >> "$LOG_FILE"

echo "[tuqu-log] $TIMESTAMP $METHOD $ENDPOINT success=$SUCCESS"
`;
}

function buildTuquCatalogSkillMd(character: CharacterRecord) {
  return `# TUQU Catalog Skill - Templates & Styles

Use this skill when ${character.name} wants to use specific photo templates (证件照, 杂志封面, 专业人像, 黄金圣衣, etc.) or visual styles (吉卜力风格, 皮克斯3D, 水墨画, JOJO风格, etc.).

## Catalog Discovery

The TUQU platform maintains a live catalog of templates and styles:

\`\`\`
GET https://photo.tuqu.ai/api/catalog
\`\`\`

This endpoint is **public** (no auth required) and returns all active templates and styles with IDs, descriptions, preview images, and default models.

### When To Fetch The Catalog

- When the user asks "有什么模板/风格可以用", "有什么新模板" or similar browsing requests
- When you need to find a template/style matching the user's description
- When \`tuqu-catalog/catalog-cache.json\` is missing or older than 24 hours
- When the user mentions a template or style name you don't recognize in the cache

### Refreshing The Cache

\`\`\`bash
zsh ./tuqu-catalog/refresh-catalog.sh
\`\`\`

This fetches the latest catalog and saves it to \`tuqu-catalog/catalog-cache.json\`.

### Reading The Cache

If \`tuqu-catalog/catalog-cache.json\` exists and is recent, read it instead of hitting the API.

The cache structure:

\`\`\`json
{
  "fetchedAt": "ISO timestamp",
  "templates": [{ "id": "...", "name": "...", "description": "...", "category": "...", "defaultModel": "..." }],
  "styles": [{ "id": "...", "name": "...", "description": "...", "category": "...", "defaultModel": "..." }]
}
\`\`\`

## Templates vs Styles

| Type | Purpose | Example |
|------|---------|---------|
| **Template** | Complete scene preset with specific composition, lighting, and framing | 证件照, 专业人像, 杂志封面, 网红自拍, 礼服, 黄金圣衣 |
| **Style** | Visual style transformation applied to person photos | 吉卜力风格, 皮克斯3D, 水墨画, 手办风格, 蜡像, 90年代动漫 |

### Quick Rule

- **Template** = "用这个场景/主题拍一张" → scene changes, person identity preserved
- **Style** = "把照片变成这种风格" → visual aesthetic changes, person identity preserved

## Using Templates

Templates provide predefined scenes. Use the helper script:

\`\`\`bash
zsh ./tuqu-catalog/generate-from-catalog.sh template <TEMPLATE_ID> [model]
\`\`\`

Or for styles:

\`\`\`bash
zsh ./tuqu-catalog/generate-from-catalog.sh style <STYLE_ID> [model]
\`\`\`

The script reads \`tuqu_service_key.txt\` and \`profile.jpg\` from the workspace, calls \`POST /api/generate\`, logs the call, and prints the remote image URL prefixed with \`IMAGE_URL:\`. **Send that URL as media — do not download it locally.**

Key points:

- Use the template's \`defaultModel\` unless the user specifies otherwise
- \`variableValues\` can override template prompt variables if the template supports them
- For faceswap mode, also provide \`templateImage\` or \`templateImageUrl\`
- Person image comes from this workspace's \`profile.jpg\` by default

## Using Styles

Styles transform the visual aesthetic. Use the same helper script:

\`\`\`bash
zsh ./tuqu-catalog/generate-from-catalog.sh style <STYLE_ID> [model]
\`\`\`

## Applying Style To Existing Image

To restyle an existing image (not person-based), use \`POST /api/apply-style\`:

\`\`\`bash
curl -sS -X POST "https://photo.tuqu.ai/api/apply-style" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"userKey\\": \\"\${TUQU_SERVICE_KEY}\\",
    \\"sourceImageUrl\\": \\"<EXISTING_IMAGE_URL>\\",
    \\"styleImageUrl\\": \\"<STYLE_IMAGE_URL>\\",
    \\"styleId\\": \\"<STYLE_ID>\\",
    \\"resolution\\": \\"2K\\"
  }"
\`\`\`

Use this when the user wants to transform a previously generated image or an uploaded image into a different style, without re-doing person reference.

## Routing Decision Table

| User intent | Endpoint | Key param |
|-------------|----------|-----------|
| 用模板拍照 (证件照, 杂志封面, 黄金圣衣, etc.) | \`POST /api/generate\` | \`templateId\` |
| 用风格拍照 (吉卜力, 水墨画, 皮克斯3D, etc.) | \`POST /api/generate\` | \`styleId\` |
| 给已有照片换风格 | \`POST /api/apply-style\` | \`styleId\` + \`sourceImageUrl\` |
| 角色自拍 (保持身份 + 自然场景) | \`POST /api/generate-character\` | Use \`character-selfie/\` skill |
| 自由生成不涉及人物 | \`POST /api/generate-freestyle\` | N/A |
| 浏览可用模板和风格 | \`GET /api/catalog\` | N/A |

### Template + Character Identity

When the user wants a template applied to ${character.name}:

1. Read \`profile.jpg\` from the workspace as the person reference
2. Convert to base64 data URI
3. Pass \`templateId\` + \`personImages\` to \`POST /api/generate\`
4. ${character.name}'s face is preserved in the template scene

### Style + Character Identity

Same pattern: use \`styleId\` + \`personImages\` from the workspace profile.

## Output Handling

- After a successful API call, the response JSON contains \`data.imageUrl\` — a public HTTPS URL hosted on \`img.tuqu.ai\`
- **Send the remote \`imageUrl\` directly as a media attachment.** Do NOT download it to a local file first — local workspace files are blocked by the runtime media sandbox
- If you need to log or inspect the URL, print it to stdout, but always pass the HTTPS URL (not a local path) when attaching media to a message
- Response also includes \`promptUsed\`, \`model\`, \`remainingBalance\`, \`transactionId\`

## Auto-Update Strategy

The catalog is dynamic. New templates and styles are added regularly.

1. **On first use:** run \`refresh-catalog.sh\` to populate the cache
2. **On subsequent uses:** read the cache; if \`fetchedAt\` is >24h old, refresh first
3. **On user request:** "有什么新模板" → always refresh before answering
4. **On unknown name:** if the user mentions a template/style not in cache, refresh and retry

This ensures ${character.name} always has access to the latest creative options without manual updates.

## Error Handling

| Error | Meaning | Action |
|-------|---------|--------|
| \`INVALID_REQUEST\` | Missing templateId/styleId or personImages | Check params |
| \`INSUFFICIENT_BALANCE\` | Not enough tokens | Tell user to top up |
| \`GENERATION_FAILED\` | Model failed; may auto-refund | Retry or try different model |
| Template/style not found | ID may be outdated | Refresh catalog and retry |
`;
}

function buildRefreshCatalogScript() {
  return `#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_DIR="$WORKSPACE_DIR/tuqu-catalog"
CACHE_FILE="$CATALOG_DIR/catalog-cache.json"
BASE_URL="\${BASE_URL:-https://photo.tuqu.ai}"

mkdir -p "$CATALOG_DIR"

RESPONSE="$(curl -sS "\${BASE_URL}/api/catalog")"

SUCCESS="$(echo "$RESPONSE" | jq -r '.success // false')"
if [[ "$SUCCESS" != "true" ]]; then
  echo "Failed to fetch catalog"
  echo "$RESPONSE"
  exit 1
fi

TEMPLATES="$(echo "$RESPONSE" | jq '[.data.templates[] | {id, name, nameEn: (.nameEn // null), description, category, defaultModel, tags}]')"
STYLES="$(echo "$RESPONSE" | jq '[.data.styles[] | {id, name, nameEn: (.nameEn // null), description, category, defaultModel}]')"
USAGE="$(echo "$RESPONSE" | jq '.data.usage')"
FETCHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \\
  --arg fetchedAt "$FETCHED_AT" \\
  --argjson templates "$TEMPLATES" \\
  --argjson styles "$STYLES" \\
  --argjson usage "$USAGE" \\
  '{fetchedAt: $fetchedAt, templates: $templates, styles: $styles, usage: $usage}' \\
  > "$CACHE_FILE"

T_COUNT="$(echo "$TEMPLATES" | jq 'length')"
S_COUNT="$(echo "$STYLES" | jq 'length')"
echo "Catalog refreshed: $T_COUNT templates, $S_COUNT styles"
echo "Cache saved: $CACHE_FILE"
`;
}

function buildGenerateFreestyleScript() {
  return `#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE="$WORKSPACE_DIR/tuqu_service_key.txt"
BASE_URL="\${BASE_URL:-https://photo.tuqu.ai}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing tuqu_service_key.txt"
  exit 1
fi

TUQU_SERVICE_KEY="$(cat "$KEY_FILE")"
PROMPT="\${1:-}"
RATIO="\${2:-16:9}"
MODEL="\${3:-seedream45}"

if [[ -z "$PROMPT" ]]; then
  echo "Usage: generate-freestyle.sh <prompt> [ratio] [model]"
  echo "  ratio: 16:9, 3:4, 1:1, 9:16 (default: 16:9)"
  echo "  model: seedream45, nanobanana_pro, seedream (default: seedream45)"
  exit 1
fi

RESPONSE="$(curl -sS -X POST "\${BASE_URL}/api/generate-freestyle" \\
  -H "Content-Type: application/json" \\
  -d @- <<JSON
{
  "userKey": "\${TUQU_SERVICE_KEY}",
  "prompt": "\${PROMPT}",
  "resolution": "2K",
  "ratio": "\${RATIO}",
  "model": "\${MODEL}"
}
JSON
)"

printf '%s\\n' "$RESPONSE" > "$WORKSPACE_DIR/.openclaw/last-tuqu-generate-response.json"
TUQU_LOG_WORKSPACE="$WORKSPACE_DIR" zsh "$WORKSPACE_DIR/tuqu-catalog/log-tuqu-call.sh" "/api/generate-freestyle" "POST" "$RESPONSE" "freestyle" 2>/dev/null || true
IMAGE_URL="$(echo "$RESPONSE" | jq -r '.data.imageUrl // empty')"

if [[ -z "$IMAGE_URL" ]]; then
  echo "$RESPONSE"
  exit 1
fi

echo "IMAGE_URL: $IMAGE_URL"
`;
}

function buildGenerateFromCatalogScript() {
  return `#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE="$WORKSPACE_DIR/tuqu_service_key.txt"
PROFILE_FILE="$WORKSPACE_DIR/profile.jpg"
BASE_URL="\${BASE_URL:-https://photo.tuqu.ai}"

MODE="\${1:-}"
CATALOG_ID="\${2:-}"
MODEL="\${3:-}"

if [[ -z "$MODE" || -z "$CATALOG_ID" ]]; then
  echo "Usage: generate-from-catalog.sh <template|style> <id> [model]"
  echo "  mode: template or style"
  echo "  id: templateId or styleId from catalog-cache.json"
  echo "  model: override model (optional, uses template/style default if omitted)"
  exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing tuqu_service_key.txt"
  exit 1
fi

TUQU_SERVICE_KEY="$(cat "$KEY_FILE")"

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Missing profile.jpg"
  exit 1
fi

MIME="$(file --mime-type -b "$PROFILE_FILE")"
PHOTO_BASE64="$(base64 < "$PROFILE_FILE" | tr -d '\\n')"
PHOTO_DATA="data:\${MIME};base64,\${PHOTO_BASE64}"

if [[ "$MODE" == "template" ]]; then
  ID_KEY="templateId"
elif [[ "$MODE" == "style" ]]; then
  ID_KEY="styleId"
else
  echo "Unknown mode: $MODE (use template or style)"
  exit 1
fi

MODEL_ARG=""
if [[ -n "$MODEL" ]]; then
  MODEL_ARG=", \\"model\\": \\"$MODEL\\""
fi

RESPONSE="$(curl -sS -X POST "\${BASE_URL}/api/generate" \\
  -H "Content-Type: application/json" \\
  -d "{ \\"userKey\\": \\"\${TUQU_SERVICE_KEY}\\", \\"\${ID_KEY}\\": \\"\${CATALOG_ID}\\", \\"personImages\\": [\\"\${PHOTO_DATA}\\"], \\"resolution\\": \\"2K\\"$MODEL_ARG }")"

printf '%s\\n' "$RESPONSE" > "$WORKSPACE_DIR/.openclaw/last-tuqu-generate-response.json"
TUQU_LOG_WORKSPACE="$WORKSPACE_DIR" zsh "$WORKSPACE_DIR/tuqu-catalog/log-tuqu-call.sh" "/api/generate" "POST" "$RESPONSE" "$MODE:$CATALOG_ID" 2>/dev/null || true
IMAGE_URL="$(echo "$RESPONSE" | jq -r '.data.imageUrl // empty')"

if [[ -z "$IMAGE_URL" ]]; then
  echo "$RESPONSE"
  exit 1
fi

echo "IMAGE_URL: $IMAGE_URL"
`;
}

function buildCharacterSelfieReadme(character: CharacterRecord) {
  return `# Character Selfie Prep

Prepared for local selfie generation using this workspace's own profile image and role metadata.

- Reference image: ${character.photos[0] ? `workspace profile image (${inferAvatarPath(character.photos[0])})` : "profile.jpg"}
- Expected API base: https://photo.tuqu.ai
- Required file: tuqu_service_key.txt
- Role metadata: .openclaw/character-photo-profile.json

## Create the character

\`\`\`bash
zsh ./character-selfie/create-character.sh
\`\`\`

Save the returned \`data._id\`. The script also writes \`tuqu_character.json\` when successful.

## Generate a selfie

\`\`\`bash
zsh ./character-selfie/generate-selfie.sh "根据当前对话和角色状态写出的 sceneDescription"
\`\`\`

Or pass a custom scene:

\`\`\`bash
zsh ./character-selfie/generate-selfie.sh "前置摄像头自拍构图，在咖啡店窗边，手边放着冰美式，微微侧头看镜头，像刚随手拍完的一张日常自拍"
\`\`\`

Default photo direction:

- Build the scene from current dialogue context plus workspace files
- Use realistic phone-camera language
- Avoid studio or poster aesthetics unless explicitly requested
- For the agent's own 自拍 or角色照片, use this flow instead of writing a freestyle command by hand
- If \`tuqu_character.json\` is missing, \`generate-selfie.sh\` will create the character automatically before generating the image
- The script prints an \`IMAGE_URL:\` line with the remote HTTPS URL. Send that URL directly as a media attachment — do not download locally
- For an ordinary 自拍, frame it like a front-camera shot with no visible phone. Only show the phone if the user explicitly wants a mirror selfie, mirror shot, or phone-in-hand composition
`;
}

function buildCharacterSelfieSkillMd(character: CharacterRecord) {
  return `# Local Character Selfie Fallback

**STOP — Check before using this skill:**

This skill is ONLY for images where ${character.name} appears in frame as a recognizable person. If the user wants a landscape, scenery, food, object, poster, concept art, or any image without ${character.name} in it, use \`tuqu-catalog/generate-freestyle.sh\` instead. Do NOT call \`generate-selfie.sh\` for non-person images.

Use this skill when the user asks ${character.name} for 自拍 or角色照片 where ${character.name} must be visible and recognizable.

## Goal

1. Use this workspace's own \`profile.jpg\` as the face reference
2. Create ${character.name}'s TUQU character if needed
3. Generate selfies via \`/api/generate-character\`

## Required files

- \`tuqu_service_key.txt\`
- \`profile.jpg\`

## Behavior

- Do not ask the user for their own face photo unless they explicitly want images based on their personal face.
- By default, use ${character.name}'s own workspace profile image and role background.
- Do not give the user a menu of photo options unless they explicitly ask for choices.
- Infer one best-fitting selfie direction from the character's own setting, taste, and current context.
- Before generating, compose a fresh \`sceneDescription\` from the current dialogue and workspace context, then pass it into \`generate-selfie.sh\`.
- For ${character.name}'s own 自拍, never skip straight to \`generate-freestyle\`.
- If \`tuqu_character.json\` is missing, create the TUQU character immediately as an internal prerequisite. Do not ask a meta question about it first.
- Then run \`generate-selfie.sh\`, which must use \`/api/generate-character\`.
- After generation, send the remote image URL directly as a media attachment. Do not download to a local file first — local workspace files are blocked by the runtime media sandbox.
- For a normal 自拍, do not put a phone in the image. Default to front-camera framing where the device is out of frame. Only show a phone when the user explicitly asks for 镜自拍, 对镜自拍, or otherwise wants the phone visible.

## Templates & Styles

If the user wants a specific template (证件照, 杂志封面, 黄金圣衣, etc.) or style (吉卜力, 皮克斯3D, 水墨画, etc.), use the \`tuqu-catalog/SKILL.md\` skill instead. It teaches how to discover and apply templates and styles from the live catalog while still using ${character.name}'s profile image.

## Commands

\`\`\`bash
zsh ./character-selfie/create-character.sh
zsh ./character-selfie/generate-selfie.sh
\`\`\`
`;
}

function buildCreateCharacterScript(character: CharacterRecord) {
  const profileImage = inferAvatarPath(character.photos[0] || "/profile.jpg");

  return `#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE="$WORKSPACE_DIR/tuqu_service_key.txt"
PROFILE_FILE="$WORKSPACE_DIR/${profileImage}"
PROFILE_JSON="$WORKSPACE_DIR/.openclaw/character-photo-profile.json"
BASE_URL="\${BASE_URL:-https://photo.tuqu.ai}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing tuqu_service_key.txt"
  exit 1
fi

TUQU_SERVICE_KEY="$(cat "$KEY_FILE")"
if [[ -z "$TUQU_SERVICE_KEY" ]]; then
  echo "Empty TUQU service key"
  exit 1
fi

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Reference image not found: $PROFILE_FILE"
  exit 1
fi

if [[ ! -f "$PROFILE_JSON" ]]; then
  echo "Missing character-photo-profile.json"
  exit 1
fi

MIME="$(file --mime-type -b "$PROFILE_FILE")"
PHOTO_BASE64="$(base64 < "$PROFILE_FILE" | tr -d '\\n')"
PHOTO_DATA="data:\${MIME};base64,\${PHOTO_BASE64}"
NAME="$(jq -r '.name // empty' "$PROFILE_JSON")"
AGE="$(jq -r '.age // empty' "$PROFILE_JSON")"
RACE="$(jq -r '.heritage // empty' "$PROFILE_JSON")"
GENDER="$(jq -r '.gender // empty' "$PROFILE_JSON")"
PROFESSION="$(jq -r '.occupation // empty' "$PROFILE_JSON")"
PERSONALITY="$(jq -r '.personality // empty' "$PROFILE_JSON")"
CLOTHING_STYLE="$(jq -r '.clothingStyle // empty' "$PROFILE_JSON")"
OTHER="$(jq -r '.other // empty' "$PROFILE_JSON")"

RESPONSE="$(curl -sS -X POST "\${BASE_URL}/api/characters" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: \${TUQU_SERVICE_KEY}" \\
  -d @- <<JSON
{
  "name": "\${NAME}",
  "photoBase64": "\${PHOTO_DATA}",
  "description": {
    "age": "\${AGE}",
    "race": "\${RACE}",
    "gender": "\${GENDER}",
    "profession": "\${PROFESSION}",
    "personality": "\${PERSONALITY}",
    "clothingStyle": "\${CLOTHING_STYLE}",
    "other": "\${OTHER}"
  }
}
JSON
)"

CHARACTER_ID="$(echo "$RESPONSE" | jq -r '.data._id // empty')"
TUQU_LOG_WORKSPACE="$WORKSPACE_DIR" zsh "$WORKSPACE_DIR/tuqu-catalog/log-tuqu-call.sh" "/api/characters" "POST" "$RESPONSE" "create-character: $NAME" 2>/dev/null || true
if [[ -n "$CHARACTER_ID" ]]; then
  cat > "$WORKSPACE_DIR/tuqu_character.json" <<JSON
{
  "characterId": "$CHARACTER_ID",
  "characterName": "$NAME"
}
JSON
  printf '%s\n' "$RESPONSE" > "$WORKSPACE_DIR/.openclaw/last-tuqu-character-response.json"
  echo "Created TUQU character: $CHARACTER_ID"
else
  echo "$RESPONSE"
fi
`;
}

function buildGenerateSelfieScript() {
  return `#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE="$WORKSPACE_DIR/tuqu_service_key.txt"
CHARACTER_FILE="$WORKSPACE_DIR/tuqu_character.json"
SELFIE_DIR="$WORKSPACE_DIR/character-selfie"
BASE_URL="\${BASE_URL:-https://photo.tuqu.ai}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing tuqu_service_key.txt"
  exit 1
fi

TUQU_SERVICE_KEY="$(cat "$KEY_FILE")"
SCENE_DESCRIPTION="\${1:-当前对话没有提供具体自拍描述时，基于角色当前状态生成一张真实自然、生活感强的日常照片。}"

ensure_character() {
  if [[ ! -f "$CHARACTER_FILE" ]]; then
    echo "TUQU character missing. Creating one first..."
    zsh "$SELFIE_DIR/create-character.sh"
  fi

  CHARACTER_ID="$(jq -r '.characterId // empty' "$CHARACTER_FILE" 2>/dev/null || true)"
  if [[ -z "$CHARACTER_ID" ]]; then
    echo "TUQU character missing. Creating one first..."
    zsh "$SELFIE_DIR/create-character.sh"
    CHARACTER_ID="$(jq -r '.characterId // empty' "$CHARACTER_FILE" 2>/dev/null || true)"
  fi

  if [[ -z "$CHARACTER_ID" ]]; then
    echo "Missing characterId in tuqu_character.json"
    exit 1
  fi
}

ensure_character

RESPONSE="$(curl -sS -X POST "\${BASE_URL}/api/generate-character" \\
  -H "Content-Type: application/json" \\
  -d @- <<JSON
{
  "userKey": "\${TUQU_SERVICE_KEY}",
  "characterIds": ["\${CHARACTER_ID}"],
  "prompt": "\${SCENE_DESCRIPTION}",
  "resolution": "2K",
  "ratio": "3:4",
  "model": "seedream"
}
JSON
)"

printf '%s\n' "$RESPONSE" > "$WORKSPACE_DIR/.openclaw/last-tuqu-generate-response.json"
TUQU_LOG_WORKSPACE="$WORKSPACE_DIR" zsh "$WORKSPACE_DIR/tuqu-catalog/log-tuqu-call.sh" "/api/generate-character" "POST" "$RESPONSE" "selfie" 2>/dev/null || true
IMAGE_URL="$(echo "$RESPONSE" | jq -r '.data.imageUrl // empty')"

if [[ -z "$IMAGE_URL" ]]; then
  echo "$RESPONSE"
  exit 1
fi

echo "IMAGE_URL: $IMAGE_URL"
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

type CatalogItem = { id: string; name: string; nameEn?: string; description?: string; category?: string; defaultModel?: string; tags?: string[] };
type CatalogCache = { fetchedAt: string; templates: CatalogItem[]; styles: CatalogItem[]; usage?: unknown };

async function fetchTuquCatalog(): Promise<CatalogCache | null> {
  const baseUrl = process.env.TUQU_API_BASE ?? "https://photo.tuqu.ai";
  try {
    const res = await fetch(`${baseUrl}/api/catalog`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { templates?: CatalogItem[]; styles?: CatalogItem[]; usage?: unknown } };
    if (!json.success || !json.data) return null;
    return {
      fetchedAt: new Date().toISOString(),
      templates: (json.data.templates ?? []).map(t => ({ id: t.id, name: t.name, nameEn: t.nameEn, description: t.description, category: t.category, defaultModel: t.defaultModel, tags: t.tags })),
      styles: (json.data.styles ?? []).map(s => ({ id: s.id, name: s.name, nameEn: s.nameEn, description: s.description, category: s.category, defaultModel: s.defaultModel })),
      usage: json.data.usage
    };
  } catch {
    return null;
  }
}

async function installTuquCatalogSkill(character: CharacterRecord, workspacePath: string) {
  const targetRoot = path.join(workspacePath, "tuqu-catalog");
  const logsDir = path.join(workspacePath, "tuqu-logs");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "SKILL.md"), buildTuquCatalogSkillMd(character), "utf8");
  await fs.writeFile(path.join(targetRoot, "refresh-catalog.sh"), buildRefreshCatalogScript(), "utf8");
  await fs.writeFile(path.join(targetRoot, "generate-freestyle.sh"), buildGenerateFreestyleScript(), "utf8");
  await fs.writeFile(path.join(targetRoot, "generate-from-catalog.sh"), buildGenerateFromCatalogScript(), "utf8");
  await fs.writeFile(path.join(targetRoot, "log-tuqu-call.sh"), buildLogTuquCallScript(), "utf8");

  const catalog = await fetchTuquCatalog();
  if (catalog) {
    await fs.writeFile(path.join(targetRoot, "catalog-cache.json"), JSON.stringify(catalog, null, 2), "utf8");
  }
}

function buildTuquRechargeSkillMd() {
  return `# TUQU Recharge - Token Top-Up

Use this skill when the user asks about 充值, 余额, 买点数, recharge, top up, or when image generation fails with INSUFFICIENT_BALANCE.

## CRITICAL — Do Not Just Send A Login URL

**You have the service key. Use it.** Call the Recharge API yourself to:

1. List available plans
2. Generate a payment QR code or checkout link
3. Send the QR code image or payment link directly to the user

Do NOT tell the user to "go to the billing page and log in". That's lazy and unhelpful. The whole point is to make recharging seamless within the conversation.

## API Base

\`https://billing.tuqu.ai/api/v1/recharge\`

Auth: \`Authorization: Bearer <service_key>\` — the key is in \`tuqu_service_key.txt\`.

## Step 1: List Plans And Ask User To Pick

\`\`\`bash
SERVICE_KEY="$(cat tuqu_service_key.txt)"
curl -s -H "Authorization: Bearer $SERVICE_KEY" \\
  https://billing.tuqu.ai/api/v1/recharge/plans | jq '.data.plans'
\`\`\`

Each plan returns: \`id\`, \`name\`, \`priceAmount\` (smallest currency unit), \`priceCurrency\`, \`tokenGrant\`, \`bonusToken\`.

Present plans readably and ask the user which one they want:

> 有这些充值方案：
> 1. 20点送5点 — ¥14（共 25 点）
> 2. 50点送15点 — ¥35（共 65 点）
>
> 要充哪个？微信扫码还是信用卡？

Convert \`priceAmount\` from smallest unit: divide by 100 for USD/CNY, by 1 for JPY.

## Step 2: Generate Payment — Call The API

Once the user picks a plan and payment method, immediately call the API to generate the payment.

### WeChat Pay → QR code

\`\`\`bash
RESPONSE=$(curl -s -X POST \\
  -H "Authorization: Bearer $SERVICE_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{\\"planId\\": \\"<PLAN_ID>\\"}" \\
  https://billing.tuqu.ai/api/v1/recharge/wechat)
echo "$RESPONSE" | jq -r '.data.qrcodeImg'
\`\`\`

- \`qrcodeImg\`: base64 PNG image — **send this image directly to the user** so they can scan it with WeChat
- \`payUrl\`: link to Unifpay payment page — can also send as fallback
- USD plans are auto-converted to CNY

**Send the QR code image as a media attachment.** The user scans it with WeChat and pays. Done.

### Stripe → Checkout link

\`\`\`bash
RESPONSE=$(curl -s -X POST \\
  -H "Authorization: Bearer $SERVICE_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{\\"planId\\": \\"<PLAN_ID>\\"}" \\
  https://billing.tuqu.ai/api/v1/recharge/stripe)
echo "$RESPONSE" | jq -r '.data.checkoutUrl'
\`\`\`

- \`checkoutUrl\`: Stripe Checkout page URL — **send this link to the user**
- \`qrcodeImg\`: QR code of the checkout URL — can also send as image

**Send the checkout link directly.** The user clicks it, pays with credit card. Done.

## Step 3: After Payment

Tokens arrive automatically via webhook. Tell the user:

> 充好了的话跟我说一声，我马上帮你继续！

If the user confirms payment but generation still fails with INSUFFICIENT_BALANCE, wait ~10 seconds and retry. Webhook processing is usually instant but can occasionally take a moment.

## Tone

Casual and friendly. Don't make the user feel awkward. Keep it conversational:

> 点数用完啦～我来帮你充，有这些方案：…

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| \`PAYMENT_NOT_CONFIGURED\` | This payment method isn't set up | Try the other method (WeChat ↔ Stripe) |
| \`CURRENCY_NOT_SUPPORTED\` | Plan currency not supported by channel | Try the other method |
| \`NOT_FOUND\` | Plan doesn't exist | Re-fetch plans |
| \`UNAUTHORIZED\` | Bad service key | Check \`tuqu_service_key.txt\` |
`;
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

async function installTuquRechargeSkill(workspacePath: string) {
  const targetRoot = path.join(workspacePath, "tuqu-recharge");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "SKILL.md"), buildTuquRechargeSkillMd(), "utf8");
}

async function installGatewayRecoverySkill(workspacePath: string) {
  const targetRoot = path.join(workspacePath, "openclaw-gateway-recovery");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "SKILL.md"), buildGatewayRecoverySkillMd(), "utf8");
}

async function installCharacterSelfieFallback(character: CharacterRecord, workspacePath: string) {
  const targetRoot = path.join(workspacePath, "character-selfie");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "README.md"), buildCharacterSelfieReadme(character), "utf8");
  await fs.writeFile(path.join(targetRoot, "SKILL.md"), buildCharacterSelfieSkillMd(character), "utf8");
  await fs.writeFile(path.join(targetRoot, "create-character.sh"), buildCreateCharacterScript(character), "utf8");
  await fs.writeFile(path.join(targetRoot, "generate-selfie.sh"), buildGenerateSelfieScript(), "utf8");
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
  const characterSelfieDir = path.join(workspacePath, "character-selfie");
  const tuquCatalogDir = path.join(workspacePath, "tuqu-catalog");
  const generatedDir = path.join(workspacePath, "generated");

  await fs.mkdir(avatarsDir, { recursive: true });
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(openclawDir, { recursive: true });
  await fs.mkdir(characterSelfieDir, { recursive: true });
  await fs.mkdir(tuquCatalogDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });

  await writeWorkspaceFiles(character, workspacePath);
  await installCharacterSelfieFallback(character, workspacePath);
  await installTuquCatalogSkill(character, workspacePath);
  await installTuquRechargeSkill(workspacePath);
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

  await installTuquCatalogSkill(character, character.workspacePath);
  await installCharacterSelfieFallback(character, character.workspacePath);
  await installTuquRechargeSkill(character.workspacePath);
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
