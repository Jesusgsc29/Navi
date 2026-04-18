import { PurchaseEvent } from "../types.js";

export const mockPurchases: PurchaseEvent[] = [
  {
    userId: "user_001",
    productId: "whey-protein-2lb",
    productName: "Whey Protein 2lb",
    paidPrice: 18.99,
    purchasedAtStore: "Store A",
    purchasedAt: new Date().toISOString(),
    location: { lat: 40.7128, lng: -74.006 }
  },
  {
    userId: "user_001",
    productId: "greek-yogurt-32oz",
    productName: "Greek Yogurt 32oz",
    paidPrice: 6.89,
    purchasedAtStore: "Store C",
    purchasedAt: new Date().toISOString(),
    location: { lat: 40.7128, lng: -74.006 }
  }
];
