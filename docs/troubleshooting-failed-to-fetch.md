# Failed to fetch after "生成详情并同步 Workspace"

## 症状
- 点击设计器底部按钮“下一步：生成详情并同步 Workspace”立刻报错“Failed to fetch”。
- 浏览器 Network 面板显示 `POST /api/characters` 没有响应体，连接直接被服务器关闭。

## 根因
- Node.js 端点 `app/api/characters` 在创建角色时调用 `crypto.randomUUID()`，但 `crypto` 没有在该模块里显式导入。
- 在线上 Node 运行时（尤其是 Bun / Edge / 旧版本 Node）不会默认暴露全局 `crypto` 对象，导致请求还没写入响应就抛出 `ReferenceError: crypto is not defined`，从而让浏览器看到“Failed to fetch”。

## 修复
- 在 `lib/data.ts`、`lib/workspace.ts` 和 `app/api/upload/route.ts` 中统一从 `node:crypto` 导入 `randomUUID`，替换所有 `crypto.randomUUID()` 的调用。
- 任何需要生成 ID 或上传文件名的服务端模块都应显式导入 `randomUUID`，避免依赖隐式全局对象。

## 回归测试
1. 重新启动 `pnpm dev`。
2. 在设计器中填写角色信息，点击“下一步：生成详情并同步 Workspace”。
3. 确认浏览器网络请求 `POST /api/characters` 返回 201/200，并继续触发后续步骤，不再出现“Failed to fetch”。
