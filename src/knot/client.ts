import {
  KnotTransaction,
  KnotTransactionSyncRequest,
  KnotTransactionSyncResponse
} from "./types.js";
import { knotFetch, KnotApiError } from "./knotFetch.js";

export type KnotClientConfig = {
  baseUrl: string;
  clientId: string;
  secret: string;
};

export class KnotClient {
  constructor(private readonly config: KnotClientConfig) {}

  async syncTransactions(
    input: KnotTransactionSyncRequest
  ): Promise<KnotTransactionSyncResponse> {
    const response = await knotFetch(`${this.config.baseUrl}/transactions/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.secret}`
        ).toString("base64")}`
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new KnotApiError(
        `Knot sync failed (${response.status}): ${message || response.statusText}`,
        response.status
      );
    }

    const payload = (await response.json()) as Partial<KnotTransactionSyncResponse>;
    return {
      transactions: Array.isArray(payload.transactions)
        ? (payload.transactions as KnotTransaction[])
        : [],
      next_cursor: payload.next_cursor ?? null
    };
  }

  async syncAllTransactions(
    input: Omit<KnotTransactionSyncRequest, "cursor">
  ): Promise<KnotTransaction[]> {
    let cursor: string | undefined;
    const all: KnotTransaction[] = [];

    for (;;) {
      const page = await this.syncTransactions({
        ...input,
        cursor,
        limit: input.limit ?? 50
      });
      all.push(...page.transactions);
      if (!page.next_cursor) {
        break;
      }
      cursor = page.next_cursor;
      // Space out pagination to avoid burst rate limits on large syncs.
      await new Promise((r) => setTimeout(r, 150));
    }

    return all;
  }
}
