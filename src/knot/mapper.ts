import { PurchaseEvent } from "../types.js";
import { KnotTransaction } from "./types.js";

function fallbackProductName(transaction: KnotTransaction): string {
  return transaction.line_items?.[0]?.name ?? "Unknown product";
}

function fallbackProductId(transaction: KnotTransaction): string {
  const sku = transaction.line_items?.[0]?.sku;
  if (sku && sku.trim().length > 0) {
    return sku.trim();
  }
  return `txn-${transaction.id}`;
}

function fallbackPaidPrice(transaction: KnotTransaction): number {
  const lineItemTotal =
    transaction.line_items?.[0]?.total_price ??
    transaction.line_items?.[0]?.price ??
    0;
  return Number(transaction.price?.total ?? lineItemTotal ?? 0);
}

export function knotTransactionToPurchaseEvent(
  transaction: KnotTransaction,
  externalUserId: string
): PurchaseEvent {
  return {
    userId: externalUserId,
    productId: fallbackProductId(transaction),
    productName: fallbackProductName(transaction),
    paidPrice: fallbackPaidPrice(transaction),
    purchasedAtStore: transaction.merchant?.name ?? "Unknown store",
    purchasedAt: transaction.datetime ?? new Date().toISOString(),
    location: {
      // Knot sync payload does not guarantee store coordinates.
      // Keep placeholders until location enrichment is added.
      lat: 0,
      lng: 0
    }
  };
}
