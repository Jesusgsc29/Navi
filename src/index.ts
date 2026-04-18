import { onPurchaseReceived } from "./agent/workflow.js";
import { mockOffers } from "./mock/offers.js";
import { mockPurchases } from "./mock/purchases.js";
import { createConsoleNotifier } from "./notifications/notifier.js";
import { StoreOffer } from "./types.js";

async function getOffers(productId: string): Promise<StoreOffer[]> {
  return mockOffers.filter((offer) => offer.productId === productId);
}

async function main(): Promise<void> {
  const notifier = createConsoleNotifier();

  for (const purchase of mockPurchases) {
    await onPurchaseReceived(
      purchase,
      { getOffers, notifier },
      {
        maxDistance: 5,
        minSavingsAbs: 1.5,
        minSavingsPct: 0.08
      }
    );
  }
}

main().catch((error: unknown) => {
  console.error("Project failed:", error);
  process.exit(1);
});
