
# 原案の扱い（Codex・Claude Code共通）

この文書はユーザーが提供した当初の構想・仕様を保存した参照資料です。
現在の要件の正本は `docs/requirements_definition.md`、共通の開発ルールは `AGENTS.md`、進捗は `docs/development-handoff.md` です。
以下に残る「Codex向け」という表題は原文の一部であり、開発ツールの制限ではありません。
Supabase / Vercel指定はFirebase Firestore / Firebase Authentication / Cloudflare Workersへ変更済み。Webアプリを主軸とし、利用先はsupport-circle-31a09です。
Phase 2〜6の機能や料金は構想・仮説であり、提供済みとは扱いません。原案と現在の要件が異なる場合は現在の要件を適用してください。

---

# 日本版Meal Train型 支援調整プラットフォーム
# Codex向けプロダクト・事業・実装仕様書

## 0. このドキュメントの目的

日本向けの、

> **家族・友人・知人が、支援を必要としている人を少しずつ助けるための共有サポートプラットフォーム**

を実装してください。

米国のMeal Trainに近い問題を解決しますが、既存サービスの名称、UI、文章、ブランド、デザインをコピーしてはいけません。

日本向けの独立したオリジナルサービスとして設計・実装してください。

最初のターゲットは、

**出産・産後**

です。

ただし将来的には、

- 入院・退院
- 怪我
- 療養
- 家族の介護
- 看病
- 家族の死去・服喪期間
- 災害・一時的困難
- その他の一時的生活支援

へ拡張できるプラットフォームとします。

したがって、

**現在は産後向けUIでも、データモデルやビジネスロジックを産後専用にハードコードしないこと**

を重要要件とします。

---

# 1. プロダクトの核

このサービスが解決する問題は、

> 「何かあったら言ってね」

と言われても、支援を必要としている本人から、

> 「木曜日に夕飯をお願いします」

とは頼みにくいことです。

これを、

```text
何か手伝いたい
↓
共有ページを見る
↓
空いている支援枠を見る
↓
自分ができるものを選ぶ
↓
「私が担当します」
```

という構造に変えます。

---

# 2. 最重要UX

ユーザーに提供する価値は、

> **頼む側の心理的・事務的負担を減らし、助けたい側が具体的な行動を選べるようにすること**

です。

アプリの価値を、

- SNS
- コミュニティ
- マッチング
- チャット

へ広げすぎないでください。

中心は最後まで、

**支援スケジュールの共有と担当調整**

です。

---

# 3. サービスの基本構造

```text
Organizer
支援ページを作る人

↓

Support Page
「○○さん家族をサポート」

↓

Support Slots
必要な支援予定

↓

共有URL

↓

Supporters
家族・友人・知人

↓

担当を選択

↓

支援実施
```

---

# 4. マーケットプレイスではない

非常に重要です。

このサービスは、

**知らない人同士をマッチングするサービスではありません。**

以下は行いません。

- 支援者検索
- 不特定多数への募集
- 支援者ランキング
- 支援者への報酬
- 配送業務
- 家事代行
- ベビーシッター派遣
- 介護派遣
- 料理販売

あくまで、

**すでに何らかの関係がある人同士の支援調整ツール**

です。

---

# 5. ユーザーロール

## Organizer

支援ページを作る人。

例：

- 友人
- 親
- 兄弟姉妹
- 本人
- 配偶者
- 支援団体スタッフ

アカウント必須。

---

## Recipient

支援を受ける本人または家族。

MVPではアカウント不要でもよい。

ただし将来的には、

- ページ内容確認
- 支援内容承認
- 希望変更
- プライバシー設定

を本人が管理できるようにする。

---

## Supporter

支援する人。

例：

- 友人
- 同僚
- 親族
- 近所の知人

基本的にはアカウント不要。

---

## Organization Admin

将来的なProプランで追加。

例：

- 産後支援NPO
- 子育て団体
- 病院
- クリニック
- 助産院
- 企業福利厚生担当
- 地域コミュニティ

複数Support Pageを管理する。

---

# 6. 初期ターゲット

Phase 1では、

**産後1〜2か月程度の家族支援**

に特化する。

例：

```text
赤ちゃんが生まれた田中さん家族を
8月20日〜9月20日まで
みんなで少しずつサポートします。
```

---

# 7. 初期支援カテゴリ

以下を標準カテゴリとする。

