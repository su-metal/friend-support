# となりの手

家族や友人など、身近な人同士で一時的な生活支援の予定と担当を調整するサービス。

- 公開URL: https://friend-support.tossy104104.workers.dev
- Firebase: `support-circle-31a09` / Firestore Native / asia-northeast1
- Next.js 16 + React + TypeScript、OpenNext、Cloudflare Workers
- 主催者: Firebase Email Link。支援者: 登録不要、名前だけで担当可能
- Phase 1の主要機能とPhase 2〜6の拡張基盤。通知メールの実配信は接続待ち

## Codex / Claude Codeで開発する

両ツールで同じプロジェクトフォルダーを開き、次の共通ファイルを読む。

- `AGENTS.md`：開発・運用ルール
- `docs/requirements_definition.md`：最新の要件の正本
- `docs/development-handoff.md`：直近の変更・検証・残作業

Claude Code用の `CLAUDE.md` は、上記3ファイルを `@path` 形式で直接インポートする。仕様のコピーを別管理せず、更新した正本を次のセッションでも読み込む。[Claude Code公式のインポート仕様](https://code.claude.com/docs/en/memory#import-additional-files)

Claude Codeはこのフォルダーで新しいセッションを開き、`/context` でMemory filesの読み込みを確認する。すでに開いていたセッションでは、更新した共通ファイルを読み直してから再開する。共通の開始指示例：

```text
AGENTS.md、docs/requirements_definition.md、docs/development-handoff.mdを読んで、現在の実装と残作業を確認してから開発を進めてください。
```

作業後は引き継ぎ記録を更新する。仕様変更は要件書とAGENTS.mdへ同時に反映する。原案のSupabase / Vercel指定や未提供の将来機能を現在の要件として実装しない。

`npm run docs:check` で共通入口・インポート・文書参照を確認できる。仕様の意味や、実際のClaude Codeの読み込み・本番動作は別に確認する。

## ローカルで動かす

Node.js 22以降とnpmを利用する。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

http://127.0.0.1:3000 を開く。`APP_MODE=demo` とlocalhostの組合せだけでデモを有効にする。データはプロセス内に保存され、再起動で消える。公開環境のデモ認証は無効。`/demo` は見本で、実際の担当登録を行わない。

## 検証

```powershell
npm run docs:check
npm run typecheck
npm run lint
npm run test
npm run test:db
npx playwright install chromium --only-shell
npm run test:e2e
npm run build:cloudflare
```

FirestoreエミュレーターにはJava 21以降が必要。`test:db` は `demo-friend-support` のローカルエミュレーターだけを対象にする。E2Eは375/390/430pxの実ブラウザーで実行する。画像は `output/playwright/`。

制限された実行環境でFirebase CLIがユーザーフォルダーのconfigstore読み取りにEPERMを返す場合は、テスト用PowerShellプロセス内で設定ディレクトリを分けて実行できる。通常のFirebaseログイン・デプロイとは別のプロセスで使う。

```powershell
$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.local-test-tools/config'
npm run test:db
```

`.local-test-tools/` はGit対象外。今回の実行結果と初回のDB競合テスト失敗は `docs/development-handoff.md` に記録している。

## Firebaseとデプロイ

DBはブラウザーから直接操作せず、サーバーのRESTアダプター経由で操作する。Firebase Rulesは直接アクセスを全拒否。サーバーはIAM経由なので、サービス層の認可が必須。

- `friend-support-worker` に `roles/datastore.user` と専用ロールの `firebaseauth.users.get` / `firebaseauth.users.createSession` を付与済み。
- Email Linkを有効化し、公開Workerの認証許可ドメインを設定済み。
- `APP_SECRET`、`CRON_SECRET`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY` はCloudflare Secretsに保存済み。
- Firebase Web SDKの公開設定はビルド時に `.env.local` の `NEXT_PUBLIC_FIREBASE_*` へ設定する。公開APIキーは秘密キーではない。
- サーバーの実運用モード・プロジェクト・URLは `wrangler.jsonc`。環境変数の誤設定でデモ認証を本番へ開放しない。

```powershell
npx firebase deploy --only firestore --project support-circle-31a09 --non-interactive
npx tsx scripts/migrate.ts
npm run cf:typegen
npm run deploy
```

`scripts/migrate.ts` はカテゴリ・テンプレートだけをバージョン付きで初期化する。サンプル家族は本番DBへ投入しない。移行スクリプトはローカルの `.secrets/cloudflare.json` を参照する。秘密情報はGit対象外で、内容をログに出さない。デプロイは `--keep-vars` で既存の変数を保持する。

`scripts/provision-firebase.mjs` はサービスアカウント、IAM、秘密キー、Auth設定を変更するため、通常のデプロイでは実行しない。今回はユーザーの明示許可で一度実行した。

## 通知メールの接続

支援の担当確認・主催者通知・キャンセル通知・前日/当日通知は、暗号化outboxとResend用EmailProviderを実装済み。実配信には検証済みの差出人とResendのAPIキーが必要。

```powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
```

`EMAIL_FROM` は検証済みドメインの差出人（例：`となりの手 <noreply@machinami0924.com>`）。**期限切れ通知の停止（2026-10-07）を含むコードをデプロイしてから** `EMAIL_FROM` を設定する。古いコードのまま設定すると、溜まっていた古い通知が送られる。

設定後は公開画面の「通知メールは準備中」が解除される。Firebaseのログインメールと支援通知の送信サービスは別。Firebaseのログインメールは2026-10-07に利用者本人が受信・ログインを確認済み。

Cronは10分間隔。1回の通知処理は10件、担当直後の処理は1件に抑えている。前日・当日通知はJST8時から順に処理する。大量の通知にはバッチ数、クエリのページング、Cloudflare契約上限、キューの導入を合わせて見直す。

課金が無効なFirebaseプロジェクトなのでTTLは使用しない。24時間経過したレート制限データの清掃と、中断したページ削除の再開をCronで行う。課金プランは変更していない。

## 実接続の再検証

```powershell
npx tsx scripts/verify-production.mjs
```

ログイン済みFirebase CLIの管理権限と、ローカルのSecretsファイルが必要。専用の一時アカウント・ページを作成し、公開サイトの認証、モバイル、パスコード、担当・競合・キャンセル、Cron、削除を確認する。メール送信は行わず、テストしたアカウント・個人情報を終了時に削除する。結果は `output/production-verification.json`。

## ドキュメント

- `AGENTS.md`: 実装・運用の原則
- `CLAUDE.md`: Claude Codeから共通ファイルをインポートする入口
- `docs/development-handoff.md`: Codex / Claude Code共通の作業状況・検証・残作業
- `docs/product-specification.md`: 原仕様（Firebase / Cloudflareへの変更は追加指示を優先）
- `docs/implementation-plan.md`: 既存調査とPhase計画
- `docs/requirements_definition.md`: 現在の要件・運用境界
- `docs/data-model.md`: コレクションと権限・移行契約
- `docs/phase-1-report.md`: 実装・DB変更・検証・残課題
- `docs/extension-design.md`: Phase 2〜6の拡張方針
