<p align="center">
  <img src="public/openclaw-friends-logo.png" alt="OpenClaw Friends" width="480" />
</p>

<h1 align="center">OpenClaw Character Designer</h1>

<p align="center">
  轻输入、强补全的 AI 角色创建工具<br/>
  收集少量高信号信息，通过 LLM 生成可直接落盘的 OpenClaw 角色包<br/>
  同步 Workspace 后自动注册到 OpenClaw 平台，由平台接管 Discord Bot 的运行和消息路由
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/OpenAI-Responses_API-412991?logo=openai" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white" alt="Discord.js" />
</p>

---

## 功能概览

- **角色管理** — 创建、编辑、列表，内置 seed 角色可开箱即用
- **照片上传** — 上传角色主照片，自动同步到 workspace 头像
- **MBTI 快速预设** — 用 MBTI 给角色奠定人格底色
- **用户关系问卷** — 收集双方信息，让 LLM 推断更真实的关系叙事
- **Blueprint 生成** — 通过 OpenAI Responses API 生成角色包（IDENTITY / SOUL / USER / MEMORY）
- **Workspace 同步 + OpenClaw 注册** — 一键生成 workspace 并注册到 OpenClaw，平台自动管理 Bot 运行和 @mention 路由
- **TUQU 图片生成** — 角色自拍、场景照片等图片生成能力
- **本地调试 Bot** — 内置 discord.js + OpenAI 的本地 Bot，仅用于开发调试

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | （必填） |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4.1` |
| `OPENCLAW_WORKSPACE_ROOT` | Workspace 根目录 | `~/.openclaw` |
| `OPENCLAW_HOME` | OpenClaw 配置目录 | `~/.openclaw` |

### 启动

```bash
npm run dev
```

打开 `http://localhost:3000`

## 项目结构

```
├── app/
│   ├── page.tsx                          # 首页，渲染 DesignerApp
│   ├── layout.tsx                        # 根 layout
│   ├── globals.css                       # 全局样式
│   └── api/
│       ├── blueprint/files/route.ts      # Blueprint markdown 读写
│       ├── characters/
│       │   ├── route.ts                  # 角色 CRUD
│       │   └── [id]/avatar/route.ts      # 角色头像
│       ├── compose/route.ts              # OpenAI 生成角色包
│       ├── discord/
│       │   ├── config/route.ts           # Discord 运行时配置
│       │   ├── link/route.ts             # 角色-Discord 绑定
│       │   └── runtime/route.ts          # Bot 启动/停止/状态
│       ├── openclaw/register/route.ts    # OpenClaw 平台注册
│       ├── tuqu/
│       │   ├── character/route.ts        # TUQU 角色图片
│       │   └── config/route.ts           # TUQU 配置
│       ├── upload/route.ts               # 照片上传
│       └── workspaces/
│           ├── create/route.ts           # 创建 workspace
│           └── sync-skills/route.ts      # 同步技能
├── components/
│   └── designer-app.tsx                  # Designer 主 UI 组件
├── lib/
│   ├── data.ts                           # 角色数据读写
│   ├── discord-account.ts                # Discord 账号工具
│   ├── discord-config.ts                 # Discord 配置读写
│   ├── discord-runtime.ts                # Bot 生命周期与消息处理
│   ├── mbti.ts                           # MBTI 选项与推断
│   ├── openai.ts                         # OpenAI API 封装
│   ├── openclaw-register.ts              # OpenClaw 注册流程
│   ├── tuqu.ts                           # TUQU 图片 API
│   ├── types.ts                          # 共享类型定义
│   └── workspace.ts                      # Workspace 管理
├── data/                                 # 运行时数据（gitignored）
├── docs/                                 # 项目文档
├── public/                               # 静态资源
└── scripts/
    └── sync-skills.ts                    # 技能同步脚本
```

## 数据存储

| 内容 | 位置 | 是否入库 |
|------|------|----------|
| 角色数据 | `data/characters.json` | 否（gitignored） |
| Discord 配置 | `data/discord-config.json` | 否（gitignored） |
| 运行时锁 | `data/discord-runtime-locks/` | 否（gitignored） |
| 上传图片 | `public/uploads/` | 否（gitignored） |
| OpenClaw workspace | `~/.openclaw/` (或 `OPENCLAW_WORKSPACE_ROOT`) | 项目外部 |

## 文档

- [工作流程](docs/工作流程.md) — Designer 启动 Discord Bot 完成对话的完整流程
- [OpenClaw 接管流程](docs/openclaw-接管流程.md) — OpenClaw 平台如何注册接管角色 Bot 及启动拦截机制
- [Blueprint Package](docs/blueprint-package.md) — 角色包的三步生成流程与设计理由
- [Xingzi Analysis](docs/xingzi-analysis.md) — 基于 seed 角色的设计方法论分析

## 设计理念

内置 seed 角色的有效点不在厚重 lore，而在持续稳定的小信号：

1. 明确且稳定的语气
2. 清楚的偏好领域
3. 情绪习惯与关系敏感度
4. 明确的反元叙事边界
5. 通过用户信息生成更具体的关系叙事

产品优先做"轻输入 + 强补全"，而不是一开始让用户填几十个字段。

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Runtime**: Node.js
- **LLM**: OpenAI Responses API
- **Discord**: discord.js v14
- **Image**: TUQU API
- **Language**: TypeScript
