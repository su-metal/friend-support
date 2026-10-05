import type { DocumentStore, Transaction } from "./store";
import type { RecipientService as RecipientServiceContract } from "./contracts";
import type {
  ConsiderationId,
  RecipientRequestInput,
  RecipientView,
  SupportSlot,
  User,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import {
  considerationsSchema,
  dateLabel,
  recipientRequestSchema,
  recipientTokenSchema,
  slotSchema,
  todayJst,
} from "@/lib/domain";
import { hashToken, secureToken } from "@/lib/security";
import { appUrl } from "@/lib/env";
import { recipientRequestTemplates } from "@/config/product";
import {
  now,
  notification,
  owned,
  publicFields,
  type PageDocument,
} from "./support";

const MAX_SLOTS = 60;

// ご本人用リンクのトークンからページを引く。再発行・無効化・削除後のリンクは使えない。
async function pageByToken(tx: Pick<Transaction, "get">, token: string) {
  if (!recipientTokenSchema.safeParse(token).success) return null;
  const hash = await hashToken(token);
  const pointer = await tx.get<{ supportPageId: string }>(
    `recipient_tokens/${hash}`,
  );
  const p = pointer
    ? await tx.get<PageDocument>(`support_pages/${pointer.supportPageId}`)
    : null;
  if (
    !p ||
    p.deletionRequestedAt ||
    p.status === "archived" ||
    p.recipientTokenHash !== hash
  )
    return null;
  return p;
}
async function requirePage(tx: Pick<Transaction, "get">, token: string) {
  const p = await pageByToken(tx, token);
  if (!p) throw new AppError("token", "このリンクは使えなくなっています", 404);
  return p;
}
function acceptsRequests(p: PageDocument, today = todayJst()) {
  return p.status === "published" && p.endDate >= today;
}
function settingsAllowed(p: PageDocument) {
  if (!acceptsRequests(p))
    throw new AppError("closed", "公開中のページだけ変更できます");
}
function applySettings(
  tx: Transaction,
  p: PageDocument,
  input: { paused?: boolean; considerations?: ConsiderationId[] },
  pageId: string,
) {
  const stamp = now();
  const next: PageDocument = { ...p, updatedAt: stamp };
  if (input.paused !== undefined) {
    if (input.paused) next.pausedAt = p.pausedAt ?? stamp;
    else delete next.pausedAt;
  }
  if (input.considerations)
    next.considerations = considerationsSchema.parse(input.considerations);
  tx.set(`support_pages/${pageId}`, { ...next });
  if (input.paused !== undefined && !!p.pausedAt !== input.paused)
    tx.set(`analytics_events/paused-${pageId}-${crypto.randomUUID()}`, {
      name: input.paused ? "recipient_paused" : "recipient_resumed",
      properties: { pageId },
      createdAt: stamp,
    });
}

export class RecipientService implements RecipientServiceContract {
  constructor(public readonly store: DocumentStore) {}

  async issueLink(user: User, pageId: string) {
    const token = secureToken(),
      hash = await hashToken(token);
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, pageId);
      if (["closed", "archived"].includes(p.status) || p.endDate < todayJst())
        throw new AppError("closed", "終了したページでは作れません");
      if (p.recipientTokenHash)
        tx.delete(`recipient_tokens/${p.recipientTokenHash}`);
      tx.set(`recipient_tokens/${hash}`, {
        id: hash,
        supportPageId: pageId,
        createdAt: now(),
      });
      tx.set(`support_pages/${pageId}`, {
        ...p,
        recipientTokenHash: hash,
        updatedAt: now(),
      });
      tx.set(`analytics_events/recipient-link-${hash.slice(0, 32)}`, {
        name: "recipient_link_issued",
        properties: { pageId },
        createdAt: now(),
      });
    });
    return { token };
  }

  async revokeLink(user: User, pageId: string) {
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, pageId);
      if (!p.recipientTokenHash) return;
      tx.delete(`recipient_tokens/${p.recipientTokenHash}`);
      const next: PageDocument = { ...p, updatedAt: now() };
      delete next.recipientTokenHash;
      tx.set(`support_pages/${pageId}`, { ...next });
    });
  }

  async updateSettingsAsOrganizer(
    user: User,
    pageId: string,
    input: { paused?: boolean; considerations?: ConsiderationId[] },
  ) {
    await this.store.transaction(async (tx) => {
      const p = await owned(tx, user, pageId);
      settingsAllowed(p);
      applySettings(tx, p, input, pageId);
    });
  }

  async view(token: string): Promise<RecipientView | null> {
    return this.store.transaction(async (tx) => {
      const p = await pageByToken(tx, token);
      if (!p) return null;
      const mine = new Set(p.recipientSlotIds ?? []);
      const slots = await tx.getMany<SupportSlot>(
        p.slotIds.map((id) => `support_slots/${id}`),
      );
      return {
        page: publicFields(p),
        // 公開ページと同じ項目だけを返し、非公開欄や担当者の連絡先は含めない。
        slots: slots
          .filter(
            (s): s is SupportSlot => s !== null && s.status !== "cancelled",
          )
          .sort((a, b) =>
            `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
          )
          .map((s) => ({
            id: s.id,
            supportPageId: s.supportPageId,
            categoryId: s.categoryId,
            title: s.title,
            description: s.description,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            quantityNeeded: s.quantityNeeded,
            locationSummary: s.locationSummary,
            status: s.status,
            supporterNames: s.supporterNames,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            mine: mine.has(s.id),
          })),
        canRequest: acceptsRequests(p),
        slotLimitReached: p.slotIds.length >= MAX_SLOTS,
      };
    });
  }

  async addRequest(token: string, input: RecipientRequestInput) {
    const request = recipientRequestSchema.parse(input);
    const template = recipientRequestTemplates.find(
      (t) => t.kind === request.kind,
    )!;
    const slot = slotSchema.parse({
      categoryId: template.categoryId,
      title: request.title,
      description: request.description,
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      quantityNeeded: 1,
      locationSummary: "",
      privateInstructions: request.privateInstructions,
    });
    const slotId = crypto.randomUUID();
    await this.store.transaction(async (tx) => {
      const p = await requirePage(tx, token);
      const today = todayJst();
      if (!acceptsRequests(p, today))
        throw new AppError(
          "closed",
          "いまはお願いを出せません。窓口の方に連絡してください",
        );
      if (slot.date < today || slot.date < p.startDate || slot.date > p.endDate)
        throw new AppError(
          "period",
          `お願いできるのは${dateLabel(p.startDate > today ? p.startDate : today)}から${dateLabel(p.endDate)}までです。期間を延ばしたいときは、窓口の方に頼んでください`,
        );
      if (p.slotIds.length >= MAX_SLOTS)
        throw new AppError(
          "slot_limit",
          "予定の数が上限に達しています。窓口の方に整理を頼んでください",
        );
      const stamp = now();
      const { privateInstructions, ...publicSlot } = slot;
      tx.set(`support_slots/${slotId}`, {
        ...publicSlot,
        id: slotId,
        supportPageId: p.id,
        status: "open",
        supporterNames: [],
        createdAt: stamp,
        updatedAt: stamp,
      });
      tx.set(`slot_secrets/${slotId}`, { privateInstructions });
      tx.set(`support_pages/${p.id}`, {
        ...p,
        slotIds: [...p.slotIds, slotId],
        recipientSlotIds: [...(p.recipientSlotIds ?? []), slotId],
        revision: (p.revision ?? 0) + 1,
        updatedAt: stamp,
      });
      tx.set(`analytics_events/recipient-request-${slotId}`, {
        name: "recipient_request_created",
        properties: { pageId: p.id, slotId, categoryId: slot.categoryId },
        createdAt: stamp,
      });
      const n = await notification({
        id: `${slotId}-recipient-request`,
        supportPageId: p.id,
        kind: "organizer_recipient_request",
        to: p.organizerEmail,
        subject: "ご本人から新しいお願いがありました",
        text: `${p.recipientDisplayName}さんが${slot.date}の「${slot.title}」を追加しました。\n${appUrl()}/dashboard/${p.id}`,
        dueAt: stamp,
      });
      tx.set(`notifications/${n.id}`, { ...n });
    });
    return { slotId };
  }

  async withdrawRequest(token: string, slotId: string) {
    await this.store.transaction(async (tx) => {
      const p = await requirePage(tx, token);
      if (!p.slotIds.includes(slotId)) return;
      if (!(p.recipientSlotIds ?? []).includes(slotId))
        throw new AppError(
          "not_mine",
          "ご本人が出したお願いだけ取り消せます",
          403,
        );
      const s = await tx.get<SupportSlot>(`support_slots/${slotId}`);
      if (s && s.status !== "open")
        throw new AppError(
          "assigned_slot",
          "担当が決まったお願いは取り消せません。担当の方か窓口の方に直接連絡してください",
          409,
        );
      const stamp = now();
      tx.delete(`support_slots/${slotId}`);
      tx.delete(`slot_secrets/${slotId}`);
      tx.set(`support_pages/${p.id}`, {
        ...p,
        slotIds: p.slotIds.filter((id) => id !== slotId),
        recipientSlotIds: (p.recipientSlotIds ?? []).filter(
          (id) => id !== slotId,
        ),
        revision: (p.revision ?? 0) + 1,
        updatedAt: stamp,
      });
      tx.set(`analytics_events/recipient-withdrawn-${slotId}`, {
        name: "recipient_request_withdrawn",
        properties: { pageId: p.id, slotId },
        createdAt: stamp,
      });
    });
  }

  async updateSettings(
    token: string,
    input: { paused?: boolean; considerations?: ConsiderationId[] },
  ) {
    await this.store.transaction(async (tx) => {
      const p = await requirePage(tx, token);
      settingsAllowed(p);
      applySettings(tx, p, input, p.id);
    });
  }
}