```text
🍱 食事

🛒 買い物

🚗 送迎

🧹 家事

🐕 ペット

📦 その他
```

将来的にはカテゴリ設定をDB化し、対象ケースごとにテンプレートを変更できるようにする。

---

# 8. 将来のケースタイプ

データモデルでは以下を想定する。

```ts
type SupportCaseType =
  | "postpartum"
  | "illness"
  | "injury"
  | "recovery"
  | "caregiving"
  | "bereavement"
  | "other"
```

Phase 1では `postpartum` のみUIから選択可能。

---

# 9. 全体フロー

## Organizer

```text
トップ
↓
サポートページを作る
↓
ログイン
↓
誰をサポートするか入力
↓
支援期間設定
↓
支援内容追加
↓
プレビュー
↓
公開
↓
共有URL生成
↓
LINE等で共有
```

## Supporter

```text
LINE等からURLを開く
↓
支援ページを見る
↓
空いている予定を見る
↓
担当したい予定を選ぶ
↓
名前を入力
↓
担当確定
↓
確認メール
↓
前日通知
↓
支援実施
```

---

# 10. トップページ

メインコピー案：

```text
「何かあったら言ってね」を、
本当に手伝える形に。
```

サブコピー：

```text
赤ちゃんが生まれた家族を、
友人や家族みんなで少しずつサポート。

食事、買い物、送迎など、
誰が・いつ手伝うかを簡単に共有できます。
```

CTA：

```text
サポートページを作る
```

---

# 11. 3ステップ説明

```text
1
必要なサポートを登録

2
LINEでみんなに共有

3
できる人が担当する
```

---

# 12. Organizer認証

Supabase Authを利用。

Phase 1：

- Email Magic Link

将来的には：

- Google
- Apple

を追加可能にする。

認証コードをコンポーネントへ直接依存させず、Auth abstractionを作る。

---

# 13. Supporterは登録不要

重要要件。

Supporterは、

```text
URLを開く
↓
名前
↓
必要ならメール
↓
担当確定
```

だけ。

アカウント作成を要求しない。

---

# 14. ページ作成Wizard

巨大なフォームを1画面に表示しない。

以下のWizard形式。

## Step 1

```text
誰をサポートしますか？
```

入力：

```text
田中さん家族
```

---

## Step 2

```text
いつからいつまでサポートしますか？
```

開始日・終了日。

---

## Step 3

```text
どんなサポートが必要ですか？
```

プリセット選択。

---

## Step 4

```text
ページを確認
```

---

## Step 5

```text
公開する
```

---

# 15. Support Page

基本情報：

```ts
interface SupportPage {
  id: string
  organizerId: string

  slug: string

  caseType: SupportCaseType

  title: string
  recipientDisplayName: string

  description?: string

  startDate: string
  endDate: string

  status:
    | "draft"
    | "pending_recipient_approval"
    | "published"
    | "closed"
    | "archived"

  plan:
    | "free"
    | "plus"
    | "pro"

  visibility:
    | "link"
    | "passcode"

  passcodeHash?: string

  organizationId?: string

  createdAt: string
  updatedAt: string
}
```

---

# 16. 支援枠

```ts
interface SupportSlot {
  id: string

  supportPageId: string

  categoryId: string

  title: string
  description?: string

  date: string

  startTime?: string
  endTime?: string

  quantityNeeded: number

  locationSummary?: string

  privateInstructions?: string

  status:
    | "open"
    | "assigned"
    | "completed"
    | "cancelled"

  createdAt: string
  updatedAt: string
}
```

---

# 17. 初期テンプレート

Organizerが毎回文章を考えなくて済むようにする。

### 食事

```text
夕食を届ける
```

### 買い物

```text
食料品を買う
```

### 送迎

```text
上の子を送迎する
```

### 家事

```text
ゴミ出し
```

### ペット

```text
犬の散歩
```

---

# 18. 支援枠登録

入力：

- カテゴリ
- タイトル
- 日付
- 開始時間
- 終了時間
- 説明
- 必要人数
- 受け渡し概要
- 担当者だけに表示する情報

---

# 19. 食事カテゴリ

追加項目：

- 人数
- 苦手な食べ物
- アレルギー等の注意
- 受け渡し希望

ただし任意入力。

UIには、

```text
必要な内容だけ入力してください。
```

と表示。

詳細な健康情報入力を促さない。

