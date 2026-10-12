# コードレビュー・動作テスト（2026-10-12）

担当：Codex。対象：レビュー時点の作業ツリー（HEAD `030bb0937c8776d4fac4482400b943ff36da1375` と未コミット・未追跡の実装）。要件書、引き継ぎ、サービス、認証、API、DBトランザクション、通知、カレンダーと本人用リンクを照合した。

## 初回確認時の判定と範囲

初回のローカル作業ツリーは、本人用機能の依存ファイルが揃っておらず、型チェック・ビルド・画面表示が失敗していた。以下の指摘・検証表は修正前のスナップショットである。既存の本番公開画面は表示できていたが、本番に作業ツリーが反映されていることは確認していなかった。

ユーザーから「LINEで通知が届く」「ログインできる」との確認を受けた。これはユーザーによる実機確認として扱い、今回Codexが受信・ログインを再実行した結果とは区別する。コードには端末内のLINE共有とResendの通知メールがあるため、この申告からLINEの自動送信APIやResend支援通知の設定完了を推定しない。

## 指摘事項

### R1 / P1：本人用機能の依存ファイル欠落でビルド・画面が失敗

- `app/api/pages/[id]/route.ts:8` や本人用APIは `recipientService` をimportしているが、`services/factory.ts` はexportしていない。
- `components/recipient.tsx:11` と `services/recipient.ts:183` が使う `considerationOptions`・`recipientRequestTemplates` が `config/product.ts` にない。`getFeatureFlags()` にも `recipientAccess` がない。
- `types/domain.ts` の本人用型と `OrganizerPage.revision` など、`services/contracts.ts` の本人用サービス契約も欠けている。
- 結果：型エラー74件、Turbopackの欠落exportエラー9件。本人用unit testは13件中10件が同じテンプレート欠落で失敗。`/login`・`/create` のローカル画面にもビルドエラーが出る。フラグOFFでも静的importの欠落は回避できない。
- 対応：本人用機能の変更一式を整合させる。管理画面の `recipientEnabled` の受け渡し、公開画面のお休み表示、robots・ヘッダー・フラグ設定も併せて照合してから全チェックを再実行する。

### R2 / P1：詳細編集画面の保存要求にrevisionがなく400になる

- `components/wizard.tsx:125` は `{ action: "save", draft }` を送信する。
- `app/api/pages/[id]/route.ts:29` は `baseRevision` を必須の整数として検証するため、この要求は400になる。
- 調査用テストで実際のPATCHハンドラーに同じ本文を渡すと400・`validation`、同じ本文に取得済みrevisionを加えると200を確認した。認証とfactoryだけをスタブし、MemoryStoreを使用した。R1のimport欠落を修正した結果としての画面E2Eではない。
- 対応：編集開始時に取得した `existing.revision` を送る。予定追加後の古い版による409と、通常の編集保存の両方をAPI・画面で確認する。

### R3 / P2：終了したページの本人用リンクが失効しない

- `services/recipient.ts:42` のトークン検証は削除・archived・トークン差し替えを拒否するが、closedや期間終了を拒否しない。
- `view()` は終了後も表示データを返し、`withdrawRequest()` もページ状態を確認しない。
- MemoryStoreで、主催者が `closed` にした後も同じ本人用トークンで表示を取得でき、担当前の本人のお願いを削除できることを再現した。要件の「終了でも使えない」に反する。
- 対応：終了したページの本人用リンクを閲覧・変更の両方で無効として扱う。手動終了と期間終了をそれぞれ検証する。

### R4 / P2：本人が最後のお願いを取り消すと公開中の予定が0件になる

- `services/recipient.ts:272` は予定を削除して `slotIds` を減らすが、公開中ページの最終1件かを検証しない。
- 本人のお願いだけが1件残った有効なDB状態をfixtureで作り、取り消すと `status: published`・予定0件となることを再現した。欠落したテンプレートに依存しない状態遷移の確認である。
- カレンダー追加時に導入した「公開中ページの予定は少なくとも1件残す」という要件を、主催者の `save()` だけが守っている。
- 対応：本人による取り消しのトランザクションにも公開状態と件数の整合を適用し、最終1件の操作を画面とサービスの双方で扱う。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| `npm run docs:check` | 成功。レビュー記録・引き継ぎ更新後も成功 |
| `npm run typecheck` | 失敗。74件。主に本人用サービス・設定・型の欠落 |
| `npm run lint` | 成功。エラー0、警告2。入れ子の既存チェックアウトの生成済み型ファイル由来 |
| `npm run test` | 45件中35件成功・10件失敗。本人用テンプレートの欠落で `undefined.find` |
| `npm run test:db` | Firestore Emulatorの4件成功。同時担当・同時キャンセル、60件取得、Rules、IDOR・パスコードを確認 |
| `npm run build:cloudflare` | 失敗。Next.jsビルドの欠落exportエラー9件。OpenNextのWindows警告も出た |
| E2E | 8件を収集。調査用設定で1件失敗・7件未実行。最初の375px作成画面がビルドエラーとなり、デモボタンが表示されないため停止 |
| 調査用再現チェック | 3件でR2〜R4の現在の誤動作を確認。成功のassertionは「不具合を再現できた」の意味で、製品の合格を意味しない |

