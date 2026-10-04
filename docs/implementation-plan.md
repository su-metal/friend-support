# 調査と実装計画

## 初回調査の記録
2026-10-04の実装開始前の調査では既存コード、package.json、Migration、Git、環境設定は存在しなかった。firebase-debug.logのみ。既存Firebase実装は確認できなかった。これは実装前の記録であり、現在はPhase 1の主要機能を実装・公開済み。

現在の要件は `docs/requirements_definition.md`、作業状況は `docs/development-handoff.md`、前回の実装・公開・検証は `docs/phase-1-report.md` を参照する。Codex・Claude Codeとも同じ正本から開発を再開する。

## DB定義・データ移行
ユーザーの追加指示によりFirebase Firestoreを利用し、Cloudflareへデプロイする。利用先はsupport-circle-31a09。Firestore Rules、index設定、コレクション契約とバージョン付き初期設定を管理する。SQL Migrationは使用しない。
公開データと秘匿データを分離。サーバーで主催者を認可し、ブラウザーの直接DBアクセスは拒否。予定ドキュメントのトランザクション競合検出と再試行で1枠1人を保証し、通知outboxも同時に登録する。トークンはハッシュ化、パスコードはソルト付きハッシュ化。

## Phase
1. Consumer MVPを実装・検証する。
2〜6. 課金、組織、ギフト、ケーステンプレート、受取人承認などの型・テーブル・プロバイダー契約・機能設定を用意する。ユーザー向け機能の公開は将来のPhaseで行う。送金は実装しない。

## 変更対象
app（ルーティング、API、画面）、components（フォーム、縦型予定）、services（ユースケース、DBアダプター）、lib（認証、セキュリティ、通知、計測）、types、config、firestore.rules、firestore.indexes.json、firebase.json、wrangler.jsonc、tests、scripts、運用ドキュメント。

## 重大な懸念
- 接続設定はFirebaseとCloudflareのログイン済み環境から構成する。実メール送信の設定は別途必要。
- 公開ページの存在や内容を一覧検索できないようにする。推測しにくいslugを使用する。
- メール・住所・食事注意は公開JSONから除外し、担当者への取得もキャンセル後に失効させる。
- Cloudflareの複数インスタンスの競合とレート制限はFirestoreトランザクションで保証する。デモのメモリ処理は実運用に利用しない。
- 配信リトライには同一idempotency keyを使用し、cronはBearer認証を要求する。メール配信状態は支援登録の成功と区別する。
