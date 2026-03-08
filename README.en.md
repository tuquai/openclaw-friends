<p align="center">
  <img src="public/openclaw-friends-logo.png" alt="OpenClaw Friends" width="480" />
</p>

<p align="center">
  <a href="./README.md">中文</a> | English | <a href="./README.ja.md">日本語</a>
</p>

<h1 align="center">OpenClaw Friends — Character Designer</h1>

<p align="center">
  A lightweight but high-completion AI character builder for OpenClaw<br/>
  Collect a small amount of high-signal input, then generate an OpenClaw-ready character package with an LLM<br/>
  After syncing the workspace, the character is registered to the OpenClaw platform, which takes over Discord bot runtime and message routing
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/OpenAI-Responses_API-412991?logo=openai" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white" alt="Discord.js" />
</p>

---

## Tutorial Videos

- Bilibili: [`BV1wkNMzsE5v`](https://www.bilibili.com/video/BV1wkNMzsE5v/?spm_id_from=333.1007.top_right_bar_window_history.content.click)

---

## What It Does

- Create and edit AI characters with a step-by-step setup flow
- Keep user profile and per-character relationship settings separate
- Generate `IDENTITY.md`, `SOUL.md`, `USER.md`, and `MEMORY.md`
- Sync or import OpenClaw workspaces
- Register characters to OpenClaw so the platform can run and route Discord bots
- Generate selfies / portraits / scene photos through TuQu AI
- Support Chinese, English, and Japanese for both UI and character output

---

## Demo

After a character is created and registered to OpenClaw, it appears in Discord as its own bot identity.

<p align="center">
  <img src="public/chat1.jpg" alt="Discord chat demo 1" width="600" />
</p>

<p align="center">
  <img src="public/chat2.jpg" alt="Discord chat demo 2" width="600" />
</p>

<p align="center">
  <img src="public/chat3.jpg" alt="Discord chat demo 3" width="600" />
</p>

The character can chat naturally, send selfies, remember context, and stay behaviorally consistent over time.

---

## Prerequisites

| Dependency | Version | Notes |
|------|------|------|
| Node.js | v18+ | v22 LTS recommended |
| npm | v9+ | Bundled with Node.js |
| Git | any | For cloning the repo |
| OpenAI API Key | optional fallback | Used when OpenClaw Gateway / `designer-llm` is unavailable |
| TuQu Service Key | optional | Required for image generation, [register here](https://billing.tuqu.ai/dream-weaver/login) |
| OpenClaw CLI | optional | Needed if you want OpenClaw to take over Discord bot runtime |

---

## Setup

### 1. Clone

```bash
git clone git@github.com:zhouyi531/openclaw-friends.git
cd openclaw-friends
```

### 2. Install

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Example:

```dotenv
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4.1
OPENCLAW_WORKSPACE_ROOT=
OPENCLAW_HOME=
```

| Variable | Purpose | Default |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI key for blueprint generation fallback | required unless OpenClaw Gateway is available |
| `OPENAI_MODEL` | Model name | `gpt-4.1` |
| `OPENCLAW_WORKSPACE_ROOT` | Root directory for generated workspaces | `~/.openclaw` |
| `OPENCLAW_HOME` | OpenClaw config directory | `~/.openclaw` |

### 4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### Other commands

```bash
npm run build
npm run start
npm run lint
```

---

## Workflow

### 1. Character Info

Fill in:

- Name, age, gender, occupation, background
- World setting
- Character concept
- Personality axes
- Character language
- Character photos

### 2. My Info + Relationship

The app separates:

- `My Info`: reusable user profile, auto-saved globally
- `Our Relationship`: per-character relationship settings only

### 3. Generate Blueprint + Sync Workspace

On step one, clicking next will:

1. Save the character
2. Generate the blueprint package
3. Create or update the matching workspace

Generated files:

- `IDENTITY.md`
- `SOUL.md`
- `USER.md`
- `MEMORY.md`

### 4. Discord Setup

Save:

- Server ID
- Channel ID
- User ID
- Bot token

### 5. TuQu Setup

Configure:

- TuQu Service Key
- TuQu Character ID

Once configured, the character can generate selfies, portraits, and scene images in chat.

---

## OpenClaw Integration

If [OpenClaw CLI](https://github.com/nicepkg/openclaw) is installed, the app checks whether the Gateway is available.

- Gateway available: blueprint generation prefers OpenClaw `designer-llm`
- Gateway unavailable: falls back to OpenAI Responses API

When a workspace is synced and Discord is configured, the app updates OpenClaw registration so the platform can:

- log the bot into Discord
- route messages to the right character agent
- isolate character workspaces
- support multiple characters in the same Discord server/channel

Example:

```text
@Xingzi what should I wear today?
@Aki help me review this code
```

---

## Project Structure

```text
├── app/                       # Next.js app router, APIs, pages
├── components/                # Main UI
├── lib/                       # Data layer, LLM integration, Discord runtime, workspace logic
├── locales/                   # UI translations
├── data/                      # Runtime data (gitignored)
├── docs/                      # Additional docs
├── public/                    # Static assets
├── scripts/                   # Utility scripts
├── instrumentation.ts         # Startup hook for OpenClaw Gateway checks
└── README*.md                 # Multilingual readmes
```

---

## Runtime Data

| Content | Location | Tracked in Git |
|------|------|------|
| Character data | `data/characters.json` | No |
| User profile | `data/user-profile.json` | No |
| Discord config | `data/discord-config.json` | No |
| Runtime locks | `data/discord-runtime-locks/` | No |
| Uploaded images | `public/uploads/` | No |
| OpenClaw workspaces | `~/.openclaw/` or `OPENCLAW_WORKSPACE_ROOT` | Outside repo |

---

## Docs

Current detailed docs in `docs/` are still primarily Chinese:

- [工作流程](docs/工作流程.md)
- [OpenClaw 接管流程](docs/openclaw-接管流程.md)
- [Blueprint Package](docs/blueprint-package.md)
- [Xingzi Analysis](docs/xingzi-analysis.md)

---

## Tech Stack

- Framework: Next.js 15
- Runtime: Node.js 18+
- Language: TypeScript 5.8
- LLM: OpenAI Responses API
- Discord: discord.js v14
- Image generation: [TuQu AI](https://billing.tuqu.ai/dream-weaver/login)

---

## Community

- Discord: [Join the TuQu AI official Discord](https://discord.gg/Y5EExWtP)

## License

MIT
