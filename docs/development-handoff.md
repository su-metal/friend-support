# 開発引き継ぎ：となりの手

更新日：2026-10-04。Codex・Claude Code共通の作業記録。
仕様は `docs/requirements_definition.md`、開発ルールは `AGENTS.md`。この記録だけから仕様・権限・外部設定の変更を判断しない。

## 現在の方針

- Webアプリを主軸とする。認知・利用拡大を第一優先、収益化を第二優先にする。
- Firebaseはsupport-circle-31a09、デプロイ先はCloudflare Workers。
- 支援者は専用アカウント不要。主催者はFirebase Email Link。
- LINEミニアプリ・ネイティブアプリとPhase 2〜6の利用機能は未提供。

## 直近の変更

担当ツール：Codex。作業内容：利用拡大に向け、サービス紹介の対象を一時的な生活支援へ広げ、公開ガイドと検索向けメタデータを実装した。

- トップページの説明を産後に限らない生活支援向けに更新。初期テンプレートは産後向けであることも案内に記載。
- `/guides` と `/guides/coordinate-support` を追加。予定づくりの手順、個人情報を公開しない共有方法、既存機能への案内を掲載。
- `metadataBase`、ページごとのcanonical/OG/Twitterメタデータ、`/sitemap.xml` を追加。サイトマップには明示した公開ページだけを入れ、個別支援・デモ・認証・管理ページは含めない。個別支援ページのnoindex/robots制御を維持。
- E2Eは375/390/430pxを含む5件が通過。Cloudflare向けビルドに続き、本番Workerへのデプロイも成功。公開ガイドと検索向けメタデータをHTTPSで確認した。
- 今回Firebaseログインメールは送信していない。本人の実受信とリンクからのログイン確認は未完了。支援通知も `EMAIL_FROM` 未設定のためOFFで、Secrets・Firebase設定の変更や実メール送信はしていない。

前回の支援通知テストと公開状態：

- Resendのmachinami0924.com検証済みドメインと送信専用APIキーを使った単発テストはResend上 `Delivered`。利用者本人から受信できたとの確認あり。
- テスト専用API経路は削除し、Cronを `*/10 * * * *` の通常 `/api/jobs` 呼び出しに戻してある。2026-10-04、本番Worker `friend-support` に公開ガイド変更をデプロイ。現在のVersion IDは `92545c44-84fd-4a86-b9fb-e1cbd56be21b`。
- メールアドレス、APIキー、その他の秘密値はこの記録に保存しない。

以前の変更：開発ツール間で要件とルールを共通化。

- CLAUDE.mdからAGENTS.md・要件書・本記録を直接インポートする構成にした。
- 要件書に目的・利用者・受け入れ条件・提供状態を追記した。新しい利用機能は追加していない。
- 原案と初回調査を現在の要件・実装状態と区別し、共通の文書運用を定義した。
- 文書の入口・インポート・参照を確認する `npm run docs:check` を追加した。

## 検証と公開の記録

今回の公開ガイド実装後の確認：