---

# 20. プライバシー設計

公開ページに、

- 詳細住所
- 電話番号
- メール
- 健康情報

を表示しない。

---

# 21. Private Instructions

担当確定後だけ表示する情報を持てるようにする。

例：

```text
○○マンション101号室

インターホンは押さず、
玄関前のボックスへお願いします。
```

これを未担当ユーザーには返さない。

API / RPC側でも制御する。

---

# 22. Recipient Approval

将来的に非常に重要。

Organizerが本人以外の場合、

```text
ページ作成
↓
Recipientへ確認URL
↓
Recipientが内容確認
↓
承認
↓
公開
```

できる仕組みを作る。

Phase 1ではFeature FlagでOFFでもよい。

データモデルは最初から対応する。

---

# 23. 公開ページ

URL：

```text
/s/[slug]
```

検索エンジンには出さない。

必ず：

```html
noindex,nofollow
```

相当を設定。

---

# 24. Supporter向けUI

スマートフォン最優先。

例：

```text
田中さん家族を
みんなでサポート

8/20〜9/20


8月20日

🍱 夕食を届ける
18:00〜19:00

募集中

［私が担当する］


8月21日

🛒 食料品を買う
17:00

佐藤さんが担当
```

---

# 25. タイムライン

Phase 1では複雑な月カレンダーを作らない。

日付順縦型UIを中心とする。

後から、

- 月表示
- 週表示

を追加可能にする。

---

# 26. 担当登録

入力：

```text
お名前
```

任意：

```text
メールアドレス
```

任意：

```text
ひとこと
```

確定：

```text
この予定を担当する
```

---

# 27. Assignment

```ts
interface SlotAssignment {
  id: string

  slotId: string

  supporterName: string

  supporterEmail?: string

  message?: string

  editTokenHash: string

  status:
    | "active"
    | "cancelled"
    | "completed"

  createdAt: string
}
```

---

# 28. 同時担当防止

非常に重要。

2人が同時に担当ボタンを押しても1人のみ成功すること。

クライアント側チェックだけは禁止。

Supabase PostgreSQL側で、

- unique constraint
- transaction
- RPC

等を使う。

---

# 29. 担当キャンセル

Supporterはアカウント不要。

担当時に発行したセキュアトークンを利用する。

```text
/manage-assignment/[token]
```

から、

```text
担当をキャンセル
```

可能。

---

# 30. 担当変更

将来的に、

```text
佐藤 → 山田
```

など引き継ぎ可能にする。

Phase 1ではキャンセル→再担当でよい。

---

# 31. Organizer Dashboard

Organizerが確認できるもの：

- アクティブページ
- 支援期間
- 支援枠総数
- 担当済み数
- 募集中数
- 充足率

例：

```text
12件中8件が決まりました

67%
```

---

# 32. Organizer操作

- ページ編集
- 支援枠追加
- 支援枠編集
- 支援枠削除
- 担当確認
- ページ公開
- 非公開
- 終了
- 共有
- 一括メッセージ

---

# 33. 通知

Resend等を抽象化して使用。

NotificationServiceを作る。

---

# 34. 必須通知

## Supporter

担当確定：

```text
8月20日の
「夕食を届ける」を担当しました。
```

前日：

```text
明日は「夕食を届ける」の予定があります。
```

当日：

```text
本日はサポート予定日です。
```

---

## Organizer

```text
佐藤さんが
8月20日の「夕食を届ける」を担当しました。
```

キャンセル：

```text
8月20日の予定が再び募集中になりました。
```

---

# 35. Scheduled Jobs

将来運用を考えて、

- Supabase Scheduled Functions
- Vercel Cron

などと交換可能な構造にする。

直接コンポーネントへ依存させない。

---

# 36. LINE共有

LINE Loginは不要。

Web Share APIを優先。

```text
LINEで共有
リンクをコピー
その他の方法で共有
```

を用意。

---

# 37. パスコード

Organizerが任意設定。

4〜8桁。

DBには平文保存禁止。

ハッシュ化。

---

# 38. 完了状態

支援期間終了後：

```text
サポート期間が終了しました

みなさんありがとうございました。
```

ページはすぐ削除せず、

`closed`

状態にする。

---

# 39. Thanks機能

将来的にRecipient / Organizerから、

```text
みなさんのおかげで
最初の1か月を無事過ごせました。
ありがとうございました。
```

