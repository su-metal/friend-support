# となりの手

身近な人同士で一時的な生活支援の予定と担当を調整する。最初のUIは産後支援。正本は `docs/requirements_definition.md`。DBはFirebase Firestore、デプロイはCloudflare Workers。利用先はsupport-circle-31a09。

- 提供形態はスマートフォンから使えるWebアプリを主軸とする。事業上の優先順位は認知・利用拡大、次に収益化。現在のLINE共有を活用し、LINEミニアプリとネイティブアプリは利用実績を踏まえて将来検討する。
- Phase 1の作成、公開、共有、担当、キャンセル、管理、通知を中心にする。
- 支援者のアカウント登録は不要。主催者はFirebase Email Linkで認証する。署名、発行者、対象プロジェクト、本人確認、失効をサーバーで検証する。
- 公開レスポンスに住所、メール、健康上の注意、非公開指示を含めない。非公開指示は有効な担当トークンで取得する。
- 担当登録とキャンセルはFirestoreトランザクションで予定を読み取り、担当状態と通知outboxを同時に確定する。競合時は再試行し、1枠1人を保証する。
- Firestore Rulesはブラウザーからの直接アクセスを全拒否する。CloudflareサーバーはサービスアカウントのIAM経由でアクセスし、各操作の主催者ID・ページ・担当トークンをサービス層で検証する。
- 公開レスポンスは項目を明示して作成する。管理用オブジェクトをそのまま公開しない。非公開指示、食事注意、ページのパスコードは別コレクション。
- 検索向けサイトマップにはトップページ、サービス案内、支援ガイドなど明示した公開ページだけを載せる。個別支援ページ、デモ、ログイン・管理・APIのURLは載せない。個別支援ページのnoindex・no-followと既存のrobots制御を維持する。
- DB定義は `firestore.rules`、`firestore.indexes.json`、`docs/data-model.md`。データ移行はバージョン付きスクリプトで管理する。
- Next.jsをOpenNextアダプターでCloudflare Workersへデプロイする。FirestoreとAuthはREST + Web Cryptoで操作し、Node専用Firebase Admin SDKに依存しない。Secretsをコード・ログに出さない。
- デモはローカルホストのみ、明示的なAPP_MODE=demoで有効。デモのデータはプロセス内に保持し、再起動で初期化される。実メールを送信しない。
- Phase 2〜6はデータモデルとプロバイダー契約の土台。既定でOFF。寄付、支援金送金、知らない人のマッチング、チャットを追加しない。
- 機能、権限、運用を変更する場合は本ファイルと要件書を同じ変更で更新する。
- 実接続やデプロイをローカル検証と同一視しない。検証済み範囲を記載する。
- 登録・公開・キャンセルの計測は状態変更と同じcommitで確定する。計測障害で成功済みの担当管理リンクを返せなくなる構造にしない。
- 課金プランを自動変更しない。レート制限データの期限切れ削除と中断したページ削除の再開はCronで行う。
- 通知メールが未接続のときは配信済みと表示しない。Firebaseのログインメールと支援通知の送信設定は別に扱う。
- 公開の利用案内・支援ガイドは一時的な生活支援全般を扱えるが、説明は現行機能の範囲に合わせ、初期テンプレートが産後向けであることを明記する。
- 変更後はtypecheck、lint、unit/integration、buildを実行。主要導線はE2Eと375/390/430pxで確認する。

## 共通の開発手順とドキュメント

CodexとClaude Codeは同じファイルを正本として開発する。Claude Codeの入口 `CLAUDE.md` は、本ファイル・要件書・引き継ぎ記録のインポートだけを管理し、別の仕様を持たない。

- 作業開始時に `docs/requirements_definition.md` と `docs/development-handoff.md` を読み、変更するコードの現状を確認する。別のチャットやツールの記憶だけを根拠に実装しない。
- ユーザーの明示的な最新指示を反映した要件書がプロダクト仕様の正本。本ファイルは開発・運用ルールの正本。両者に矛盾があれば同じ変更で整合させる。最新指示で解消できない仕様の矛盾は、独自に上書きせず確認する。
- `docs/product-specification.md` は原案の参照資料。古いSupabase / Vercel指定や将来機能を現在の実装へ適用しない。`docs/implementation-plan.md` の初回調査も現在の実装状況と区別する。
- DB変更では `docs/data-model.md`、`firestore.rules`、`firestore.indexes.json`、型・サービス契約を整合させる。将来機能では `docs/extension-design.md` も読む。
- 作業単位の詳細が必要な場合は `docs/tasks/<task-name>/requirements.md`、`design.md`、`tasklist.md` を作る。全体要件・変更要件・設計・進捗を区別し、全体要件を変更する場合は正本も更新する。このディレクトリは必要になった作業から作成する。
- 作業終了時に `docs/development-handoff.md` を更新する。変更内容、ローカル検証、デプロイ、実接続・実受信の確認、残作業、次に必要な情報を記録し、未確認を完了としない。秘密情報や個人情報は記録しない。
- 別ツールで作業を再開するときも同じプロジェクトの最新ファイルを読む。同じファイルを同時編集しない。別チェックアウトを使う場合は変更を取り込んでから再開する。
- 指示ファイルと文書参照の構造は `npm run docs:check` で確認する。意味の整合性は要件・実装・引き継ぎを照合して確認する。ドキュメントの記述だけで外部設定やデプロイの実施を許可されたと判断しない。

| ファイル                          | 役割                                       |
| --------------------------------- | ------------------------------------------ |
| `AGENTS.md`                       | 共通の開発・運用ルール                     |
| `CLAUDE.md`                       | Claude Codeから共通ファイルを読み込む入口  |
| `docs/requirements_definition.md` | 最新のプロダクト要件・受け入れ条件・対象外 |
| `docs/development-handoff.md`     | 現在の進捗・検証記録への参照・残作業       |
| `docs/data-model.md`              | DB・権限・移行の契約                       |
| `docs/extension-design.md`        | 未提供のPhase 2〜6の拡張設計               |
| `docs/phase-1-report.md`          | Phase 1実装・公開・検証の記録              |
| `README.md`                       | セットアップ・検証・運用コマンド           |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