初回のサンドボックス実行ではVitestのrealpathにEPERM、Firestore Emulatorに起動タイムアウト、Next.jsにパス解決エラーが出た。通常権限での再実行で切り分け、上表は再実行の結果。既存の3000番開発サーバーは停止していない。標準E2E設定ではHTTP 500の既存サーバーを再利用せず別サーバーの起動を試みてロックに失敗したため、`webServer` を外した調査用設定で画面の失敗を確認した。

この作業ツリーのFirestore integrationは4件で、過去の別チェックアウトで記録された本人の同時追加を含む5件とは異なる。ご本人用機能のDB競合テストと主要導線375/390/430pxのE2Eは、R1修正後に再確認が必要。

## 本番の確認（公開画面・認証前の拒否動作）

対象：[本番サイト](https://friend-support.tossy104104.workers.dev)。個別支援ページの登録・担当・キャンセルや実メール送信は実施していない。

- `/`、`/login`、`/guides`、`/guides/coordinate-support`、`/robots.txt`、`/sitemap.xml` はHTTP 200。
- 本番トップ・ログイン・支援ガイドを375/390/430pxで撮影。すべて `scrollWidth === innerWidth`。375pxのログイン・ガイドと375/430pxのトップを画像で確認し、重なり・切れは認めなかった。ログイン・ガイドの操作中のpageerrorは0件。
- Originなしの `POST /api/pages` は403、正しいOrigin・未ログインは401、認証なしの `GET /api/jobs` は401。未ログインの `/dashboard` は307で `/login` へ移動。
- 本番CSPに `unsafe-eval` はない。robotsは `/r/` をDisallowし、サイトマップに `/r/` はない。無効な本人用URLは404。これだけでは本人用機能の本番フラグ値は確定できない。
- LINE通知受信とログイン完了はユーザー確認済み。今回の本番確認は認証前の範囲であり、主催者としての本番操作・実機LINEの再検証は含まない。

調査用コード・型チェックログ・E2E traceは `output/review-2026-10-12/` と `output/review-typecheck-2026-10-12.log`、本番画像は `output/playwright/review-production-*.png` に保存。いずれもGit対象外の作業成果物。業務データ・秘密値を記録していない。

Workerの入口、self service binding、`waitUntil`、Cron、CSPはコードと[Cloudflare公式best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)を参照して確認した。外部設定の実測やWorker配信バージョンの確認は今回の範囲に含めていない。

## 修正後の実装と最終検証

2026-10-12にレビュー指摘へ対応した。R1は最新mainで確認した本人用の依存・型・factory・表示修正を反映して解消。R2はWizardから `baseRevision` を送り、サービス契約・実装でも必須化し、欠落・不正版をトランザクション前に拒否する。R3はclosed・archived・削除中・JST終了日の翌日以降の本人用リンクを拒否。R4は公開中の最後の予定となる取り消しを409で拒否し、画面で理由と相談先を案内する。

最終結果：`npm run docs:check`、`npm run typecheck`、`npm run lint`、`npm test`（49件）、`npm run test:db`（7件）、`npm run build:cloudflare`、E2E（8件）が成功した。E2Eは隔離したlocal production buildで375/390/430pxを確認し、ご本人用URLのnoindex/no-store、公開情報とLINE共有文、編集保存、お休み・無効化、支援者の担当・キャンセル、公開APIのCSRF・認証、robots・サイトマップを通した。

Cloudflare buildはWindowsでのOpenNext利用に関する警告を出したが成功した。この節は最新main基準のリリース候補を作る前のレビュー用作業ツリーの結果を記録する。コードを含めFirestoreスキーマ、Rules、Indexes、移行、Secrets、本番フラグの変更はこの時点では行っていない。LINE受信・ログインはユーザー確認済みだが、この記録でCodexは再実行していない。最新main基準でのPR・デプロイ結果は後述する。

## 初回レビュー時に必要だった次の作業（後続で実施済み）

1. 現在のローカル作業ツリーと必要な本人用機能の変更一式を整合させる。
2. R2〜R4を修正し、通常保存・競合保存、手動終了・期間終了、最終1件取り消しを検証する。
3. docs、typecheck、lint、unit、Firestore integration、Cloudflare buildと主要導線3幅のE2Eを再実行する。
4. 本番への変更は別途リリース作業として扱う。

## 最新main基準のリリース候補

2026-10-12に最新main `bec8d1ba714bf04073bd9d4ca8e0f9b1c9758319` を取得し、PR #2/#3/#5/#6の変更を確認した。R1はすでに最新mainへ入っていた。R2〜R4の修正を最新mainから作った隔離候補で再検証し、unit 49件、Firestore Emulator 7件、E2E 8件、docs:check、typecheck、lint、Cloudflare buildが成功した。E2Eは375/390/430px、Cloudflare buildはOpenNextのWindows警告あり。PR #7はSquash merge済み（merge commit SHA `eef65bb2fe84248ea3c7167ab5f962730d36cf77`）。本番Worker `friend-support` にデプロイ済み（Version `a4d7a753-93b5-487c-8945-ad165047eeb6`、100%配信、Cron維持）。公開6ルートが200、本人用URLのfeature flag OFF時は404、robots・サイトマップの除外も確認。本番フラグは既定OFFのまま。LINE受信とログインはユーザー申告で確認済みだが、今回再実行していない。
