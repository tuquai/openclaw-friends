# OpenClaw 平台接管流程

OpenClaw 平台在系统中有两个介入点：**注册接管**和**启动拦截**。

---

## 介入点一：注册 — 把角色交给 OpenClaw 平台管理

### 触发时机

用户在 Designer 点击 **"同步 OpenClaw Workspace"** 时，`POST /api/workspaces/create` 在创建完 workspace 之后，会自动尝试注册到 OpenClaw：

```
createWorkspaceFromCharacter(character)
  → updateCharacter(...)
  → registerCharacterInOpenClaw(updated)   // 自动触发
```

条件是角色已配置了 Discord 的 `channelId` 和 `userId`。注册失败不会阻断 workspace 创建，只是错误信息会返回给前端。

### 注册写入的四块数据

`registerCharacterInOpenClaw()` 读写 `~/.openclaw/openclaw.json`（OpenClaw 平台的全局配置），一次性写入：

#### 1. agents.list — 注册 agent

```json
{
  "id": "xingzi-89ae2c57",
  "name": "xingzi-89ae2c57",
  "workspace": "/path/to/workspace",
  "agentDir": "~/.openclaw/agents/xingzi-89ae2c57/agent",
  "identity": { "name": "幸子", "theme": "...", "avatar": "profile.png" },
  "tools": { "elevated": { "enabled": true, "allowFrom": { "discord": ["userId"] } } }
}
```

告诉 OpenClaw："有一个 agent，它的 workspace 在哪、identity 是什么、谁有权限使用高级工具"。

#### 2. bindings — 消息路由规则

注册两条 binding：

- 来自指定用户的 **DM 私信** → 路由到这个 agent
- 来自指定 **频道** 的消息 → 路由到这个 agent

```json
[
  { "agentId": "xingzi-89ae2c57", "match": { "channel": "discord", "accountId": "...", "peer": { "kind": "dm", "id": "userId" } } },
  { "agentId": "xingzi-89ae2c57", "match": { "channel": "discord", "accountId": "...", "peer": { "kind": "channel", "id": "channelId" }, "guildId": "..." } }
]
```

这是 OpenClaw 版的 `resolveBoundCharacter()`——平台用自己的路由逻辑替代 Designer 的角色匹配。

#### 3. channels.discord.accounts — Discord 账号配置

```json
{
  "accountId": {
    "name": "幸子",
    "enabled": true,
    "token": "botToken",
    "allowFrom": ["userId"],
    "guilds": { "guildId": { "users": [...], "channels": { "channelId": { "allow": true, "requireMention": false, "users": [...] } } } },
    "execApprovals": { "enabled": true, "approvers": ["userId"], "agentFilter": ["agentId"] }
  }
}
```

把 bot token 写进平台配置，OpenClaw 就可以自己登录 Discord、管理 Bot 生命周期。

#### 4. tools.elevated — 全局工具权限

```json
{ "elevated": { "enabled": true, "allowFrom": { "discord": ["userId"] } } }
```

---

## 介入点二：启动拦截 — 防止 Designer 与平台冲突

注册完之后，accountId 出现在 `openclaw.json` 的 `bindings` 里。当用户再在 Designer 点"启动 Bots"时：

```
startDiscordRuntime(accountId, force)
  → readOpenClawManagedAccountIds()          // 扫描 openclaw.json bindings
  → 过滤掉已被 OpenClaw 接管的 accountId
  → 如果全部被接管且 force 为 false → 抛错: "这些 Discord 账号已经由 OpenClaw 接管"
```

`readOpenClawManagedAccountIds()` 从 `openclaw.json` 的 bindings 中提取所有 `channel === "discord"` 的 accountId。如果一个 accountId 已被 OpenClaw 接管，Designer 默认跳过它——避免同一个 bot token 被两边同时 login 导致冲突。

Designer 前端默认传 `force: true`，所以用户强制点按钮时仍然可以覆盖启动（调试用）。

---

## 完整生命周期

```
                    Designer（本地开发/调试）
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
 1. 配置角色         2. 绑定 Discord       3. 启动 Bots
    │                    │                    │
    │                    ▼                    ▼
    │              discord-config.json    discord.js Client
    │              (botToken, channelId)  (本地 WebSocket)
    │                    │
    ▼                    ▼
 4. 同步 Workspace ──→ 5. 自动注册 OpenClaw
                         │
                         ▼
                    ~/.openclaw/openclaw.json
                    ┌─ agents.list      (agent 定义)
                    ├─ bindings         (消息路由: DM + channel)
                    ├─ channels.discord (bot token + guild 权限)
                    └─ tools.elevated   (用户权限)
                         │
                         ▼
              6. OpenClaw 平台接管
                    ├── 平台自己登录 bot token
                    ├── 平台自己路由消息到 agent
                    └── Designer 启动 Bots 时自动跳过已接管账号
                         │
                         ▼
              7. Designer 的 force: true
                    可以覆盖接管，强制本地启动（调试场景）
```

Designer 是开发阶段的调试工具，负责创建角色和本地测试。一旦 workspace 同步完成并自动注册到 OpenClaw，平台就接管了 bot 的运行，Designer 会主动退让避免冲突。`force: true` 是给开发者留的后门。

---

## 关键文件

| 文件 | 职责 |
|------|------|
| `lib/openclaw-register.ts` | `registerCharacterInOpenClaw()` — 写入 openclaw.json 四块数据 |
| `app/api/openclaw/register/route.ts` | 独立注册 API（手动触发） |
| `app/api/workspaces/create/route.ts` | 创建 workspace 后自动调用注册 |
| `lib/discord-runtime.ts` | `readOpenClawManagedAccountIds()` — 启动时检查接管状态 |
| `~/.openclaw/openclaw.json` | OpenClaw 平台全局配置（agents、bindings、channels、tools） |
