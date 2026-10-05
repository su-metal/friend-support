import { getFeatureFlags } from "@/config/product";
import { AppError } from "@/lib/errors";
export function requireRecipientAccess() {
  if (!getFeatureFlags().recipientAccess)
    throw new AppError("not_found", "見つかりません", 404);
}
