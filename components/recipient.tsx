"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  LockKeyhole,
  MessageCircle,
} from "lucide-react";
import {
  categories,
  considerationOptions,
  recipientRequestTemplates,
} from "@/config/product";
import { addDays, dateLabel, todayJst } from "@/lib/domain";
import type {
  ConsiderationId,
  RecipientRequestKind,
  RecipientView,
} from "@/types/domain";
import { ErrorMessage, Modal, postJson } from "./ui";

type Created = { date: string; title: string };

export function lineShareText(
  page: { slug: string },
  created: Created,
  origin: string,
) {
  return `【となりの手】新しいお願いがあります\n${dateLabel(created.date)} ${created.title}\n${origin}/s/${page.slug}`;
}

export function RecipientHome({
  view,
  token,
}: {
  view: RecipientView;
  token: string;
}) {
  const [kind, setKind] = useState<RecipientRequestKind | null>(null),
    [created, setCreated] = useState<Created | null>(null);
  if (created)
    return (
      <RecipientDone
        view={view}
        created={created}
        onBack={() => setCreated(null)}
      />
    );
  if (kind)
    return (
      <RecipientRequestForm
        view={view}
        token={token}
        kind={kind}
        onBack={() => setKind(null)}
        onCreated={(c) => {
          setKind(null);
          setCreated(c);
        }}
      />
    );
  return <RecipientOverview view={view} token={token} onPick={setKind} />;
}