という終了メッセージを掲載可能。

Supporterへ通知。

---

# 40. 写真

Plus機能。

ページヘッダーに1枚程度。

アルバムサービスにはしない。

---

# 41. カレンダー連携

Plus機能。

Supporterが担当した予定を、

```text
Google Calendar
Apple Calendar
Outlook
```

に追加できるようICS生成。

---

# 42. 料金体系

最終的に以下の3層を想定する。

---

# FREE

目的：

利用を広げる。

機能：

- サポートページ
- 基本支援枠
- URL共有
- 担当機能
- 基本メール通知
- 基本テンプレート

---

# PLUS

**1ページ単位買い切り**

想定価格：

```text
980〜1,480円
```

設定値として管理し、コードにハードコードしない。

機能候補：

- 1日複数支援
- 自由カテゴリ
- 支援期間延長
- 写真
- 詳細通知
- カレンダー連携
- 一括メッセージ
- テンプレート追加
- ページデザイン
- 終了後アーカイブ
- 詳細な担当管理

---

# 43. Plus課金

Stripe Checkoutを使用。

Payment abstractionを作る。

```ts
interface PaymentProvider {
  createCheckoutSession(...)
  getPaymentStatus(...)
}
```

StripeへUIを直接依存させない。

---

# 44. Paymentデータ

```ts
interface Purchase {
  id: string

  userId: string

  supportPageId?: string
  organizationId?: string

  product:
    | "page_plus"
    | "organization_subscription"

  amount: number
  currency: "JPY"

  provider: "stripe"

  providerPaymentId: string

  status:
    | "pending"
    | "paid"
    | "refunded"
    | "failed"

  createdAt: string
}
```

---

# 45. Proプラン

将来的なB2B/B2G。

対象：

- NPO
- 助産院
- 産婦人科
- 子育て団体
- 企業福利厚生
- 地域コミュニティ

---

# 46. Pro料金仮説

設定可能にする。

例：

```text
月額 2,980円〜9,800円
```

規模別プランを将来追加可能。

---

# 47. Pro機能

- 複数Support Page管理
- スタッフアカウント
- Organizer複数人
- 組織テンプレート
- 一括ページ作成
- 利用状況分析
- CSV
- 組織ロゴ
- カスタム案内文
- 支援ページ管理
- 権限設定
- 月間作成上限
- API

---

# 48. Organization

```ts
interface Organization {
  id: string

  name: string

  slug: string

  logoUrl?: string

  plan:
    | "pro"

  subscriptionStatus:
    | "trial"
    | "active"
    | "past_due"
    | "cancelled"

  createdAt: string
}
```

---

# 49. Organization Member

```ts
interface OrganizationMember {
  organizationId: string

  userId: string

  role:
    | "owner"
    | "admin"
    | "member"
}
```

---

# 50. ギフト機能

将来的な重要マネタイズ。

遠方で直接支援できない人向け。

Support Slotに、

```text
自分で届ける
```

以外に、

```text
代わりにギフトを贈る
```

を表示できるようにする。

---

# 51. Giftカテゴリ

例：

- 食事
- ネットスーパー
- 冷凍食品
- ベビー用品
- 日用品
- ギフトカード

---

# 52. Gift Partner

```ts
interface GiftPartner {
  id: string

  name: string

  category: string

  logoUrl: string

  destinationUrl: string

  affiliateType:
    | "affiliate"
    | "revenue_share"
    | "none"

  active: boolean
}
```

---

# 53. ギフト送客収益

将来的には、

```text
Supporter
↓
ギフトを贈る
↓
提携先
↓
購入
↓
送客手数料
```

を収益源にする。

ただしスポンサー表示や広告表示は明確にする。

---

# 54. Gift Click Analytics

```text
gift_partner_impression

gift_partner_click

gift_purchase_confirmed
```

を取得可能にする。

---

# 55. 寄付・支援金

将来的な候補。

ただし、

**Phase 1では実装禁止。**

法律・決済・資金移動・返金・本人確認等を別途確認してから有効化する。

データモデル上のみ将来追加可能にする。

---

# 56. 寄付機能を設計する場合

将来的には、

```text
料理を届ける

または

1,000円分支援する
```

など。

ただしRecipientへ直接送金する機能は、

Feature Flag：

```text
ENABLE_CONTRIBUTIONS=false
```

