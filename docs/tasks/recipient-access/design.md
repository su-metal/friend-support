# 本人用リンク：設計

`requirements.md` に対応する設計。2026-10-05に実装済み（機能フラグ `ENABLE_RECIPIENT_ACCESS`、既定OFF）。既存の担当管理リンク（`/manage-assignment/[token]`）と同じ考え方で、アカウントなしの限定権限を作る。

## 画面と経路

| 経路                                   | 内容                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/r/[token]`（新規）                   | 本人用ページ。予定と担当状況（支援者の名前のみ）、「困りごとを出す」、自分のお願いの取り消し、お休みの切り替え                                              |
| `/dashboard/[id]`（変更）              | 「本人用リンク」欄：発行・コピー・LINEで送る・再発行・無効化。本人が出したお願いに印を付ける。配慮の定型文の選択                                            |
| `/s/[slug]`（変更）                    | お休み中の表示。配慮の定型文の表示。本人のお願いは通常の予定と同じ見た目（本人が出したことは公開しない）                                                    |
| `POST /api/recipient/requests`（新規） | お願いの追加。トークンはURLでなく本文で送る（`/api/assignments/cancel` と同じ）                                                                             |
| `POST /api/recipient/withdraw`（新規） | 担当前のお願いの取り消し                                                                                                                                    |
| `POST /api/recipient/settings`（新規） | お休み・再開と、支援する方へのお願い（定型）の変更                                                                                                          |
| `PATCH /api/pages/[id]`（変更）        | `action` に `recipient_link_issue`・`recipient_link_revoke`・`recipient_settings` を追加。`save` は `baseRevision` 必須。既存の主催者認証とOrigin検証を使う |

本人用APIにも既存と同じOrigin検証、JSONサイズ上限、Zod検証、レート制限（トークンハッシュ単位とIP単位）を適用する。

## データモデルの変更

| コレクション・項目                         | 変更                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `recipient_tokens/{SHA-256}`（新規）       | `supportPageId`、`createdAt`。担当トークン（`assignment_tokens`）とは別コレクション                                                                    |
| `support_pages.recipientTokenHash`（新規） | 現在有効なハッシュ。再発行・無効化で差し替え、古い `recipient_tokens` を同じcommitで削除する。参照時はポインターとこの値の両方が一致することを確認する |
| `support_pages.revision`（新規）           | 予定一覧を変えるたびに1増やす。窓口役の保存との競合検出に使う                                                                                          |
| `support_pages.pausedAt`（新規、任意）     | お休み中ならその時刻。空なら受付中                                                                                                                     |
| `support_pages.considerations`（新規）     | 配慮の定型文のID配列（`no_return_gift`、`doorstep_only`、`short_visit`、`no_reply`）。自由文は持たない                                                 |
| `support_pages.recipientSlotIds`（新規）   | ご本人が出したお願いの予定ID。予定の文書は公開レスポンスにそのまま使われるため、予定側には印を持たせない                                               |
| `slot_secrets`                             | 変更なし。おむつのサイズなどは `privateInstructions` に入れる                                                                                          |

ページ削除時は `recipient_tokens` も削除対象に加える（`services/support.ts` の削除処理のコレクション一覧）。既存データは `recipientSlotIds` なし＝空、`revision` なし＝0、`considerations` なし＝空として読む。移行スクリプトは不要の見込みだが、追加するなら `schema_versions/v2` として作る。

`firestore.rules` は全拒否のまま。新しいクエリは `recipient_tokens` の単一取得だけのため、インデックスの追加は不要の見込み。

## サービス層

`services/contracts.ts` に `RecipientService` を追加する。

```ts
interface RecipientService {
  issueLink(user: User, pageId: string): Promise<{ token: string }>; // 再発行も同じ
  revokeLink(user: User, pageId: string): Promise<void>;
  view(token: string): Promise<RecipientView | null>;
  addRequest(
    token: string,
    input: RecipientRequestInput,
  ): Promise<{ slotId: string }>;
  withdrawRequest(token: string, slotId: string): Promise<void>; // 冪等
  setPaused(token: string, paused: boolean): Promise<void>;
}
```

`RecipientView` は項目を明示して作る：公開ページの項目、予定一覧（公開項目と `supporterNames`）、自分のお願いかどうか（`mine`）、お休み状態、配慮の定型文。主催者の `OrganizerPage` をそのまま返さない。

### お願いの追加（トランザクション）

1. `recipient_tokens/{hash}` → ページを読む。ページの `recipientTokenHash` と一致し、削除中でなく、`published` かつ `endDate >= 今日` であることを確認する。
2. 入力をZodで検証する。日付は支援期間内、かつ今日以降。`slotIds` が60件未満であること。
3. 予定（`status: "open"`）、`slot_secrets`、ページの `slotIds`・`recipientSlotIds` と `revision + 1`、計測 `recipient_request_created`（pageId・slotId・categoryIdだけ）、窓口役への通知 `organizer_recipient_request` を同じcommitで書く。
4. 競合時は既存と同じく最大5回再試行する。

定型ボタンと公開用の予定名の対応は `config/product.ts` に置く（例：今日のご飯→`meal`／「夕食を届ける」、おむつ・日用品→`shopping`／「日用品を買って届ける」）。本人が予定名を書き換えることはできるが、入力欄の近くで健康のことを書かないよう案内する。

### 取り消し

`recipientSlotIds` に含まれ、`status === "open"` のときだけ、予定・`slot_secrets` を削除し、`slotIds` から外して `revision + 1`。既に存在しなければ成功を返す（冪等）。担当済み・完了は409で案内を返す。

### 窓口役の保存との競合（RA-04）

今の `save()` は送られた予定一覧でページを置き換え、一覧にない予定を削除する。窓口役が本人の追加より前に開いた画面のまま保存すると、本人のお願いが消えてしまう。

対策：主催者画面の読み込み時に `revision` を返し、保存時に `baseRevision` として送る。トランザクション内で一致しなければ409「ご本人がお願いを追加しました。画面を読み込み直してください」を返す。窓口役の保存でも `revision` を1増やす。

### お休み

`updateSettings` で `pausedAt` を設定・解除する。`canAssign()`（`lib/domain.ts`）に「お休み中でない」条件を加え、担当APIと公開ページの両方に効かせる。窓口役もダッシュボードから同じ操作をできる。

## 通知

- `organizer_recipient_request`：窓口役へ「ご本人が○日の『夕食を届ける』を追加しました」とダッシュボードURL。非公開欄の内容はメール本文に入れない。
- 支援通知が未接続の間は、ダッシュボードの印だけで知らせ、メール送信済みとは表示しない。
- LINE共有の文面は端末内で作る：「【となりの手】新しいお願いがあります／○月○日 夕食を届ける／{公開ページURL}」。

## 計測

`AnalyticsEventName` に `recipient_link_issued`、`recipient_request_created`、`recipient_request_withdrawn`、`recipient_paused` を追加する。プロパティはpageId・slotId・categoryIdだけ。状態変更と同じcommitで書く。

## 後続（今回は作らない）：本人の希望確認シート

本人用リンクの上に「受け渡しの方法（置き配のみ／玄関先で少し／会ってもOK）」「受け取ってもいい回数」「避けたい時間帯」「苦手な食べ物・アレルギー」を本人が答える画面を追加する。答えは非公開のページ単位コレクション（例：`page_recipient_preferences`）に保存し、窓口役の予定作成画面に表示する。食事の注意は今の `slot_secrets` と同じ扱いで、公開しない。

## 実装での補足（2026-10-05）

- 本人用リンクは発行直後の画面にだけ表示する（DBはハッシュのみ保持）。送り直すときは作り直す。
- 主催者の表示名は保存していないため、本人用ページでは窓口役を「ページを作った方」と表記する（モックの「窓口のゆうたさん」は見本）。
- 本人用ページでは、自分が出したお願いの非公開欄も表示しない（公開ページと同じ項目＋`mine` のみ）。
- 買い物の予定には、公開ページで「立て替えたお代は、ご本人やページを作った方と直接やり取りしてください」と表示する（窓口役が作った買い物の予定も含む）。
- 本人のお願いの日付は、今日以降かつ支援期間内。ページの開始日が明日なら「明日」を初期選択する。

## 決定事項（2026-10-05 ユーザー合意）

1. 本人のお願いは窓口役の承認なしにすぐ公開する。窓口役へは通知し、ダッシュボードから削除できる。
2. 本人用ページで支援者の名前を見せる。メールと主催者向けのひとことは見せない。
3. 担当が決まったお願いが不要になったときは、アプリでは扱わない。本人用ページの担当者名の横に「予定を変えたいときは、〇〇さんか窓口役に直接連絡してください」と表示する。取り消し依頼機能は利用者の声を見て後続で検討する。
4. 機能フラグ `ENABLE_RECIPIENT_ACCESS`（既定OFF）の裏で作り、テスト・3幅・実機の確認後にONにする。ON・デプロイはその都度ユーザーに確認する。支援通知メールの有効化は待たない（LINE共有で知らせられるため）。
5. 定型ボタンは次のとおり。日付は「今日」「明日」をボタンで選べ、その他の日も選べる。乳幼児の見守り・預かりは対象外。

| ボタン           | カテゴリ  | 公開される予定名     | 補足                               |
| ---------------- | --------- | -------------------- | ---------------------------------- |
| ご飯がほしい     | meal      | 夕食を届ける         |                                    |
| おむつ・日用品   | shopping  | 日用品を買って届ける | 非公開欄に「サイズ・枚数」の入力例 |
| 上の子の送り迎え | transport | 上の子を送迎する     |                                    |
| 家事             | housework | 家事を手伝う         | ゴミ出し・洗濯など                 |
| その他           | other     | ちょっとしたお手伝い |                                    |
