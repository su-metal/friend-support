"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ShieldCheck,
  Clock3,
  MapPin,
  Heart,
  Info,
} from "lucide-react";
import { categories, considerationOptions } from "@/config/product";
import { canAssign, dateLabel, fillStats, isPageClosed } from "@/lib/domain";
import type { PublicSupportPage, SupportSlot } from "@/types/domain";
import { Modal, ErrorMessage, postJson } from "./ui";
import { track, TrackView } from "./analytics";
// 予定が少ないときは絞り込みを出さず、一覧だけを見せる。
const FILTER_MIN_SLOTS = 5;
export function SupportPageView({
  page,
  sample = false,
  emailEnabled = false,
}: {
  page: PublicSupportPage;
  sample?: boolean;
  emailEnabled?: boolean;
}) {
  const [category, setCategory] = useState("all"),
    [onlyOpen, setOnlyOpen] = useState(false),
    [selected, setSelected] = useState<SupportSlot | null>(null);
  const stats = fillStats(page.slots),
    closed = isPageClosed(page),
    paused = !!page.pausedAt && !closed,
    considerations = considerationOptions.filter((o) =>
      (page.considerations ?? []).includes(o.id),
    ),
    assignable = page.slots.filter((s) => canAssign(page, s)).length,
    showFilters = page.slots.length > FILTER_MIN_SLOTS;
  const slots = page.slots.filter(
    (s) =>
      (category === "all" || s.categoryId === category) &&
      (!onlyOpen || canAssign(page, s)),
  );
  const dates = [...new Set(slots.map((s) => s.date))];
  useEffect(() => {
    if (!sample)
      page.slots.forEach((s) =>
        track("slot_impression", { pageId: page.id, slotId: s.id }),
      );
  }, [page.id, page.slots, sample]);
  return (
    <>
      {!sample && <TrackView name="public_page_viewed" pageId={page.id} />}
      <div className="support-hero">
        <div className="support-container">
          <p className="eyebrow">
            <Heart size={14} />
            身近なみんなで、少しずつ。
          </p>
          <div className="support-title-row">
            <div>
              <h1>
                {page.recipientDisplayName}を<br />
                みんなでサポート
              </h1>
              <p className="period">
                <CalendarDays size={17} />
                {dateLabel(page.startDate)} – {dateLabel(page.endDate)}
              </p>
            </div>
            <span className="recipient-monogram">
              {page.recipientDisplayName.slice(0, 1)}
              <Heart size={19} />
            </span>
          </div>
          {page.description && (
            <p className="support-description preserve-lines">
              {page.description}
            </p>
          )}
          <div className="support-progress">
            <p className="support-progress-lead">
              {closed ? (
                <>
                  <strong>{stats.filled}件</strong>のサポートが集まりました
                </>
              ) : paused ? (
                "ただいまお休み中です"
              ) : assignable > 0 ? (
                <>
                  手伝える予定が<strong>あと{assignable}件</strong>あります
                </>
              ) : (
                "すべての予定に担当が決まりました"
              )}
            </p>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="サポートの充足率"
              aria-valuenow={stats.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${stats.percent}%` }} />
            </div>
            <p className="support-progress-note">
              {stats.total}件中{stats.filled}件の担当が決まりました。
              {!closed &&
                assignable > 0 &&
                "できる予定をひとつ選んでください。"}
            </p>
          </div>
        </div>
      </div>
      <div className="support-container support-body">
        {sample && (
          <div className="sample-notice">
            <Info size={19} />
            <div>
              <strong>サポートページの見本です</strong>
              <p>担当ボタンから入力の流れを見られます。</p>
            </div>
          </div>
        )}
        {paused && (
          <div className="paused-notice" role="status">
            <strong>ただいまお休み中です</strong>
            <p>
              新しい担当の受付を止めています。決まっている予定はそのままです。
            </p>
          </div>
        )}
        {!closed && considerations.length > 0 && (
          <section className="considerations">
            <h2>支援する方へのお願い</h2>
            <ul>
              {considerations.map((o) => (
                <li key={o.id}>
                  <Check size={15} />
                  {o.label}
                </li>
              ))}
            </ul>
          </section>
        )}
        {closed ? (
          <div className="closed-message">
            <Heart size={32} />
            <h2>サポート期間が終了しました</h2>
            <p className="preserve-lines">
              {page.thanksMessage || "みなさんありがとうございました。"}
            </p>
            <Link href="/create" className="text-link">
              大切な人のサポートページを作る
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
            <div className="schedule-heading">
              <h2>サポートの予定</h2>
              <span className="small muted">
                登録は名前だけ・アカウント不要
              </span>
            </div>
            {showFilters && (
              <div className="filters">
                <div
                  className="category-filters"
                  aria-label="カテゴリで絞り込む"
                >
                  <button
                    className={category === "all" ? "active" : ""}
                    aria-pressed={category === "all"}
                    onClick={() => setCategory("all")}
                  >
                    すべて
                  </button>
                  {categories
                    .filter((c) =>
                      page.slots.some((s) => s.categoryId === c.id),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        aria-pressed={category === c.id}
                        className={category === c.id ? "active" : ""}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.icon} {c.name}
                      </button>
                    ))}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyOpen}
                    onChange={(e) => setOnlyOpen(e.target.checked)}
                  />
                  募集中の予定だけ
                </label>
              </div>
            )}
          </>
        )}
        <div className="timeline">
          {dates.length === 0 && (
            <div className="empty-state">
              <CalendarDays size={30} />
              <h3>該当する予定はありません</h3>
              <p>絞り込みを変えてみてください。</p>
            </div>
          )}
          {dates.map((date) => (
            <section key={date} className="timeline-day">
              <h3 className="timeline-date">
                <span className="timeline-dot" />
                {dateLabel(date)}
              </h3>
              <div className="day-slots">
                {slots
                  .filter((s) => s.date === date)
                  .map((s) => (
                    <article
                      className={`support-slot ${s.status !== "open" ? "filled" : ""}`}
                      key={s.id}
                    >
                      <div
                        className={`slot-icon category-${s.categoryId}`}
                        aria-hidden="true"
                      >
                        {categories.find((c) => c.id === s.categoryId)?.icon}
                      </div>
                      <div className="slot-main">
                        <span className="slot-category">
                          {categories.find((c) => c.id === s.categoryId)?.name}
                        </span>
                        <h4>{s.title}</h4>
                        {s.startTime && (
                          <p className="slot-time">
                            <Clock3 size={14} />
                            {s.startTime}
                            {s.endTime && ` – ${s.endTime}`}
                          </p>
                        )}
                        {s.description && (
                          <p className="slot-description">{s.description}</p>
                        )}
                        {s.locationSummary && (
                          <p className="location-summary">
                            <MapPin size={13} />
                            {s.locationSummary}
                          </p>
                        )}
                        {s.categoryId === "shopping" && s.status === "open" && (
                          <p className="slot-description">
                            立て替えたお代は、ご本人やページを作った方と直接やり取りしてください。
                          </p>
                        )}
                        <span className={`slot-status ${s.status}`}>
                          <span>
                            {s.status === "open" ? "●" : <Check size={13} />}
                          </span>
                          {s.status === "open"
                            ? canAssign(page, s)
                              ? "募集中"
                              : paused
                                ? "お休み中"
                                : "受付終了"
                            : s.status === "completed"
                              ? "サポート完了"
                              : `${s.supporterNames.join("、")}さんが担当`}
                        </span>
                      </div>
                      {canAssign(page, s) && !closed && (
                        <button
                          className="button slot-cta"
                          onClick={() => {
                            setSelected(s);
                            if (!sample) {
                              track("slot_viewed", {
                                pageId: page.id,
                                slotId: s.id,
                              });
                              track("assignment_started", {
                                pageId: page.id,
                                slotId: s.id,
                              });
                            }
                          }}
                        >
                          私が担当する
                          <ArrowRight size={15} />
                        </button>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <div className="support-privacy">
          <ShieldCheck size={22} />
          <div>
            <strong>
              住所などの詳しい案内は、担当が決まった人にだけ表示されます。
            </strong>
            <p>共有リンクは、ご本人の了承を得た範囲でお使いください。</p>
          </div>
        </div>
        <div className="support-bottom">
          <Heart size={19} />
          <p>
            できることを、できる日に。
            <br />
            ひとつの手助けが、毎日の安心につながります。
          </p>
        </div>
      </div>
      {selected && (
        <Modal title="この予定を担当する" onClose={() => setSelected(null)}>
          <AssignmentForm
            slot={selected}
            slug={page.slug}
            sample={sample}
            emailEnabled={emailEnabled}
          />
        </Modal>
      )}
    </>
  );
}
function AssignmentForm({
  slot,
  slug,
  sample,
  emailEnabled,
}: {
  slot: SupportSlot;
  slug: string;
  sample: boolean;
  emailEnabled: boolean;
}) {
  const router = useRouter(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sampleDone, setSampleDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sample) {
      setSampleDone(true);
      return;
    }
    setBusy(true);
    try {
      const result = await postJson<{ token: string }>(
        `/api/support/${slug}/assign`,
        {
          slotId: slot.id,
          supporterName: name,
          supporterEmail: email,
          message,
        },
      );
      router.push(`/manage-assignment/${result.token}?new=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "担当できませんでした");
      setBusy(false);
    }
  }
  if (sampleDone)
    return (
      <div className="sample-complete">
        <span className="success-icon">
          <Check size={26} />
        </span>
        <h3>これだけで、担当を選べます。</h3>
        <p>
          実際のページでは、このあと詳しい受け渡し方法と、キャンセル用の管理リンクが表示されます。
        </p>
        <Link href="/create" className="button primary">
          サポートページを作る
          <ArrowRight size={17} />
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit}>
      <div className="assignment-summary">
        <span className="category-icon">
          {categories.find((c) => c.id === slot.categoryId)?.icon}
        </span>
        <div>
          <strong>{slot.title}</strong>
          <p>
            {dateLabel(slot.date)} {slot.startTime}
            {slot.endTime && ` – ${slot.endTime}`}
          </p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="supporter-name">お名前</label>
        <input
          id="supporter-name"
          autoComplete="name"
          placeholder="例：佐藤（ニックネームでもOK）"
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="field-hint">ページを見る人に表示されます。</p>
      </div>
      <div className="field">
        <label htmlFor="supporter-email">メールアドレス（任意）</label>
        <input
          id="supporter-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="field-hint">
          {emailEnabled || sample
            ? "担当確認と前日・当日の通知に使います。共有ページには表示されません。"
            : "主催者にだけ表示されます。確認メールは準備中です。"}
        </p>
      </div>
      <div className="field">
        <label htmlFor="supporter-message">主催者へのひとこと（任意）</label>
        <textarea
          id="supporter-message"
          rows={2}
          maxLength={300}
          placeholder="できることがあってうれしいです！"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <ErrorMessage message={error} />
      <button className="button primary full" disabled={busy}>
        {busy
          ? "担当を確定しています…"
          : sample
            ? "見本で担当登録を試す"
            : "担当を決める"}
        <ArrowRight size={17} />
      </button>
      <p className="field-hint center">
        アカウント登録は不要です。あとからキャンセルもできます。
      </p>
    </form>
  );
}
