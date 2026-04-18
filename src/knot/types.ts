export type KnotWebhookEvent = {
  event_type: string;
  merchant_id?: number;
  external_user_id?: string;
  [key: string]: unknown;
};

export type KnotTransactionSyncRequest = {
  merchant_id: number;
  external_user_id: string;
  cursor?: string;
  limit?: number;
};

export type KnotPrice = {
  total?: number;
  [key: string]: unknown;
};

export type KnotLineItem = {
  sku?: string;
  name?: string;
  quantity?: number;
  price?: number;
  total_price?: number;
  [key: string]: unknown;
};

export type KnotTransaction = {
  id: string;
  datetime?: string;
  merchant?: { name?: string; id?: number };
  price?: KnotPrice;
  line_items?: KnotLineItem[];
  [key: string]: unknown;
};

export type KnotTransactionSyncResponse = {
  transactions: KnotTransaction[];
  next_cursor?: string | null;
};
