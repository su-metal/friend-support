import type { DocumentStore, Transaction } from "./store";
import type {
  SupportPageService,
  SupportSlotService,
  AssignmentService,
} from "./contracts";
import type {
  SupportPage,
  SupportSlot,
  SlotPrivateInfo,
  PageDraft,
  User,
  OrganizerPage,
  OrganizerAssignment,
  PublicSupportPage,
  ManagedAssignment,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import {
  addDays,
  canAssign,
  pageDraftSchema,
  assignmentSchema,
  todayJst,
} from "@/lib/domain";
import {
  secureToken,
  hashToken,
  passcodeHash,
  verifyPasscode,
  encryptContent,
} from "@/lib/security";
import { appUrl } from "@/lib/env";
export interface PageDocument extends SupportPage {
  slotIds: string[];
  organizerEmail: string;
  deletionRequestedAt?: string;
}
interface PageSecret {
  passcodeHash: string;
  accessVersion: string;
}
interface AssignmentDocument extends OrganizerAssignment {
  supportPageId: string;
  editTokenHash: string;
}
export interface NotificationDocument {
  id: string;
  supportPageId: string;
  assignmentId?: string;
  kind: string;
  to: string;
  subject: string;
  encryptedText: string;
  dueAt: string;
  status: "pending" | "sending" | "sent" | "skipped" | "failed";
  attempts: number;
  leaseUntil?: string;
  leaseId?: string;
  sentAt?: string;
}
function now() {
  return new Date().toISOString();
}
function publicFields(p: SupportPage): Omit<PublicSupportPage, "slots"> {
  return {
    id: p.id,
    slug: p.slug,
    caseType: p.caseType,
    title: p.title,
    recipientDisplayName: p.recipientDisplayName,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    status:
      p.endDate < todayJst() && p.status === "published" ? "closed" : p.status,
    plan: p.plan,
    visibility: p.visibility,
    thanksMessage: p.thanksMessage,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
async function owned(tx: Pick<Transaction, "get">, user: User, id: string) {
  const p = await tx.get<PageDocument>(`support_pages/${id}`);
  if (!p || p.deletionRequestedAt || p.organizerId !== user.id)
    throw new AppError("not_found", "ページが見つかりません", 404);
  return p;
}
async function pageBySlug(
  tx: Pick<Transaction, "get">,
  slug: string,
  version?: string,
) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return null;
  const index = await tx.get<{ pageId: string }>(`page_slugs/${slug}`);
  const p = index
    ? await tx.get<PageDocument>(`support_pages/${index.pageId}`)
    : null;
  if (
    !p ||
    p.deletionRequestedAt ||
    !["published", "closed"].includes(p.status)
  )
    return null;
  if (p.visibility === "passcode") {
    const s = await tx.get<PageSecret>(`page_secrets/${p.id}`);
    if (!s || s.accessVersion !== version) return "locked" as const;
  }
  return p;
}
async function notification(
  input: Omit<NotificationDocument, "status" | "attempts" | "encryptedText"> & {
    text: string;
  },
): Promise<NotificationDocument> {
  const { text, ...rest } = input;
  return {
    ...rest,
    encryptedText: await encryptContent(text),
    status: "pending",
    attempts: 0,
  };
}
export class SupportService
  implements SupportPageService, SupportSlotService, AssignmentService
{
  constructor(public readonly store: DocumentStore) {}
  async list(user: User) {
    const pages = await this.store.query<PageDocument>("support_pages", [
      { field: "organizerId", value: user.id },
    ]);
    const visible = pages
      .filter((p) => !p.deletionRequestedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const slots = await this.store.getMany<SupportSlot>(
      visible.flatMap((p) => p.slotIds.map((id) => `support_slots/${id}`)),
    );
    const byId = new Map(
      slots.filter((s): s is SupportSlot => s !== null).map((s) => [s.id, s]),
    );
    return visible.map((p) => ({
      ...publicFields(p),
      organizerId: p.organizerId,
      organizationId: p.organizationId,
      slots: p.slotIds.flatMap((id) => {
        const s = byId.get(id);
        return s ? [{ ...s, privateInstructions: "" }] : [];
      }),
      assignments: [],
    }));
  }
  async organizerPage(user: User, id: string): Promise<OrganizerPage> {
    const p = await owned(this.store, user, id);
    const publicSlots = await this.store.getMany<SupportSlot>(
      p.slotIds.map((id) => `support_slots/${id}`),
    );
    const secrets = await this.store.getMany<SlotPrivateInfo>(
      p.slotIds.map((id) => `slot_secrets/${id}`),
    );
    const slots = publicSlots.map((s, i) =>
      s
        ? {
            ...s,
            privateInstructions: secrets[i]?.privateInstructions ?? "",
            ...secrets[i],
          }
        : null,
    );
    const assignments = await this.store.query<AssignmentDocument>(
      "slot_assignments",
      [{ field: "supportPageId", value: id }],
    );
    return {
      ...publicFields(p),
      organizerId: p.organizerId,
      organizationId: p.organizationId,
      slots: slots
        .filter((s) => s !== null)
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        ),
      assignments: assignments.map((a) => ({
        id: a.id,
        slotId: a.slotId,
        supporterName: a.supporterName,
        supporterEmail: a.supporterEmail,
        message: a.message,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };
  }
  async publicPage(
    slug: string,
    version?: string,
  ): Promise<PublicSupportPage | "locked" | null> {
    return this.store.transaction(async (tx) => {
      const p = await pageBySlug(tx, slug, version);
      if (!p || p === "locked") return p;
      const slots = await tx.getMany<SupportSlot>(
        p.slotIds.map((id) => `support_slots/${id}`),
      );
      return {
        ...publicFields(p),
        slots: slots
          .filter(
            (s): s is SupportSlot => s !== null && s.status !== "cancelled",
          )
          .sort((a, b) =>
            `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
          ),
      };
    });
  }
  async unlock(slug: string, code: string) {
    return this.store.transaction(async (tx) => {
      const index = await tx.get<{ pageId: string }>(`page_slugs/${slug}`);
      const p = index
        ? await tx.get<PageDocument>(`support_pages/${index.pageId}`)
        : null;
      const s = p ? await tx.get<PageSecret>(`page_secrets/${p.id}`) : null;
      if (
        !p ||
        p.deletionRequestedAt ||
        !["published", "closed"].includes(p.status) ||
        !s ||
        !(await verifyPasscode(code, s.passcodeHash))
      )
        throw new AppError(
          "invalid_passcode",
          "パスコードを確認してください",
          403,
        );
      return s.accessVersion;
    });
  }
  async create(user: User, input: PageDraft) {
    const draft = pageDraftSchema.parse(input);
    const id = crypto.randomUUID(),
      slug = secureToken().slice(0, 22),
      stamp = now();
    const slots = draft.slots.map((s) => ({ ...s, id: crypto.randomUUID() }));
    const p: PageDocument = {
      id,
      organizerId: user.id,
      organizerEmail: user.email,
      slug,
      caseType: "postpartum",
      title: `${draft.recipientDisplayName}をみんなでサポート`,
      recipientDisplayName: draft.recipientDisplayName,
      description: draft.description,
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: "draft",
      plan: "free",
      visibility: draft.visibility,
      thanksMessage: "",
      slotIds: slots.map((s) => s.id),
      createdAt: stamp,
      updatedAt: stamp,
    };
    const secret = {
      passcodeHash: draft.passcode ? await passcodeHash(draft.passcode) : "",
      accessVersion: secureToken(),
    };
    await this.store.transaction(async (tx) => {
      if (await tx.get(`page_slugs/${slug}`))
        throw new AppError("retry", "もう一度お試しください", 409);
      tx.set(`profiles/${user.id}`, {
        id: user.id,
        email: user.email,
        updatedAt: stamp,
      });
      tx.set(`page_members/${id}-${user.id}`, {
        id: `${id}-${user.id}`,
        supportPageId: id,
        userId: user.id,
        role: "organizer",
        status: "accepted",
      });
      tx.set(`support_pages/${id}`, { ...p });
      tx.set(`page_slugs/${slug}`, { pageId: id });
      tx.set(`page_secrets/${id}`, secret);
      tx.set(`analytics_events/created-${id}`, {
        name: "page_created",
        properties: { pageId: id },
        createdAt: stamp,
      });
      slots.forEach((s) => this.writeSlot(tx, id, s, stamp));
    });
    return id;
  }
  private writeSlot(
    tx: Transaction,
    pageId: string,
    s: PageDraft["slots"][number] & { id: string },
    stamp: string,
    original?: SupportSlot,
  ) {
    const {
      privateInstructions,
      mealPeople,
      foodDislikes,
      allergyNotes,
      handoffPreference,
      ...publicSlot
    } = s;
    tx.set(`support_slots/${s.id}`, {
      ...publicSlot,
      supportPageId: pageId,
      status: original?.status ?? "open",
      supporterNames: original?.supporterNames ?? [],
      createdAt: original?.createdAt ?? stamp,
      updatedAt: stamp,
    });
    tx.set(`slot_secrets/${s.id}`, {
      privateInstructions,
      ...(s.categoryId === "meal"
        ? { mealPeople, foodDislikes, allergyNotes, handoffPreference }
        : {}),
    });
  }
  async save(user: User, id: string, input: PageDraft) {
    const draft = pageDraftSchema.parse(input);
    const hash = draft.passcode ? await passcodeHash(draft.passcode) : "";
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, id);
      if (["closed", "archived"].includes(p.status) || p.endDate < todayJst())
        throw new AppError("closed", "終了したページは編集できません");
      const old = await tx.getMany<SupportSlot>(
        p.slotIds.map((slotId) => `support_slots/${slotId}`),
      );
      const oldSecret = await tx.get<PageSecret>(`page_secrets/${id}`);
      const oldPrivates = await tx.getMany<SlotPrivateInfo>(
        p.slotIds.map((slotId) => `slot_secrets/${slotId}`),
      );
      const oldIds = new Set(p.slotIds);
      for (const s of draft.slots)
        if (s.id && !oldIds.has(s.id))
          throw new AppError(
            "invalid_slot",
            "このページの予定を選んでください",
          );
      for (const [i, s] of old.entries()) {
        if (!s || !["assigned", "completed"].includes(s.status)) continue;
        const replacement = draft.slots.find((n) => n.id === s.id);
        const fields = [
          "categoryId",
          "title",
          "description",
          "date",
          "startTime",
          "endTime",
          "quantityNeeded",
          "locationSummary",
        ] as const;
        const privateFields = [
          "privateInstructions",
          "mealPeople",
          "foodDislikes",
          "allergyNotes",
          "handoffPreference",
        ] as const;
        if (
          !replacement ||
          fields.some((f) => replacement[f] !== s[f]) ||
          privateFields.some((f) => replacement[f] !== oldPrivates[i]?.[f])
        )
          throw new AppError(
            "assigned_slot",
            "担当が決まっている予定は変更できません。担当者にキャンセルをお願いしてから編集してください",
            409,
          );
      }
      const slots = draft.slots.map((s) => ({
        ...s,
        id: s.id ?? crypto.randomUUID(),
      }));
      const stamp = now();
      tx.set(`support_pages/${id}`, {
        ...p,
        recipientDisplayName: draft.recipientDisplayName,
        title: `${draft.recipientDisplayName}をみんなでサポート`,
        description: draft.description,
        startDate: draft.startDate,
        endDate: draft.endDate,
        visibility: draft.visibility,
        slotIds: slots.map((s) => s.id),
        updatedAt: stamp,
      });
      tx.set(`page_secrets/${id}`, {
        passcodeHash: hash,
        accessVersion:
          p.visibility !== draft.visibility || hash !== oldSecret?.passcodeHash
            ? secureToken()
            : (oldSecret?.accessVersion ?? secureToken()),
      });
      old
        .filter(
          (s): s is SupportSlot => !!s && !slots.some((n) => n.id === s.id),
        )
        .forEach((s) => {
          tx.delete(`support_slots/${s.id}`);
          tx.delete(`slot_secrets/${s.id}`);
        });
      slots.forEach((s) =>
        this.writeSlot(
          tx,
          id,
          s,
          stamp,
          old.find((o) => o?.id === s.id) ?? undefined,
        ),
      );
    });
  }
  async setStatus(
    user: User,
    id: string,
    status: "draft" | "published" | "closed",
  ) {
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, id);
      if (
        ["closed", "archived", "pending_recipient_approval"].includes(p.status)
      )
        throw new AppError(
          "status",
          "終了したページの公開状態は変更できません",
        );
      if (
        status === "published" &&
        (!p.slotIds.length || p.endDate < todayJst())
      )
        throw new AppError("period", "支援期間と予定を確認してください");
      tx.set(`support_pages/${id}`, { ...p, status, updatedAt: now() });
      if (p.status !== status && status !== "draft")
        tx.set(`analytics_events/${status}-${id}`, {
          name: status === "published" ? "page_published" : "page_completed",
          properties: { pageId: id },
          createdAt: now(),
        });
    });
  }
  async complete(user: User, pageId: string, slotId: string) {
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, pageId);
      const s = await tx.get<SupportSlot>(`support_slots/${slotId}`);
      if (!s || !p.slotIds.includes(slotId) || s.status !== "assigned")
        throw new AppError("slot", "担当が決まっている予定を選んでください");
      if (s.date > todayJst())
        throw new AppError("future", "予定日以降に完了にできます");
      const pointer = await tx.get<{ assignmentId: string }>(
        `slot_active_assignments/${slotId}`,
      );
      const a = pointer
        ? await tx.get<AssignmentDocument>(
            `slot_assignments/${pointer.assignmentId}`,
          )
        : null;
      tx.set(`support_slots/${slotId}`, {
        ...s,
        status: "completed",
        updatedAt: now(),
      });
      if (a) tx.set(`slot_assignments/${a.id}`, { ...a, status: "completed" });
    });
  }
  async assign(
    slug: string,
    slotId: string,
    input: { supporterName: string; supporterEmail?: string; message?: string },
    version?: string,
  ) {
    input = assignmentSchema.parse({ ...input, slotId });
    const token = secureToken(),
      tokenHash = await hashToken(token),
      id = crypto.randomUUID();
    await this.store.transaction(async (tx) => {
      const p = await pageBySlug(tx, slug, version);
      if (!p || p === "locked")
        throw new AppError("not_found", "ページを開き直してください", 403);
      const s = await tx.get<SupportSlot>(`support_slots/${slotId}`);
      if (!s || !p.slotIds.includes(slotId) || !canAssign(p, s))
        throw new AppError(
          "capacity",
          "この予定はすでに担当が決まったか、受付が終了しています",
          409,
        );
      const a: AssignmentDocument = {
        id,
        slotId,
        supportPageId: p.id,
        supporterName: input.supporterName,
        supporterEmail: input.supporterEmail || "",
        message: input.message || "",
        editTokenHash: tokenHash,
        status: "active",
        createdAt: now(),
      };
      const messages: NotificationDocument[] = [
        await notification({
          id: `${id}-organizer`,
          supportPageId: p.id,
          assignmentId: id,
          kind: "organizer_assigned",
          to: p.organizerEmail,
          subject: "サポートの担当が決まりました",
          text: `${input.supporterName}さんが${s.date}の「${s.title}」を担当しました。\n${appUrl()}/dashboard/${p.id}`,
          dueAt: now(),
        }),
      ];
      if (input.supporterEmail) {
        messages.push(
          await notification({
            id: `${id}-confirmed`,
            supportPageId: p.id,
            assignmentId: id,
            kind: "confirmed",
            to: input.supporterEmail,
            subject: "サポート予定を担当しました",
            text: `${s.date}の「${s.title}」を担当しました。\n確認・キャンセルはこちら：\n${appUrl()}/manage-assignment/${token}\nこのURLはご本人だけで保管してください。`,
            dueAt: now(),
          }),
        );
        for (const [kind, offset, label] of [
          ["previous_day", -1, "明日は"],
          ["same_day", 0, "本日は"],
        ] as const) {
          const dueDate = addDays(s.date, offset);
          if (dueDate < todayJst()) continue;
          messages.push(
            await notification({
              id: `${id}-${kind}`,
              supportPageId: p.id,
              assignmentId: id,
              kind,
              to: input.supporterEmail,
              subject: `${label}サポート予定日です`,
              text: `${label}「${s.title}」の予定があります。\n${s.date} ${s.startTime}\n${appUrl()}/manage-assignment/${token}`,
              dueAt: new Date(`${dueDate}T08:00:00+09:00`).toISOString(),
            }),
          );
        }
      }
      tx.set(`slot_assignments/${id}`, { ...a });
      tx.set(`assignment_tokens/${tokenHash}`, {
        id: tokenHash,
        assignmentId: id,
        supportPageId: p.id,
      });
      tx.set(`slot_active_assignments/${slotId}`, {
        id: slotId,
        assignmentId: id,
        supportPageId: p.id,
      });
      tx.set(`support_slots/${slotId}`, {
        ...s,
        status: "assigned",
        supporterNames: [input.supporterName],
        updatedAt: now(),
      });
      tx.set(`analytics_events/assigned-${id}`, {
        name: "assignment_completed",
        properties: { pageId: p.id, slotId },
        createdAt: now(),
      });
      messages.forEach((m) => tx.set(`notifications/${m.id}`, { ...m }));
    });
    return { token, id };
  }
  async manage(token: string): Promise<ManagedAssignment | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return this.store.transaction(async (tx) => {
      const pointer = await tx.get<{ assignmentId: string }>(
        `assignment_tokens/${await hashToken(token)}`,
      );
      if (!pointer) return null;
      const a = await tx.get<AssignmentDocument>(
        `slot_assignments/${pointer.assignmentId}`,
      );
      if (!a) return null;
      const p = await tx.get<PageDocument>(`support_pages/${a.supportPageId}`),
        slot = await tx.get<SupportSlot>(`support_slots/${a.slotId}`);
      if (!p || p.deletionRequestedAt || !slot) return null;
      const instructions = ["active", "completed"].includes(a.status)
        ? await tx.get<SlotPrivateInfo>(`slot_secrets/${slot.id}`)
        : null;
      return {
        id: a.id,
        supporterName: a.supporterName,
        status: a.status,
        page: { ...publicFields(p), slots: [] },
        slot,
        ...(instructions ? { instructions } : {}),
      };
    });
  }
  async cancel(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new AppError("token", "管理リンクが無効です", 404);
    await this.store.transaction(async (tx) => {
      const pointer = await tx.get<{ assignmentId: string }>(
        `assignment_tokens/${await hashToken(token)}`,
      );
      const a = pointer
        ? await tx.get<AssignmentDocument>(
            `slot_assignments/${pointer.assignmentId}`,
          )
        : null;
      if (!a) throw new AppError("token", "管理リンクが無効です", 404);
      if (a.status === "cancelled") return;
      if (a.status !== "active")
        throw new AppError("completed", "完了した予定はキャンセルできません");
      const p = await tx.get<PageDocument>(`support_pages/${a.supportPageId}`),
        s = await tx.get<SupportSlot>(`support_slots/${a.slotId}`);
      if (!p || p.deletionRequestedAt || !s)
        throw new AppError("page", "このページは終了しています", 404);
      const n = await notification({
        id: `${a.id}-cancelled`,
        supportPageId: p.id,
        kind: "organizer_cancelled",
        to: p.organizerEmail,
        subject: "サポート予定の担当がキャンセルされました",
        text: `${s.date}の「${s.title}」が再び募集中になりました。\n${appUrl()}/dashboard/${p.id}`,
        dueAt: now(),
      });
      tx.set(`slot_assignments/${a.id}`, { ...a, status: "cancelled" });
      tx.set(`support_slots/${s.id}`, {
        ...s,
        status: "open",
        supporterNames: [],
        updatedAt: now(),
      });
      tx.delete(`slot_active_assignments/${s.id}`);
      tx.set(`notifications/${n.id}`, { ...n });
      tx.set(`analytics_events/cancelled-${a.id}`, {
        name: "assignment_cancelled",
        properties: { pageId: p.id, slotId: s.id },
        createdAt: now(),
      });
    });
  }
  async remove(user: User, id: string) {
    const p = await this.store.transaction(async (tx) => {
      const p = await tx.get<PageDocument>(`support_pages/${id}`);
      if (!p || p.organizerId !== user.id)
        throw new AppError("not_found", "ページが見つかりません", 404);
      tx.set(`support_pages/${id}`, {
        ...p,
        status: "archived",
        deletionRequestedAt: p.deletionRequestedAt ?? now(),
      });
      return p;
    });
    const collections = [
      "slot_assignments",
      "notifications",
      "assignment_tokens",
      "slot_active_assignments",
      "page_members",
    ];
    const docs = await Promise.all(
      collections.map(async (collection) => ({
        collection,
        rows: await this.store.query<{
          id?: string;
          editTokenHash?: string;
          slotId?: string;
          assignmentId?: string;
        }>(collection, [{ field: "supportPageId", value: id }]),
      })),
    );
    const paths = [
      `page_slugs/${p.slug}`,
      `page_secrets/${id}`,
      ...p.slotIds.flatMap((s) => [
        `support_slots/${s}`,
        `slot_secrets/${s}`,
        `slot_active_assignments/${s}`,
      ]),
    ];
    for (const { collection, rows } of docs)
      for (const row of rows) {
        if (row.id) paths.push(`${collection}/${row.id}`);
        if (collection === "slot_assignments" && row.editTokenHash)
          paths.push(`assignment_tokens/${row.editTokenHash}`);
      }
    for (let i = 0; i < paths.length; i += 100)
      await this.store.transaction(async (tx) => {
        paths.slice(i, i + 100).forEach((path) => tx.delete(path));
      });
    await this.store.transaction(async (tx) =>
      tx.delete(`support_pages/${id}`),
    );
  }
  async retryDeletions(limit = 1) {
    const pages = await this.store.query<PageDocument>("support_pages", [
      { field: "status", value: "archived" },
    ]);
    let deleted = 0;
    for (const p of pages.filter((p) => p.deletionRequestedAt).slice(0, limit))
      if (p.deletionRequestedAt) {
        await this.remove({ id: p.organizerId, email: p.organizerEmail }, p.id);
        deleted++;
      }
    return deleted;
  }
}