をデフォルトとする。

---

# 57. Feature Flags

将来機能を段階的に公開する。

```ts
ENABLE_PLUS
ENABLE_PRO
ENABLE_GIFT_PARTNERS
ENABLE_RECIPIENT_APPROVAL
ENABLE_CONTRIBUTIONS
ENABLE_CASE_TYPES
ENABLE_CALENDAR_VIEW
ENABLE_SMS
```

環境設定またはFeature Flag serviceから管理。

---

# 58. 将来の対象拡張

Phase 1：

```text
産後
```

Phase 2：

```text
退院・療養
```

Phase 3：

```text
家族介護
```

Phase 4：

```text
服喪・一時的生活支援
```

ただし健康情報の詳細入力サービスにはしない。

---

# 59. Case Template

```ts
interface CaseTemplate {
  id: string

  caseType: SupportCaseType

  name: string

  description: string

  suggestedCategories: string[]

  suggestedSlots: SuggestedSlot[]

  active: boolean
}
```

これによってUIを書き直さず用途を増やせるようにする。

---

# 60. 例えば療養テンプレート

```text
夕食

買い物

病院への送迎

犬の散歩

ゴミ出し
```

---

# 61. 家族介護テンプレート

```text
買い物

食事

ゴミ出し

付き添い

その他
```

ただし介護事業者マッチングにはしない。

---

# 62. 支援者プロフィール

Phase 1では作らない。

将来的に希望者だけ、

```text
Supporter Profile
```

を作成可能にする。

メリット：

- 名前入力不要
- 担当履歴
- カレンダー
- 通知設定

ただし必須アカウントにはしない。

---

# 63. Repeating Slots

将来機能。

例：

```text
毎週月曜日 18:00
夕食
```

RRULE等で管理。

---

# 64. 複数担当者

Phase 1は1枠1人。

将来：

```text
引っ越し手伝い
必要人数：3
```

等に対応。

DBでは `quantityNeeded` を最初から持つ。

---

# 65. 待機リスト

将来的には、

担当済み枠について、

```text
キャンセルが出たら知らせる
```

を追加可能。

---

# 66. メッセージ

チャットは作らない。

OrganizerからSupporter全員への、

**一方向のお知らせ**

のみ将来実装。

例：

```text
今週の夕食は十分集まりました。
ありがとうございます。
```

---

# 67. 個別チャットを作らない理由

- モデレーション
- 通知
- トラブル
- 個人情報
- UX複雑化

を避ける。

必要ならLINE等を使用してもらう。

---

# 68. Analytics

最初から実装。

個人情報を送らない。

---

# 69. 必須イベント

```text
landing_viewed

create_started

create_step_completed

page_created

page_published

share_clicked

public_page_viewed

slot_impression

slot_viewed

assignment_started

assignment_completed

assignment_cancelled

page_completed
```

---

# 70. 課金イベント

```text
plus_offer_viewed

plus_checkout_started

plus_purchased

pro_trial_started

pro_subscribed

gift_partner_clicked
```

---

# 71. KPI

最重要：

### Activation

```text
ページを作ったOrganizerのうち
共有まで行った割合
```

### Participation

```text
共有URLを開いた人のうち
担当した割合
```

### Fill Rate

```text
支援枠のうち
担当が決まった割合
```

### Virality

```text
1ページあたりSupporter数
```

### Monetization

```text
Free → Plus転換率
```

---

# 72. North Star Metric

初期：

> **1か月あたり実際に担当が決まった支援枠数**

単なる登録ユーザー数より優先。

---

# 73. Funnel

```text
トップ

↓

ページ作成開始

↓

ページ完成

↓

公開

↓

共有

↓

Supporter閲覧

↓

担当開始

↓

担当完了
```

各段階を計測。

---

# 74. DBテーブル

最低限：

```text
profiles

support_pages

support_slots

slot_assignments

support_categories

case_templates

page_members

notifications

purchases

organizations

organization_members

gift_partners

analytics_events
```

必要に応じて正規化する。

---

# 75. Page Member

Recipientや共同Organizerに対応。

```ts
interface PageMember {
  id: string

  supportPageId: string

  userId?: string

  email?: string

  role:
    | "organizer"
    | "co_organizer"
    | "recipient"

  status:
    | "invited"
    | "accepted"
}
```

---

# 76. RLS

必ず設定。

### Organizer

