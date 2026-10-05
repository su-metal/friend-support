export type SupportCaseType =
  | "postpartum"
  | "illness"
  | "injury"
  | "recovery"
  | "caregiving"
  | "bereavement"
  | "other";
export type PageStatus =
  "draft" | "pending_recipient_approval" | "published" | "closed" | "archived";
export type Plan = "free" | "plus" | "pro";
export type ConsiderationId =
  "no_return_gift" | "doorstep_only" | "short_visit" | "no_reply";
export type RecipientRequestKind =
  "meal" | "supplies" | "transport" | "housework" | "other";
export interface SupportCategory {
  id: string;
  name: string;
  icon: string;
  suggestedTitle: string;
}
export interface SupportSlot {
  id: string;
  supportPageId: string;
  categoryId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  quantityNeeded: number;
  locationSummary: string;
  status: "open" | "assigned" | "completed" | "cancelled";
  supporterNames: string[];
  createdAt: string;
  updatedAt: string;
}
export interface SlotPrivateInfo {
  privateInstructions: string;
  mealPeople?: number;
  foodDislikes?: string;
  allergyNotes?: string;
  handoffPreference?: string;
}
export interface SupportPage {
  id: string;
  organizerId: string;
  slug: string;
  caseType: SupportCaseType;
  title: string;
  recipientDisplayName: string;
  description: string;
  startDate: string;
  endDate: string;
  status: PageStatus;
  plan: Plan;
  visibility: "link" | "passcode";
  organizationId?: string;
  thanksMessage: string;
  pausedAt?: string;
  considerations?: ConsiderationId[];
  createdAt: string;
  updatedAt: string;
}
export interface PublicSupportPage extends Omit<
  SupportPage,
  "organizerId" | "organizationId"
> {
  slots: SupportSlot[];
}
export interface OrganizerPage extends SupportPage {
  slots: (SupportSlot & SlotPrivateInfo)[];
  assignments: OrganizerAssignment[];
  revision: number;
  recipientLinkActive: boolean;
  recipientSlotIds: string[];
}
export interface RecipientView {
  page: Omit<PublicSupportPage, "slots">;
  slots: (SupportSlot & { mine: boolean })[];
  canRequest: boolean;
  slotLimitReached: boolean;
}
export interface RecipientRequestInput {
  kind: RecipientRequestKind;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  privateInstructions: string;
}
export interface OrganizerAssignment {
  id: string;
  slotId: string;
  supporterName: string;
  supporterEmail?: string;
  message?: string;
  status: "active" | "cancelled" | "completed";
  createdAt: string;
}
export interface ManagedAssignment {
  id: string;
  supporterName: string;
  status: "active" | "cancelled" | "completed";
  page: PublicSupportPage;
  slot: SupportSlot;
  instructions?: SlotPrivateInfo;
}
export interface PageDraft {
  recipientDisplayName: string;
  description: string;
  startDate: string;
  endDate: string;
  visibility: "link" | "passcode";
  passcode?: string;
  slots: SlotDraft[];
}
export interface SlotDraft extends SlotPrivateInfo {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  quantityNeeded: number;
  locationSummary: string;
}
export interface User {
  id: string;
  email: string;
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: "pro";
  subscriptionStatus: "trial" | "active" | "past_due" | "cancelled";
  createdAt: string;
}
export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}
export interface PageMember {
  id: string;
  supportPageId: string;
  userId?: string;
  email?: string;
  role: "organizer" | "co_organizer" | "recipient";
  status: "invited" | "accepted";
}
export interface Purchase {
  id: string;
  userId: string;
  supportPageId?: string;
  organizationId?: string;
  product: "page_plus" | "organization_subscription";
  amount: number;
  currency: "JPY";
  provider: "stripe";
  providerPaymentId: string;
  status: "pending" | "paid" | "refunded" | "failed";
  createdAt: string;
}
export interface GiftPartner {
  id: string;
  name: string;
  category: string;
  logoUrl: string;
  destinationUrl: string;
  affiliateType: "affiliate" | "revenue_share" | "none";
  active: boolean;
}
export interface CaseTemplate {
  id: string;
  caseType: SupportCaseType;
  name: string;
  description: string;
  suggestedCategories: string[];
  suggestedSlots: Partial<SlotDraft>[];
  active: boolean;
}
