import type { PaymentProvider, GiftPartnerService } from "./contracts";
import { AppError } from "@/lib/errors";
export class PaymentService implements PaymentProvider {
  async createCheckoutSession(): Promise<{ url: string }> {
    throw new AppError("unavailable", "Plusの提供は準備中です", 503);
  }
  async getPaymentStatus(): Promise<"pending" | "paid" | "failed"> {
    throw new AppError("unavailable", "決済機能は準備中です", 503);
  }
}
export class DisabledGiftPartnerService implements GiftPartnerService {
  async list() {
    return [];
  }
}
