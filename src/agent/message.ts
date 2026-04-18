import { CheapestSuggestion, PurchaseEvent } from "../types.js";

export function composeCheapestOptionMessage(
  purchase: PurchaseEvent,
  suggestion: CheapestSuggestion
): string {
  return (
    `Hey! You spent $${purchase.paidPrice.toFixed(2)} on ${purchase.productName}. ` +
    `${suggestion.bestStore} has it for $${suggestion.bestPrice.toFixed(2)} ` +
    `(${suggestion.distanceMiles} mi away). ` +
    `Potential savings: $${suggestion.savings.toFixed(2)} (${suggestion.savingsPct}%).`
  );
}