| 確認                                 | 結果                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run docs:check`                 | 通過。CLAUDE.mdの3件のインポート、共通入口・10件の文書参照、検証コマンドを確認                                                                                      |
| `npm run typecheck` / `npm run lint` | 通過                                                                                                                                                                |
| `npm run test`                       | 25件通過                                                                                                                                                            |
| `npm run test:db`                    | Firestore Emulator起動後、3件通過・1件失敗。同時担当の後、キャンセル処理でFirestore RESTが409を返した。以前から再現性未確定の別課題で、今回DBコードは変更していない |
| `npm run test:e2e`                   | 5件通過。主要導線3幅、CSRF/認証拒否、公開ガイドの375/390/430px・canonical・サイトマップを確認                                                                       |
| `npm run build:cloudflare`           | Next.js production buildとOpenNext buildが通過。OpenNextのWindows対応に関する既存の警告あり                                                                         |
| `npm run deploy`                     | 成功。本番Worker `friend-support`、Version ID `92545c44-84fd-4a86-b9fb-e1cbd56be21b`。`--keep-vars` で既存の変数・Secretsを保持。Cron `*/10 * * * *` も維持 |
| 公開HTTPS確認                         | `/guides`、`/guides/coordinate-support`、`/sitemap.xml`、`/robots.txt` は200。canonicalとサイトマップの公開先を確認。`/api/email-test` は404                 |
| Claude Code                          | `claude --version` で2.1.52を確認。CLAUDE.mdのインポート構造は検査済み。実際の開発セッションでの読み込みは未確認                                                    |

Firestore CLIはユーザーフォルダーのconfigstore読み取りがEPERMで失敗したため、この実行では `XDG_CONFIG_HOME` を `.local-test-tools/config` に設定した。CLIのMOTD取得警告は出たが、エミュレーターは起動した。ブラウザーからの直接書き込みに対するPERMISSION_DENIEDはRules拒否テストの期待結果。
同時キャンセル後の409を次回のDB作業で調査する。起点は `tests/firestore/transactions.test.ts` と `lib/firebase/firestore-rest.ts`。以前はWindows上のPlaywright / Next.js開発サーバーの終了処理が停滞したが、今回はE2E全5件が正常終了した。

前回のアプリ実装・公開の記録は `docs/phase-1-report.md` を参照する。そこでのローカル検証、実Firebase操作、メール未受信を区別する。

- 公開URL：https://friend-support.tossy104104.workers.dev
- `/guides` と `/guides/coordinate-support` のHTTPS表示、canonical、サイトマップ、robots.txtを本番で確認済み。`/api/email-test` は404。
- 今回はWorkerコードを公開した。Firebase設定とCloudflare Secretsは変更していない。Firebaseログインの実受信確認は未完了、支援通知は引き続きOFF。
- CLI・ログイン状態・Secrets・公開サイトは変更され得るため、次の外部操作前に再確認する。秘密値は本記録へ貼らない。

## 残作業と次に必要な情報

| 順番 | 残作業                                   | 状態・必要な情報                                                                                                   |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Firebaseログインメールの実受信からの操作 | 管理API発行リンクによる認証確認とは別に、本人が `/login` からメールを受信してリンクを開く操作が未確認              |
| 2    | 支援通知メールの本番有効化               | 単発テストメールの受信確認済み。`EMAIL_FROM` が未設定なので支援通知はOFF。送信待ちoutboxを確認した上で有効化を判断 |
| 3    | 検索・SNS・施設からの集客                | 公開案内・支援ガイド・サイトマップは本番公開済み。検索結果への登録、紹介施策と獲得効果は未確認                         |
| 4    | ページ単位のPlus課金の検証               | 未着手。支払意思・価格・有料機能を検証し、Phase 2で実装する。現時点のフラグはOFF                                   |

一時メールテスト経路は削除済み。今回のデプロイではFirebase設定とSecretsを変更していない。通常の支援通知は `EMAIL_FROM` 未設定のためOFF。公開ガイド変更は本番Workerへ反映済み。

## 再開時と終了時の手順

1. 要件書、本記録、今回触るコードを読み、未完了事項を確認する。
2. 別ツールの変更や同時編集の有無を確認する。Gitを利用している場合は差分・ブランチも確認する。
3. 必要になった作業から `docs/tasks/<task-name>/requirements.md`、`design.md`、`tasklist.md` を作成・更新する。
4. 実装変更はAGENTS.mdの検証ルールに従い、文書参照は `npm run docs:check` で確認する。
5. 終了時に本記録の更新日・担当ツール・直近変更・検証結果・デプロイ・残作業を更新する。成功、失敗、未実施を明記する。
6. 仕様変更は要件書とAGENTS.mdへ反映する。過去のレポートを最新状態の代わりに使わない。
