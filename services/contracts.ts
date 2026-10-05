import type {
  User,
  PageDraft,
  OrganizerPage,
  PublicSupportPage,
  ManagedAssignment,
  GiftPartner,
  ConsiderationId,
  RecipientRequestInput,
  RecipientView,
} from "@/types/domain";
export interface AuthService {
  currentUser(): Promise<User | null>;
  createSession(idToken: string): Promise<string>;
  signOut(): Promise<void>;
}
export interface SupportPageService {
  list(user: User): Promise<OrganizerPage[]>;
  create(user: User, draft: PageDraft): Promise<string>;
  organizerPage(user: User, id: string): Promise<OrganizerPage>;
  publicPage(
    slug: string,
    accessVersion?: string,
  ): Promise<PublicSupportPage | "locked" | null>;
  save(user: User, id: string, draft: PageDraft): Promise<void>;
  setStatus(
    user: User,
    id: string,
    status: "draft" | "published" | "closed",
  ): Promise<void>;
  remove(user: User, id: string): Promise<void>;
}
export interface SupportSlotService {
  complete(user: User, pageId: string, slotId: string): Promise<void>;
}
export interface AssignmentService {
  assign(
    slug: string,
    slotId: string,
    input: { supporterName: string; supporterEmail?: string; message?: string },
    accessVersion?: string,
  ): Promise<{ token: string; id: string }>;
  manage(token: string): Promise<ManagedAssignment | null>;
  cancel(token: string): Promise<void>;
}
export interface RecipientService {
  issueLink(user: User, pageId: string): Promise<{ token: string }>;
  revokeLink(user: User, pageId: string): Promise<void>;
  updateSettingsAsOrganizer(
    user: User,
    pageId: string,
    input: { paused?: boolean; considerations?: ConsiderationId[] },
  ): Promise<void>;
  view(token: string): Promise<RecipientView | null>;
  addRequest(
    token: string,
    input: RecipientRequestInput,
  ): Promise<{ slotId: string }>;
  withdrawRequest(token: string, slotId: string): Promise<void>;
  updateSettings(
    token: string,
    input: { paused?: boolean; considerations?: ConsiderationId[] },
  ): Promise<void>;
}
export interface EmailProvider {
  send(email: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }): Promise<void>;
}
export interface PaymentProvider {
  createCheckoutSession(input: {
    userId: string;
    supportPageId: string;
  }): Promise<{ url: string }>;
  getPaymentStatus(id: string): Promise<"pending" | "paid" | "failed">;
}
export interface AnalyticsProvider {
  track(
    name: AnalyticsEventName,
    properties: Record<string, string | number>,
  ): Promise<void>;
}
export type AnalyticsEventName =
  | "landing_viewed"
  | "create_started"
  | "create_step_completed"
  | "page_created"
  | "page_published"
  | "share_clicked"
  | "public_page_viewed"
  | "slot_impression"
  | "slot_viewed"
  | "assignment_started"
  | "assignment_completed"
  | "assignment_cancelled"
  | "page_completed"
  | "plus_offer_viewed"
  | "plus_checkout_started"
  | "plus_purchased"
  | "pro_trial_started"
  | "pro_subscribed"
  | "gift_partner_clicked"
  | "recipient_link_issued"
  | "recipient_request_created"
  | "recipient_request_withdrawn"
  | "recipient_paused"
  | "recipient_resumed";
export interface GiftPartnerService {
  list(): Promise<GiftPartner[]>;
}
