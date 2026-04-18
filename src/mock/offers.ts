import { StoreOffer } from "../types.js";

export const mockOffers: StoreOffer[] = [
  {
    storeId: "store_a",
    storeName: "Store A",
    productId: "whey-protein-2lb",
    productName: "Whey Protein 2lb",
    price: 18.99,
    distanceMiles: 0.8,
    inStock: true,
    updatedAt: new Date().toISOString()
  },
  {
    storeId: "store_b",
    storeName: "Store B",
    productId: "whey-protein-2lb",
    productName: "Whey Protein 2lb",
    price: 14.49,
    distanceMiles: 2.1,
    inStock: true,
    updatedAt: new Date().toISOString()
  },
  {
    storeId: "store_c",
    storeName: "Store C",
    productId: "whey-protein-2lb",
    productName: "Whey Protein 2lb",
    price: 16.99,
    distanceMiles: 3.4,
    inStock: true,
    updatedAt: new Date().toISOString()
  },
  {
    storeId: "store_b",
    storeName: "Store B",
    productId: "greek-yogurt-32oz",
    productName: "Greek Yogurt 32oz",
    price: 6.29,
    distanceMiles: 1.7,
    inStock: true,
    updatedAt: new Date().toISOString()
  },
  {
    storeId: "store_d",
    storeName: "Store D",
    productId: "greek-yogurt-32oz",
    productName: "Greek Yogurt 32oz",
    price: 7.19,
    distanceMiles: 0.9,
    inStock: true,
    updatedAt: new Date().toISOString()
  }
];
