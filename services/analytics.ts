import type { AnalyticsEventName, AnalyticsProvider } from "./contracts";
import type { DocumentStore } from "./store";
export const eventNames: AnalyticsEventName[] = [
  "landing_viewed",
  "create_started",
  "create_step_completed",
  "page_created",
  "page_published",
  "share_clicked",
  "public_page_viewed",
  "slot_impression",
  "slot_viewed",
  "assignment_started",
  "assignment_completed",
  "assignment_cancelled",
  "page_completed",
  "plus_offer_viewed",
  "plus_checkout_started",
  "plus_purchased",
  "pro_trial_started",
  "pro_subscribed",
  "gift_partner_clicked",
];
export class AnalyticsService implements AnalyticsProvider {
  constructor(private store: DocumentStore) {}
  async track(
    name: AnalyticsEventName,
    input: Record<string, string | number> = {},
  ) {
    const properties: Record<string, string | number> = {};
    for (const key of ["pageId", "slotId", "step", "method", "plan"] as const) {
      const value = input[key];
      if (typeof value === "number" && Number.isFinite(value))
        properties[key] = value;
      else if (
        typeof value === "string" &&
        value.length <= 64 &&
        /^[a-zA-Z0-9_-]+$/.test(value)
      )
        properties[key] = value;
    }
    const id = crypto.randomUUID();
    await this.store.set(`analytics_events/${id}`, {
      id,
      name,
      properties,
      createdAt: new Date().toISOString(),
    });
  }
}
