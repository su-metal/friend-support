# Firestoreコレクション契約 v1

FirestoreはドキュメントDBのため空のコレクションを事前作成しない。初期設定のseedは `scripts/migrate.ts` で `schema_versions/v1` にバージョンを記録する。

| コレクション            | ID                          | 内容・アクセス                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profiles                | Firebase uid                | 主催者プロフィール。サーバーのみ                                                                                                                                                                                                                                                                  |
| support_pages           | UUID                        | SupportPage + slotIds + 主催者通知用メール。公開は明示的な投影。revision（予定一覧の版）、recipientTokenHash、recipientSlotIds（ご本人のお願い）、pausedAt（お休み）、considerations（定型ID配列）は任意項目で、無い既存データは0・空として読む。recipientTokenHash・recipientSlotIdsは公開しない |
| page_slugs              | ランダムslug                | pageIdのみ。一覧を公開しない                                                                                                                                                                                                                                                                      |
| page_secrets            | pageId                      | ソルト付きpasscodeHash、ランダムaccessVersion                                                                                                                                                                                                                                                     |
| support_slots           | UUID                        | 公開可能な予定、名前、状態、quantityNeeded                                                                                                                                                                                                                                                        |
| slot_secrets            | slotId                      | privateInstructions、食事人数・苦手・アレルギー・受け渡し希望                                                                                                                                                                                                                                     |
| slot_assignments        | UUID                        | 名前、メール、ひとこと、状態、editTokenHash、pageId                                                                                                                                                                                                                                               |
| assignment_tokens       | SHA-256トークン             | assignmentId、supportPageId                                                                                                                                                                                                                                                                       |
| recipient_tokens        | SHA-256トークン             | supportPageId、createdAt。ページのrecipientTokenHashと一致する場合だけ有効。ページ削除で削除                                                                                                                                                                                                      |
| slot_active_assignments | slotId                      | activeな担当ID。1枠1人の参照                                                                                                                                                                                                                                                                      |
| notifications           | 確定ID+通知種別             | 暗号化本文、宛先、dueAt、status、attempts、leaseId                                                                                                                                                                                                                                                |
| analytics_events        | UUID                        | イベント名、許可済みプロパティ、時刻。個人情報なし                                                                                                                                                                                                                                                |
| rate_limit_buckets      | HMAC相当の秘密値付きSHA-256 | 10分窓のcount、expiresAt。課金不要のCronで期限切れを削除                                                                                                                                                                                                                                          |
| support_categories      | categoryId                  | カテゴリ、表示名、テンプレートタイトル                                                                                                                                                                                                                                                            |
| case_templates          | templateId                  | caseType、推奨カテゴリ・予定                                                                                                                                                                                                                                                                      |
| page_members            | pageId_uid                  | organizer/co_organizer/recipient、招待状態。共同管理UIは将来                                                                                                                                                                                                                                      |
| config                  | pricing                     | Plus/Proの設定。現在の価格ソースは環境変数                                                                                                                                                                                                                                                        |
| purchases               | UUID（将来）                | 金額、対象ページ/組織、Stripe ID、支払状態                                                                                                                                                                                                                                                        |
| organizations           | UUID（将来）                | 組織、Pro、subscriptionStatus                                                                                                                                                                                                                                                                     |
| organization_members    | organizationId_uid（将来）  | owner/admin/member                                                                                                                                                                                                                                                                                |
| gift_partners           | partnerId（将来）           | 外部URL、広告種別、active                                                                                                                                                                                                                                                                         |

## トランザクション

担当：slug→ページ→パスコード許可→予定を読み、公開状態・日付・所属・空きを確認。予定の状態、担当ドキュメント、ハッシュ参照、通知を同一commitで保存する。FirestoreのABORTED等を最大5回再試行し、再試行時は空きを再評価する。

キャンセル：ハッシュ参照→担当→ページ→予定を読み、activeであれば予定をopenへ戻し主催者通知を登録する。cancelledなら成功を返す。completedは拒否する。担当者の非公開案内はactive/completedだけに返す。

ご本人のお願い：ハッシュ参照→ページを読み、recipientTokenHash一致・公開中・期間内・60枠未満を確認する。予定・slot_secrets・ページのslotIds/recipientSlotIds/revision・計測・主催者通知を同一commitで保存する。取り消しはrecipientSlotIdsに含まれ募集中の予定だけ。主催者の保存はbaseRevisionがrevisionと一致する場合だけ確定する。

保存期間：Cronが終了日から30日（`RETENTION_DAYS`）を過ぎたページを1件ずつ手動削除と同じ処理で消す（`purgeExpired`）。削除の前に `analytics_events/auto-deleted-{pageId}` を記録する。通知は予定時刻から12時間（前日・当日のリマインド）または24時間（その他）を過ぎたら `skipped` にし、`encryptedText` を空にする。

## 境界

ブラウザーの全コレクション操作をRulesで拒否。サーバーはOAuth IAMでFirestore RESTへ接続するためRulesを迂回する。そのため主催者ID・ページ所属・公開状態・パスコード許可・管理トークンを **サービス層の各ユースケース** で確認する。クライアントの入力だけを権限根拠にしない。

## 移行

SQL Migrationの代わりにRules/index設定と、冪等なバージョン付きデータseedを管理する。実利用データへサンプル家族を自動挿入しない。開発サンプルはローカルデモとエミュレーターで作る。
