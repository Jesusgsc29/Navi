import { findCheapestAlternative, type CompareConfig } from "./compare.js";
import { composeCheapestOptionMessage } from "./message.js";
import { PurchaseEvent, StoreOffer } from "../types.js";
import { Notifier } from "../notifications/notifier.js";

export type WorkflowDeps = {
  getOffers(productId: string): Promise<StoreOffer[]>;
  notifier: Notifier;
};

export async function onPurchaseReceived(
  purchase: PurchaseEvent,
  deps: WorkflowDeps,
  config?: CompareConfig
): Promise<void> {
  const offers = await deps.getOffers(purchase.productId);
  const suggestion = findCheapestAlternative(purchase, offers, config);

  if (!suggestion) {
    return;
  }

  const message = composeCheapestOptionMessage(purchase, suggestion);
  await deps.notifier.send(purchase.userId, message);
}