自分が管理するSupport Pageのみ編集可能。

### Co-organizer

権限のあるページのみ。

### Public visitor

`published` ページのみ必要最小限閲覧。

### Assignment

Secure RPC経由。

### Private Instructions

担当トークンが有効な場合のみ。

---

# 77. Security

- IDOR対策
- RLS
- CSRF考慮
- XSS
- Rate Limit
- トークンハッシュ
- Passcodeハッシュ
- Server-side validation

を実装。

---

# 78. 個人情報

必要最小限。

詳細な住所・健康情報をAnalyticsへ絶対に送らない。

ログにも極力残さない。

---

# 79. データ削除

Organizerがページ削除可能。

将来的には、

```text
削除リクエスト
↓
一定猶予
↓
完全削除
```

を実装可能な構造。

---

# 80. UI

日本向け。

方向：

- 白ベース
- 落ち着いた色
- 柔らかい角丸
- 温かい
- しかし「ママ向けサイト」感を出しすぎない
- 性別役割を固定しない
- 家族構成を限定しない

---

# 81. 避けるデザイン

- 過剰なピンク
- 赤ちゃんキャラクター
- キラキラ
- ファンシー
- ゲームUI
- 過度なイラスト

---

# 82. PC

管理画面ではPC利用も想定。

Supporter公開ページはスマートフォン中心。

---

# 83. Accessibility

- semantic HTML
- label
- keyboard
- focus
- contrast
- aria
- screen reader

を考慮。

---

# 84. 技術構成

基本：

```text
Next.js
TypeScript
App Router
Tailwind CSS
Supabase
Vercel
Resend
Stripe
```

ただしProvider abstractionを使用。

---

# 85. Service Layer

最低限：

```text
AuthService

SupportPageService

SupportSlotService

AssignmentService

NotificationService

PaymentService

AnalyticsService

GiftPartnerService
```

UIコンポーネントから直接Supabase Queryを大量に呼ばない。

---

# 86. ディレクトリ構成例

```text
app/

  page.tsx

  create/

  dashboard/

  s/
    [slug]/

  manage-assignment/
    [token]/

  api/


components/

  support/
  organizer/
  supporter/
  forms/
  ui/


lib/

  supabase/
  auth/
  notifications/
  payments/
  analytics/
  feature-flags/


services/

types/

config/
```

---

# 87. Provider abstraction

外部サービスを交換可能にする。

例：

```ts
interface EmailProvider {
  send(...)
}
```

```ts
interface AnalyticsProvider {
  track(...)
}
```

```ts
interface PaymentProvider {
  createCheckout(...)
}
```

---

# 88. Pricing Config

コード内に金額を散在させない。

```ts
export const pricing = {
  plus: {
    price: 980,
    currency: "JPY"
  },

  pro: {
    monthly: 4980
  }
}
```

将来的にRemote Config化可能。

---

# 89. Phase 1

まず動くConsumer MVP。

実装：

- Auth
- ページ作成
- 支援枠
- 公開ページ
- URL共有
- Supporter担当
- キャンセル
- 通知
- RLS
- Analytics
- モバイルUI

---

# 90. Phase 2

収益化。

実装：

- Free / Plus
- Stripe
- Plus限定機能
- カレンダー
- 一括通知
- 写真
- Advanced Templates

---

# 91. Phase 3

ギフト・送客。

実装：

- Gift Partners
- Partner UI
- Affiliate tracking
- Gift Analytics

---

# 92. Phase 4

Organization Pro。

実装：

- Organization
- Staff
- Team roles
- Multiple pages
- Dashboard
- Subscription
- CSV
- Analytics

---

# 93. Phase 5

用途拡張。

実装：

- illness
- recovery
- caregiving
- bereavement

Case Template方式で追加。

---

# 94. Phase 6

必要性が確認できた場合のみ：

- Supporter account
- recurring slots
- waitlist
- recipient approval
- calendar integrations
- SMS

---

# 95. 実装しないもの

将来的にも基本的に避ける。

- 不特定多数マッチング
- 有償支援者
- 支援者ランキング
- SNSフィード
- フォロー
- DM
- AIチャット
- 医療相談
- 介護相談
- 診断
- 実配送
- 食品販売

---

# 96. 実装ルール

既存プロジェクトがある場合は最初に必ず確認。

- package.json
- migrations
- schema
- components
- styles
- environment
- lint
- tests