function RecipientOverview({
  view,
  token,
  onPick,
}: {
  view: RecipientView;
  token: string;
  onPick: (kind: RecipientRequestKind) => void;
}) {
  const router = useRouter(),
    [withdrawId, setWithdrawId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { page } = view,
    paused = !!page.pausedAt,
    today = todayJst(),
    upcoming = view.slots.filter((s) => s.date >= today);
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理できませんでした");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recipient-wrap">
      <div className="recipient-heading">
        <span className="tag">ご本人用</span>
        <h1>
          {page.recipientDisplayName}、<br />
          困ったときはここから
        </h1>
        <p className="muted">
          お願いはそのまま、みんなのページに出ます。ページを作った方にも届きます。
        </p>
      </div>
      {(page.considerations ?? []).includes("no_return_gift") && (
        <div className="success-notice">
          <Check size={18} />
          <p>お返しは不要です、と支援する方に伝わっています。気軽にどうぞ。</p>
        </div>
      )}
      <ErrorMessage message={error} />
      {view.canRequest ? (
        <section className="recipient-card">
          <h2>困っていることを出す</h2>
          {view.slotLimitReached ? (
            <p className="field-hint">
              予定の数が上限に達しています。ページを作った方に整理を頼んでください。
            </p>
          ) : (
            <div className="recipient-choices">
              {recipientRequestTemplates.map((t) => (
                <button
                  key={t.kind}
                  className="recipient-choice"
                  onClick={() => onPick(t.kind)}
                >
                  <span aria-hidden="true">
                    {categories.find((c) => c.id === t.categoryId)?.icon}
                  </span>
                  <strong>{t.label}</strong>
                  <small>{t.hint}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="closed-message">
          <h2>
            {page.status === "draft"
              ? "ページはまだ公開されていません"
              : "サポートの受付は終わりました"}
          </h2>
          <p>
            {page.status === "draft"
              ? "公開されると、ここからお願いを出せるようになります。"
              : "ご用があるときは、ページを作った方に直接連絡してください。"}
          </p>
        </div>
      )}
      <section className="recipient-section">
        <h2>これからの予定</h2>
        {upcoming.length === 0 && (
          <p className="muted small">これからの予定はまだありません。</p>
        )}
        <div className="recipient-slots">
          {upcoming.map((s) => (
            <article className="recipient-slot" key={s.id}>
              <div className="row between">
                <small className="muted">
                  {s.date === today ? "今日 " : ""}
                  {dateLabel(s.date)}
                  {s.startTime &&
                    ` ${s.startTime}${s.endTime ? `〜${s.endTime}` : ""}`}
                </small>
                <span
                  className={`tag ${s.status === "open" ? "tag-open" : ""}`}
                >
                  {s.status === "open"
                    ? "募集中"
                    : s.status === "completed"
                      ? "完了"
                      : "担当決定"}
                </span>
              </div>
              <h3>{s.title}</h3>
              {s.status !== "open" && s.supporterNames.length > 0 && (
                <p>担当：{s.supporterNames.join("、")}さん</p>
              )}
              {s.status === "assigned" && (
                <p className="field-hint">
                  予定を変えたいときは、{s.supporterNames.join("、")}
                  さんかページを作った方に直接連絡してください。
                </p>
              )}
              {s.mine && <p className="field-hint">あなたが出したお願い</p>}
              {s.mine && s.status === "open" && (
                <button
                  className="cancel-link"
                  onClick={() => setWithdrawId(s.id)}
                >
                  このお願いを取り消す
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      {view.canRequest && (
        <>
          <section className="recipient-card">
            <h2>少し休みたいとき</h2>
            <p className="muted small">
              {paused
                ? "いまはお休み中です。新しい担当の受付を止めています。"
                : "お休みにすると、新しい担当の受付を止めます。決まっている予定はそのままです。"}
            </p>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() =>
                run(() =>
                  postJson("/api/recipient/settings", {
                    token,
                    paused: !paused,
                  }),
                )
              }
            >
              {paused ? "受付を再開する" : "受付をお休みにする"}
            </button>
          </section>
          <ConsiderationsForm
            initial={page.considerations ?? []}
            busy={busy}
            onSave={(considerations) =>
              run(() =>
                postJson("/api/recipient/settings", { token, considerations }),
              )
            }
          />
        </>
      )}
      <p className="field-hint">
        このページはご本人用です。リンクを他の人に送らないでください。
      </p>
      {withdrawId && (
        <Modal
          title="このお願いを取り消しますか？"
          onClose={() => setWithdrawId(null)}
        >
          <p>みんなのページからも消えます。</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setWithdrawId(null)}
            >
              戻る
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await run(() =>
                    postJson("/api/recipient/withdraw", {
                      token,
                      slotId: withdrawId,
                    }),
                  )
                )
                  setWithdrawId(null);
              }}
            >
              取り消す
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ConsiderationsForm({
  initial,
  busy,
  onSave,
}: {
  initial: ConsiderationId[];
  busy: boolean;
  onSave: (ids: ConsiderationId[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState(initial),
    [saved, setSaved] = useState(false);
  const changed =
    selected.length !== initial.length ||
    selected.some((id) => !initial.includes(id));
  return (
    <section className="recipient-card">
      <h2>支援する方へのお願い</h2>
      <p className="muted small">選んだものがみんなのページに表示されます。</p>
      <div className="consideration-options">
        {considerationOptions.map((o) => (
          <label className="consideration-option" key={o.id}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) => {
                setSaved(false);
                setSelected(
                  e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((id) => id !== o.id),
                );
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
      <button
        className="button secondary full"
        disabled={busy || !changed}
        onClick={async () => {
          if ((await onSave(selected)) !== false) setSaved(true);
        }}
      >
        お願いを保存する
      </button>
      <p className="status-message" role="status">
        {saved && !changed ? "保存しました" : ""}
      </p>
    </section>
  );
}

function RecipientRequestForm({
  view,
  token,
  kind,
  onBack,
  onCreated,
}: {
  view: RecipientView;
  token: string;
  kind: RecipientRequestKind;
  onBack: () => void;
  onCreated: (c: Created) => void;
}) {
  const router = useRouter(),
    template = recipientRequestTemplates.find((t) => t.kind === kind)!,
    today = todayJst(),
    tomorrow = addDays(today, 1),
    minDate = view.page.startDate > today ? view.page.startDate : today;
  const quick = [
    { label: "今日", value: today },
    { label: "明日", value: tomorrow },
  ].filter((d) => d.value >= minDate && d.value <= view.page.endDate);
  const [date, setDate] = useState(minDate),
    [custom, setCustom] = useState(!quick.some((d) => d.value === minDate)),
    [startTime, setStartTime] = useState(""),
    [endTime, setEndTime] = useState(""),
    [title, setTitle] = useState(template.title),
    [description, setDescription] = useState(""),
    [privateInstructions, setPrivateInstructions] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="recipient-wrap">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        もどる
      </button>
      <form
        className="recipient-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await postJson("/api/recipient/requests", {
              token,
              request: {
                kind,
                date,
                startTime,
                endTime,
                title,
                description,
                privateInstructions,
              },
            });
            router.refresh();
            onCreated({ date, title });
          } catch (e) {
            setError(e instanceof Error ? e.message : "出せませんでした");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted small">{template.label}</p>
        <h1>いつお願いしたいですか</h1>
        <fieldset className="field">
          <legend>日にち</legend>
          <div className="recipient-date-choices">
            {quick.map((d) => (
              <button
                type="button"
                key={d.value}
                aria-pressed={!custom && date === d.value}
                className={!custom && date === d.value ? "active" : ""}
                onClick={() => {
                  setCustom(false);
                  setDate(d.value);
                }}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={custom}
              className={custom ? "active" : ""}
              onClick={() => setCustom(true)}
            >
              日にちを選ぶ
            </button>
          </div>
          {custom && (
            <input
              aria-label="日にち"
              type="date"
              value={date}
              min={minDate}
              max={view.page.endDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          )}
        </fieldset>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="request-start">始まり（わかれば）</label>
            <input
              id="request-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="request-end">終わり（わかれば）</label>
            <input
              id="request-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="request-title">みんなに見える予定名</label>
          <input
            id="request-title"
            value={title}
            maxLength={80}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="request-description">
            ひとこと（みんなに見えます・なくてもOK）
          </label>
          <textarea
            id="request-description"
            rows={2}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="field-hint">体調のことは書かなくて大丈夫です。</p>
        </div>
        <div className="private-form">
          <span className="tag">
            <LockKeyhole size={13} />
            担当した人にだけ伝えること
          </span>
          <div className="field">
            <label htmlFor="request-private">伝えたいこと（なくてもOK）</label>
            <textarea
              id="request-private"
              rows={3}
              maxLength={1000}
              placeholder={template.privatePlaceholder}
              value={privateInstructions}
              onChange={(e) => setPrivateInstructions(e.target.value)}
            />
            <p className="field-hint">
              みんなのページには出ません。担当を決めた人だけが見られます。
            </p>
          </div>
        </div>
        {kind === "supplies" && (
          <p className="field-hint">
            お代のやり取りは、届けてくれた方と直接お願いします。
          </p>
        )}
        <ErrorMessage message={error} />
        <button className="button primary full" disabled={busy}>
          {busy ? "出しています…" : "このお願いを出す"}
        </button>
        <p className="field-hint center">
          すぐにみんなのページに出ます。ページを作った方にも届きます。
        </p>
      </form>
    </div>
  );
}

function RecipientDone({
  view,
  created,
  onBack,
}: {
  view: RecipientView;
  created: Created;
  onBack: () => void;
}) {
  const [message, setMessage] = useState("");
  const text = lineShareText(view.page, created, window.location.origin);
  return (
    <div className="recipient-wrap">
      <div className="manage-heading">
        <span className="success-icon">
          <Check size={28} />
        </span>
        <h1>お願いを出しました</h1>
        <p>
          {dateLabel(created.date)} {created.title}
        </p>
      </div>
      <section className="recipient-card">
        <h2>急ぎなら、みんなに知らせましょう</h2>
        <p className="muted small">
          いつものLINEグループに送ると、早く気づいてもらえます。
        </p>
        <p className="recipient-share-text preserve-lines">{text}</p>
        <p className="field-hint">
          送る文には、担当した人だけに伝える内容は入りません。
        </p>
        <a
          className="button line-button full"
          href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} />
          LINEで知らせる
        </a>
        <button
          className="button secondary full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setMessage("文をコピーしました");
            } catch {
              setMessage(
                "コピーできませんでした。上の文を選択してコピーしてください。",
              );
            }
          }}
        >
          <Copy size={17} />
          文をコピー
        </button>
        <p className="status-message" role="status">
          {message}
        </p>
      </section>
      <button className="button subtle full" onClick={onBack}>
        <ArrowLeft size={16} />
        ご本人用ページにもどる
      </button>
    </div>
  );
}
