# Phase 1 実装・公開レポート

2026-10-04 / サービス名: となりの手

公開URL: https://friend-support.tossy104104.workers.dev

Cloudflare公開バージョン: `ec414ccd-343d-4529-9aec-de46580c68c4`。Cron: `*/10 * * * *`。

## 実装したもの

- Firebase Email Linkログイン、サーバーセッション、ユーザーの無効化・失効確認。
- 5ステップのページ作成・下書き・公開・編集。産後向け6カテゴリ、期間・予定・食事注意・非公開案内。
- 日付順の縦型公開ページ、カテゴリ・募集状態の絞り込み、充足率、公開名、受付終了。
- URLコピー、LINE共有、端末の共有機能。
- 名前だけの担当登録、任意のメール・主催者向けメッセージ、主催者画面の担当確認。
- 256bit管理トークン、DB上のハッシュ、非公開案内の担当者限定表示、冪等キャンセル、再募集。
- ページの終了・削除、完了処理、中断した削除のCron再開。
- 担当確認・主催者・キャンセル・前日/当日通知のoutbox、暗号化本文、リース、再試行、Resendアダプター。**メール実配信は未接続**。
- ソルト付きパスコードハッシュ、解除Cookie、変更時の既存許可失効。
- Firestore直接アクセス拒否、主催者ID・ページ所属の認可、Origin検証、入力検証、共有レート制限。
- noindex/no-store、CSP、管理リンクのReferer抑止。WorkerのリクエストURL自動ログを無効化。
- 個人情報を除外した計測。登録・公開・キャンセルの主要イベントは状態変更と同じcommitで確定。
- 利用案内・プライバシー説明、サンプルページ、ローカル専用のデモ認証。

## 変更ファイル

| 対象 | 主なファイル |
|---|---|
| 画面 | `app/page.tsx`、`app/create/`、`app/dashboard/`、`app/s/`、`app/manage-assignment/`、`app/login/`、`app/auth/complete/`、`app/globals.css` |
| UI | `components/wizard.tsx`、`slot-editor.tsx`、`support-page.tsx`、`manage-assignment.tsx`、`dashboard.tsx`、`share.tsx`、`login-form.tsx` |
| API | `app/api/auth/`、`pages/`、`support/`、`assignments/cancel/`、`analytics/`、`jobs/` |
| サービス | `services/support.ts`、`notifications.ts`、`analytics.ts`、`contracts.ts`、`store.ts`、`memory-store.ts`、`factory.ts`、`future.ts` |
| 認証・DB | `lib/auth/`、`lib/firebase/`、`lib/api.ts`、`lib/domain.ts`、`lib/security.ts`、`types/domain.ts`、`config/product.ts` |
| 運用 | `firestore.rules`、`firestore.indexes.json`、`firebase.json`、`wrangler.jsonc`、`cloudflare-entry.mjs`、`open-next.config.ts`、`.env.example`、`scripts/` |
| 検証 | `tests/unit/`、`tests/firestore/`、`tests/e2e/`、各テスト設定、`scripts/verify-production.mjs` |
| ドキュメント | `AGENTS.md`、`README.md`、`docs/requirements_definition.md`、`data-model.md`、`implementation-plan.md`、`extension-design.md` |

## DB変更と外部設定

Firebaseプロジェクトはユーザー指定の `support-circle-31a09`。Firestore Native、asia-northeast1。ブラウザーのRLS相当の境界は全拒否Rules、サーバーのデータ権限はIAMとサービス層の認可で実装した。

カテゴリ6件・産後テンプレート1件・価格設定・`schema_versions/v1` を冪等seedで登録済み。ページ、予定、非公開情報、担当、トークン参照、通知、プロフィール・ページメンバー、計測、レート制限のコレクション契約を追加した。詳細は `data-model.md`。

専用サービスアカウント、Firestore用IAM、ユーザー取得・認証セッション発行の専用ロール、秘密キー、Email Link、公開Workerの認証許可ドメインはユーザーの明示許可で設定した。キーはCloudflare Secretsへ保存し、ソースには含めていない。

Rulesと非公開フィールドの索引除外をFirebaseへデプロイ済み。TTLは課金無効による403で利用できなかったため、課金を変更せずCron清掃にした。

予定の読み取りはbatchGetでまとめる。最大60枠の公開・主催者画面・編集を確認し、枠ごとの多数のHTTPリクエストを避けた。Cloudflareの外部リクエスト数を考慮して通知処理も少数ずつ進める。[Cloudflareの実行上限](https://developers.cloudflare.com/workers/platform/limits/)

## テスト結果

ローカルの `.secrets` もWindowsのアクセス権を設定し、作業ユーザー・Administrators・SYSTEM以外からの読み取りを制限した。

| 検証 | 結果 |
|---|---|
| TypeScript | 通過 |
| ESLint | エラー・警告なし |
| 単体・サービス | 25件通過 |
| Firestore実エミュレーター | 4件通過。競合、非公開情報、IDOR、パスコード、全拒否Rules、60枠の一括取得・更新 |
| ローカルE2E | 4件通過。375/390/430pxの作成→公開→匿名担当→主催者確認→キャンセル、競合201/409、CSRF・認証拒否 |
| Next.js production build | 通過 |
| OpenNext Cloudflare build | 通過 |
| 本番依存 npm audit | 0件 |
| 公開サイト | HTTPS表示、実Firebase認証セッション、実DBのページ作成・公開・パスコード、担当、キャンセル、競合201/409、認証付きCron、ページ削除を確認 |
| モバイル表示 | 公開サイトの375/390/430pxでスクリーンショットと横はみ出しなしを確認 |

公開検証はFirebase管理APIの `returnOobLink=true` で発行したリンクを使用し、Firebaseのリンク先からアプリへのリダイレクトも確認した。メールは送っていない。確認用アカウントとページ・担当・通知・プロフィールは削除済み。[FirebaseのAPI仕様](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/sendOobCode)

結果は `output/production-verification.json`、画面画像は `output/playwright/production-*.png`。Edgeではテスト終了時のブラウザー停止に問題があったため、Playwrightの対応Chromiumで全件通過を確認した。OpenNextはWindows利用の注意を出したが、ビルドとCloudflare上の実操作は成功した。

## 残課題

- **支援通知メールの差出人・送信サービス接続と実受信確認。** 現在は通知キューを作成し、画面に「通知メールは準備中」を表示。管理リンクは保存して利用する。
- Firebaseログインメールの実到達・利用者本人によるメール受信からの操作は未確認。認証コードの消費と実セッションは検証済み。
- 大規模利用時は通知のバッチ量、ページング、データ集計とキューを追加する。現在のDB・サービス境界を維持して拡張できる。
- 開発・ビルド用の依存には npm auditの指摘が18件残る。本番依存は0件。破壊的な `audit fix --force` は実行していない。
- Phase 2〜6の利用機能は未実装。型・モデル・プロバイダー契約・設定・拡張方針を用意し、全フラグOFF。実決済は提供していない。

Phase 2〜6の具体的な追加境界は `extension-design.md`。Phase 6は必要性の確認後に着手する。