既存設計を無視して作り直さない。

---

# 97. Migration

Supabase schema変更はMigrationとして管理。

本番DBを手作業前提にしない。

---

# 98. Seed

Development用に、

```text
田中さん家族
```

のサンプルSupport PageをSeedする。

例：

```text
8/20
夕食

8/21
買い物

8/22
上の子の送迎

8/23
犬の散歩
```

---

# 99. Test

最低限テスト：

### Unit

- 支援期間
- status
- pricing
- slot capacity

### Integration

- assignment
- cancellation
- payment webhook

### E2E

```text
Organizer作成
↓
公開
↓
Supporter担当
↓
Organizer確認
↓
キャンセル
```

---

# 100. 競合状態テスト

同じSlotへ同時に2人が申し込むE2E / integration testを作る。

必ず一人だけ成功。

---

# 101. Build確認

完了前に：

```text
TypeScript

ESLint

Tests

Production build
```

すべて通す。

---

# 102. モバイル確認

最低：

```text
375px
390px
430px
```

確認。

---

# 103. プロダクト判断

仕様にない大型機能を勝手に追加しない。

ただし内部設計については、

**将来のPhase 2〜6を壊さない構造**

を優先する。

---

# 104. 最終的なビジネスモデル

```text
Consumer

無料で支援ページを作る

↓

友人・家族へ共有

↓

実際に支援が成立

↓

必要ならPlus購入
```

さらに、

```text
Supporter

遠方なので直接支援できない

↓

ギフトを贈る

↓

Partner送客収益
```

さらに、

```text
NPO
助産院
医療機関
企業

↓

複数ページを運営

↓

Pro Subscription
```

という3本柱。

---

# 105. 収益源

最終的には、

### 1
Support Page Plus

**1ページ買い切り**

### 2
Organization Pro

**月額サブスク**

### 3
Gift Partner

**送客・成果報酬**

### 4

将来的に適法性・需要を確認できた場合のみ、

**支援金決済関連手数料**

を検討する。

---

# 106. Product Loop

重要。

```text
赤ちゃんが生まれる

↓

友人Aがページ作成

↓

10人にLINE共有

↓

友人Bが支援

↓

数か月後

友人Bの周囲でも出産

↓

Bが新しいページ作成
```

広告だけに依存せず、

**支援者自身が次のOrganizerになる**

構造を狙う。

---

# 107. 紹介導線

支援ページ終了後、

Supporterへ、

```text
あなたの大切な人にも
サポートが必要になったときは
無料でページを作れます。
```

程度を表示。

過度なマーケティングはしない。

---

# 108. 最重要KPI

ビジネス初期では、

売上より、

> **作られたSupport Pageのうち、実際に1件以上の支援担当が成立した割合**

を最重要視する。

---

# 109. 最終ゴール

これは単なる、

**「産後カレンダーアプリ」**

ではありません。

最終的には、

> **身近な人が一時的に困ったとき、周囲の人が具体的に助けるためのインフラ**

を目指します。

ただしサービスを大きく見せるために、初期UXを複雑にしてはいけません。

利用者から見える体験は常に、

```text
ページを作る

↓

LINEで共有する

↓

できる人が担当する
```

という極めてシンプルなものにしてください。

内部では、

- Free / Plus
- Organization Pro
- Gift monetization
- Case Templates
- Recipient Approval
- Notifications
- Analytics
- Payment
- Feature Flags
- Role management

まで拡張可能な設計にしてください。

---

# 110. Codexへの最終指示

この仕様全体を読んだうえで、まず既存リポジトリを調査してください。

その後、

1. 現在のコード構成
2. 必要なDB Migration
3. 実装Phase
4. 変更対象ファイル
5. 技術上の重大な懸念点

を整理してください。

そのまま実装を進めてください。

軽微なUI判断について質問は不要です。

ただし、

- 個人情報の公開範囲
- 実決済
- 支援金送金
- 外部の実サービスとの連携
- セキュリティモデルの重大変更

について、仕様から逸脱する判断を勝手に行わないでください。

実装はPhase単位で進め、各Phase終了時に、

```text
実装したもの

変更ファイル

DB変更

テスト結果

残課題
```

を簡潔に報告してください。

最終的に、

**Phase 1からPhase 6まで拡張しても土台を作り直す必要がない構造**

を目標としてください。
