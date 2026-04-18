export type Coordinates = {
  lat: number;
  lng: number;
};

export type PurchaseEvent = {
  userId: string;
  productId: string;
  productName: string;
  paidPrice: number;
  purchasedAtStore: string;
  purchasedAt: string;
  location: Coordinates;
};

export type StoreOffer = {
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  price: number;
  distanceMiles: number;
  inStock: boolean;
  updatedAt: string;
};

export type CheapestSuggestion = {
  bestStore: string;
  bestPrice: number;
  distanceMiles: number;
  savings: number;
  savingsPct: number;
};
