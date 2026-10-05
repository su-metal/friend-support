"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Pencil,
  Check,
  CalendarDays,
  LogOut,
  Ellipsis,
  Trash2,
} from "lucide-react";
import type { OrganizerPage } from "@/types/domain";
import { categories } from "@/config/product";
import { fillStats, dateLabel, isPageClosed, todayJst } from "@/lib/domain";
import { ErrorMessage, postJson, requestJson, Modal } from "./ui";
import { ShareButtons } from "./share";
export function AccountSignOut() {
  const router = useRouter();
  return (
    <button
      className="text-button"
      onClick={async () => {
        await requestJson("/api/auth/session", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut size={15} />
      ログアウト
    </button>
  );
}
export function DashboardList({ pages }: { pages: OrganizerPage[] }) {
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR SUPPORT PAGES</p>
          <h1>みんなのサポートを、ここから。</h1>
          <p className="muted">あなたが作ったサポートページ</p>
        </div>
        <Link href="/create" className="button primary">
          <Plus size={18} />
          ページを作る
        </Link>
      </div>
      {pages.length ? (
        <div className="dashboard-pages">
          {pages.map((p) => {
            const stats = fillStats(p.slots);
            return (
              <Link
                href={`/dashboard/${p.id}`}
                className="dashboard-page-card"
                key={p.id}
              >
                <div className="row between">
                  <span className={`tag page-status-${p.status}`}>
                    {isPageClosed(p)
                      ? "終了"
                      : p.status === "published"
                        ? "公開中"
                        : "下書き"}
                  </span>
                  <ArrowUpRight size={21} />
                </div>
                <h2>{p.recipientDisplayName}</h2>
                <p className="period small">
                  <CalendarDays size={15} />
                  {dateLabel(p.startDate)} – {dateLabel(p.endDate)}
                </p>
                <div className="row between">
                  <p>
                    <strong>{stats.filled}</strong> / {stats.total}
                    件の担当が確定
                  </p>
                  <span>{stats.percent}%</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${stats.percent}%` }} />
                </div>
                <p className="small muted">募集中 {stats.open}件</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-state large">
          <CalendarDays size={42} />
          <h2>最初のサポートページを作りましょう。</h2>
          <p>必要な予定を登録して、家族や友人に共有できます。</p>
          <Link href="/create" className="button primary">
            <Plus size={17} />
            サポートページを作る
          </Link>
        </div>
      )}
    </>
  );
}
export function DashboardDetail({
  page,
  publicUrl,
  justPublished,
}: {
  page: OrganizerPage;
  publicUrl: string;
  justPublished: boolean;
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [statusConfirm, setStatusConfirm] = useState<"draft" | "closed" | null>(
      null,
    ),
    [menuOpen, setMenuOpen] = useState(false);
  const stats = fillStats(page.slots),
    closed = isPageClosed(page),
    today = todayJst();
  async function changeStatus(status: string) {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/pages/${page.id}`, { status }, "PATCH");
      setStatusConfirm(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "変更できませんでした");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={16} />
        マイページへ
      </Link>
      {justPublished && (
        <div className="success-notice">
          <Check size={20} />
          <div>
            <strong>サポートページを公開しました。</strong>
            <p>リンクを家族や友人に共有して、手助けをつなげましょう。</p>
          </div>
        </div>
      )}
      <div className="dashboard-heading detail">
        <div>
          <span className={`tag page-status-${page.status}`}>
            {closed
              ? "終了"
              : page.status === "published"
                ? "公開中"
                : "下書き"}
          </span>
          <h1>{page.recipientDisplayName}のサポート</h1>
          <p className="period">
            <CalendarDays size={16} />
            {dateLabel(page.startDate)} – {dateLabel(page.endDate)}
          </p>
        </div>
        <div className="row">
          <Link
            href={`/s/${page.slug}`}
            className={`button secondary ${page.status === "draft" ? "disabled-link" : ""}`}
            aria-disabled={page.status === "draft"}
            tabIndex={page.status === "draft" ? -1 : undefined}
          >
            共有ページ
            <ArrowUpRight size={16} />
          </Link>
          <div className="more-menu">
            <button
              className="icon-button"
              aria-label="ページの操作"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Ellipsis />
            </button>
            {menuOpen && (
              <div className="more-options">
                {page.status === "published" && !closed && (
                  <>
                    <button
                      onClick={() => {
                        setStatusConfirm("draft");
                        setMenuOpen(false);
                      }}
                    >
                      非公開にする
                    </button>
                    <button
                      onClick={() => {
                        setStatusConfirm("closed");
                        setMenuOpen(false);
                      }}
                    >
                      サポートを終了する
                    </button>
                  </>
                )}
                <button
                  className="danger-text"
                  onClick={() => {
                    setDeleteOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 size={15} />
                  ページを削除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="dashboard-summary">
        <div>
          <p className="muted small">みんなのサポート状況</p>
          <h2>
            {stats.total}件中 <span>{stats.filled}件</span>が決まりました
          </h2>
          <div className="progress-track">
            <span style={{ width: `${stats.percent}%` }} />
          </div>
        </div>
        <div className="stat">
          <strong>{stats.open}</strong>
          <span>募集中</span>
        </div>
        <div className="stat">
          <strong>
            {stats.percent}
            <small>%</small>
          </strong>
          <span>充足率</span>
        </div>
      </div>
      {page.status === "draft" ? (
        <div className="dashboard-share">
          <h2>ページを公開して、共有しましょう。</h2>
          <p className="muted">
            内容をご本人に確認してもらったら、公開できます。
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => changeStatus("published")}
          >
            {busy ? "公開しています…" : "ページを公開する"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      ) : (
        <div className="dashboard-share">
          <h2>身近な人に、サポートをつなぐ。</h2>
          <p className="muted">
            共有リンクを家族や友人へ。
            {page.visibility === "passcode" &&
              "パスコードは別の方法で伝えてください。"}
          </p>
          <ShareButtons url={publicUrl} title={page.title} pageId={page.id} />
        </div>
      )}
      <section className="organizer-schedule">
        <div className="row between wrap">
          <h2>サポート予定と担当</h2>
          {!closed && (
            <Link
              href={`/dashboard/${page.id}/edit`}
              className="button secondary"
            >
              <Pencil size={16} />
              ページ・予定を編集
            </Link>
          )}
        </div>
        <div className="organizer-slots">
          {page.slots.map((s) => {
            const a = page.assignments.find(
              (a) =>
                a.slotId === s.id && ["active", "completed"].includes(a.status),
            );
            return (
              <article className="organizer-slot" key={s.id}>
                <div className="organizer-slot-top">
                  <span className="category-icon">
                    {categories.find((c) => c.id === s.categoryId)?.icon}
                  </span>
                  <div>
                    <small className="muted">
                      {dateLabel(s.date)} {s.startTime}
                    </small>
                    <h3>{s.title}</h3>
                  </div>
                  <span
                    className={`tag ${s.status === "open" ? "tag-open" : ""}`}
                  >
                    {s.status === "open"
                      ? "募集中"
                      : s.status === "completed"
                        ? "完了"
                        : "担当確定"}
                  </span>
                </div>
                {a && (
                  <div className="organizer-assignment">
                    <span className="avatar">
                      {a.supporterName.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{a.supporterName}さん</strong>
                      {a.supporterEmail && <p>{a.supporterEmail}</p>}
                      {a.message && (
                        <p className="assignment-message">{a.message}</p>
                      )}
                    </div>
                    {s.status === "assigned" && s.date > today && (
                      <span className="slot-complete-note">
                        予定日以降に完了にできます
                      </span>
                    )}
                    {s.status === "assigned" && s.date <= today && (
                      <button
                        className="button small-button secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await postJson(
                              `/api/pages/${page.id}`,
                              { action: "complete", slotId: s.id },
                              "PATCH",
                            );
                            router.refresh();
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "変更できませんでした",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        完了にする
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      {statusConfirm && (
        <Modal
          title={
            statusConfirm === "closed"
              ? "サポートを終了しますか？"
              : "ページを非公開にしますか？"
          }
          onClose={() => setStatusConfirm(null)}
        >
          <p>
            {statusConfirm === "closed"
              ? "担当の受付を終了します。終了後はページの編集と再公開ができなくなります。"
              : "共有リンクからページを閲覧・担当登録できなくなります。再公開はいつでもできます。"}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setStatusConfirm(null)}
            >
              戻る
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => changeStatus(statusConfirm)}
            >
              {statusConfirm === "closed" ? "終了する" : "非公開にする"}
            </button>
          </div>
        </Modal>
      )}
      {deleteOpen && (
        <Modal
          title="ページを削除しますか？"
          onClose={() => setDeleteOpen(false)}
        >
          <p>
            「{page.recipientDisplayName}
            」のページ、予定、担当者情報を削除します。この操作は取り消せません。
          </p>
          <ErrorMessage message={error} />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleteOpen(false)}
            >
              戻る
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await requestJson(`/api/pages/${page.id}`, {
                    method: "DELETE",
                  });
                  router.push("/dashboard");
                  router.refresh();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "削除できませんでした",
                  );
                  setBusy(false);
                }
              }}
            >
              {busy ? "削除しています…" : "ページを削除する"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
