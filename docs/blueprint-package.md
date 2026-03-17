# Blueprint Package

这个项目现在把角色创建拆成三步：

1. `Draft`
用户原始输入：基础资料、照片、MBTI、关系问卷。

2. `Blueprint Package`
由 OpenAI Responses API 生成的中间结果，但它不是抽象摘要，而是可直接落盘的角色包。里面同时包含：

- 结构化字段：给 UI 预览和后续编辑
- `files.*`：最终将写入 OpenClaw workspace 的 markdown 正文

3. `Workspace Create`
程序只做确定性的文件系统动作：

- `mkdir`
- 写入 `IDENTITY.md` / `SOUL.md` / `USER.md` / `MEMORY.md`
- 创建 `memory/`、`.openclaw/`
- 拷贝首张角色照片作为头像
- 生成固定的 `AGENTS.md`、`TOOLS.md`、`HEARTBEAT.md`、`workspace-state.json`

默认创建到 `~/.openclaw/workspace-<slug>-<id>/`，也可以通过 `OPENCLAW_WORKSPACE_ROOT` 指定别的位置。

如果角色上传了主照片，创建时会按原始扩展名写成根目录下的 `profile.<ext>`，而不是强制转成 `jpeg`。

## 为什么这样拆

好处有三点：

- 用户在创建前就能预览最终文件内容
- 创建动作不再依赖 LLM，失败面更小
- 文件格式可以由程序保持稳定，而角色内容由模型负责

## Prompt 要求

Responses API 的 instruction 重点是：

- 不要过度写 lore
- 用少量高信号细节建立真实感
- 关系要来自双方信息的推断，不是简单标签
- 不要写元叙事
- `files.*` 必须已经是最终 markdown 正文
- 如果信息不足，要保守补全，并把缺口写进 `followups`
