<p align="center">
  <img src="public/openclaw-friends-logo.png" alt="OpenClaw Friends" width="480" />
</p>

<p align="center">
  <a href="./README.md">中文</a> | <a href="./README.en.md">English</a> | 日本語
</p>

<h1 align="center">OpenClaw Friends — Character Designer</h1>

<p align="center">
  少ない入力で OpenClaw 用キャラを強く補完する AI キャラ作成ツール<br/>
  少量の高シグナル情報を集め、LLM でそのまま保存できる OpenClaw キャラパッケージを生成<br/>
  Workspace 同期後は OpenClaw プラットフォームへ登録され、Discord Bot の実行とメッセージルーティングを引き継ぎます
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/OpenAI-Responses_API-412991?logo=openai" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white" alt="Discord.js" />
</p>

---

## できること

- ステップ形式でキャラを作成・編集
- `私の情報` と `私たちの関係` を分離して管理
- `IDENTITY.md` / `SOUL.md` / `USER.md` / `MEMORY.md` を生成
- OpenClaw workspace の作成・更新・既存 workspace の取り込み
- OpenClaw への自動登録による Discord Bot 実行引き継ぎ
- TuQu AI による自撮り・ポートレート・シーン画像生成
- UI 言語とキャラ出力言語として中国語・英語・日本語をサポート

---

## デモ

キャラを作成して OpenClaw に登録すると、Discord 上では独立した Bot として登場します。

<p align="center">
  <img src="public/chat1.jpg" alt="Discord デモ 1" width="600" />
</p>

<p align="center">
  <img src="public/chat2.jpg" alt="Discord デモ 2" width="600" />
</p>

<p align="center">
  <img src="public/chat3.jpg" alt="Discord デモ 3" width="600" />
</p>

自然に会話し、写真を送り、文脈を覚えつつ、安定した人格を保てます。

---

## 前提条件

| 依存 | バージョン | 説明 |
|------|------|------|
| Node.js | v18+ | v22 LTS 推奨 |
| npm | v9+ | Node.js 同梱 |
| Git | 任意 | リポジトリ取得用 |
| OpenAI API Key | フォールバック用 | OpenClaw Gateway / `designer-llm` が使えない場合に利用 |
| TuQu Service Key | 任意 | 画像生成に必要、[登録はこちら](https://billing.tuqu.ai/dream-weaver/login) |
| OpenClaw CLI | 任意 | Discord Bot 実行を OpenClaw に引き継がせる場合に必要 |

---

## セットアップ

### 1. クローン

```bash
git clone git@github.com:zhouyi531/openclaw-friends.git
cd openclaw-friends
```

### 2. 依存インストール

```bash
npm install
```

### 3. 環境変数

```bash
cp .env.example .env
```

例:

```dotenv
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4.1
OPENCLAW_WORKSPACE_ROOT=
OPENCLAW_HOME=
```

| 変数 | 用途 | 既定値 |
|------|------|------|
| `OPENAI_API_KEY` | ブループリント生成のフォールバック用 OpenAI キー | OpenClaw Gateway がなければ必須 |
| `OPENAI_MODEL` | 使用モデル | `gpt-4.1` |
| `OPENCLAW_WORKSPACE_ROOT` | Workspace 生成先 | `~/.openclaw` |
| `OPENCLAW_HOME` | OpenClaw 設定ディレクトリ | `~/.openclaw` |

### 4. 起動

```bash
npm run dev
```

`http://localhost:3000` を開きます。

### その他のコマンド

```bash
npm run build
npm run start
npm run lint
```

---

## 基本フロー

### 1. キャラ情報

入力内容:

- 名前、年齢、性別、職業、背景
- 世界観
- キャラコンセプト
- 性格軸
- キャラ言語
- キャラ写真

### 2. 私の情報 + 関係設定

アプリ上では次の 2 つを分離しています。

- `私の情報`: グローバルに自動保存されるユーザープロファイル
- `私たちの関係`: 現在のキャラ専用設定

### 3. ブループリント生成 + Workspace 同期

最初のステップで「次へ」を押すと:

1. キャラ保存
2. ブループリント生成
3. 対応 workspace の作成または更新

生成ファイル:

- `IDENTITY.md`
- `SOUL.md`
- `USER.md`
- `MEMORY.md`

### 4. Discord 設定

保存するもの:

- Server ID
- Channel ID
- User ID
- Bot token

### 5. TuQu 設定

設定するもの:

- TuQu Service Key
- TuQu Character ID

設定後は、チャット内で自撮りやポートレートを生成できます。

---

## OpenClaw 連携

[OpenClaw CLI](https://github.com/nicepkg/openclaw) が入っていれば、アプリは Gateway の利用可否を確認します。

- Gateway が使える場合: OpenClaw の `designer-llm` を優先使用
- 使えない場合: OpenAI Responses API へフォールバック

Workspace を同期し Discord 設定も保存済みなら、アプリは OpenClaw 登録を更新し、プラットフォーム側で:

- Discord Bot ログイン
- キャラごとのメッセージルーティング
- workspace 分離
- 同一サーバー / 同一チャンネルでの複数キャラ運用

が可能になります。

例:

```text
@幸子 今日なに着ればいい？
@アキ このコード見て
```

---

## プロジェクト構成

```text
├── app/                       # Next.js app router, API, pages
├── components/                # メイン UI
├── lib/                       # データ層、LLM 連携、Discord 実行、workspace ロジック
├── locales/                   # UI 翻訳
├── data/                      # 実行時データ（gitignore）
├── docs/                      # 補助ドキュメント
├── public/                    # 静的アセット
├── scripts/                   # 補助スクリプト
├── instrumentation.ts         # OpenClaw Gateway 確認用の起動フック
└── README*.md                 # 多言語 README
```

---

## 実行時データ

| 内容 | 場所 | Git 管理 |
|------|------|------|
| キャラデータ | `data/characters.json` | なし |
| ユーザープロファイル | `data/user-profile.json` | なし |
| Discord 設定 | `data/discord-config.json` | なし |
| 実行時ロック | `data/discord-runtime-locks/` | なし |
| アップロード画像 | `public/uploads/` | なし |
| OpenClaw workspace | `~/.openclaw/` または `OPENCLAW_WORKSPACE_ROOT` | リポジトリ外 |

---

## ドキュメント

`docs/` 配下の詳細ドキュメントは現在主に中国語です。

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

- Discord: [TuQu AI 公式 Discord に参加](https://discord.gg/Y5EExWtP)

## License

MIT
