import { CheapestSuggestion, PurchaseEvent, StoreOffer } from "../types.js";

export type CompareConfig = {
  maxDistance?: number;
  minSavingsAbs?: number;
  minSavingsPct?: number;
};

export function findCheapestAlternative(
  purchase: PurchaseEvent,
  offers: StoreOffer[],
  config: CompareConfig = {}
): CheapestSuggestion | null {
  const maxDistance = config.maxDistance ?? 5;
  const minSavingsAbs = config.minSavingsAbs ?? 2;
  const minSavingsPct = config.minSavingsPct ?? 0.1;

  const candidates = offers
    .filter(
      (offer) =>
        offer.productId === purchase.productId &&
        offer.inStock &&
        offer.distanceMiles <= maxDistance &&
        offer.storeName !== purchase.purchasedAtStore
    )
    .sort((a, b) => a.price - b.price);

  const best = candidates[0];
  if (!best) {
    return null;
  }

  const savings = purchase.paidPrice - best.price;
  const savingsPct = savings / purchase.paidPrice;

  if (savings < minSavingsAbs && savingsPct < minSavingsPct) {
    return null;
  }

  return {
    bestStore: best.storeName,
    bestPrice: Number(best.price.toFixed(2)),
    distanceMiles: Number(best.distanceMiles.toFixed(1)),
    savings: Number(savings.toFixed(2)),
    savingsPct: Number((savingsPct * 100).toFixed(1))
  };
}
