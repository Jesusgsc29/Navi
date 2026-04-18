import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { onPurchaseReceived } from "./agent/workflow.js";
import { mockOffers } from "./mock/offers.js";
import { createConsoleNotifier } from "./notifications/notifier.js";
import { KnotClient } from "./knot/client.js";
import { knotTransactionToPurchaseEvent } from "./knot/mapper.js";
import { KnotWebhookEvent } from "./knot/types.js";
import "dotenv/config";

const env = {
  port: Number(process.env.PORT ?? 5000),
  knotBaseUrl: process.env.KNOT_BASE_URL ?? "https://development.knotapi.com",
  knotClientId: process.env.KNOT_CLIENT_ID ?? "",
  knotSecret: process.env.KNOT_SECRET ?? "",
  knotWebhookSecret: process.env.KNOT_WEBHOOK_SECRET ?? "",
  knotWebhookSignatureHeader:
    process.env.KNOT_WEBHOOK_SIGNATURE_HEADER ?? "x-knot-signature"
};

const knotClient =
  env.knotClientId && env.knotSecret
    ? new KnotClient({
        baseUrl: env.knotBaseUrl,
        clientId: env.knotClientId,
        secret: env.knotSecret
      })
    : null;

const notifier = createConsoleNotifier();

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function verifySignature(rawBody: string, provided: string): boolean {
  if (!env.knotWebhookSecret) {
    return true;
  }
  const digest = createHmac("sha256", env.knotWebhookSecret)
    .update(rawBody)
    .digest("hex");
  const normalized = provided.replace(/^sha256=/i, "");
  return secureCompare(normalized, digest);
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function handleKnotWebhook(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!knotClient) {
    json(res, 500, {
      error: "Missing Knot credentials. Set KNOT_CLIENT_ID and KNOT_SECRET."
    });
    return;
  }

  const rawBody = await readBody(req);
  const signatureHeaderValue = req.headers[
    env.knotWebhookSignatureHeader.toLowerCase() 
  ];
  const signature = Array.isArray(signatureHeaderValue)
    ? signatureHeaderValue[0]
    : signatureHeaderValue ?? "";

  if (env.knotWebhookSecret && !verifySignature(rawBody, signature)) {
    json(res, 401, { error: "Invalid webhook signature." });
    return;
  }

  let event: KnotWebhookEvent;
  try {
    event = JSON.parse(rawBody) as KnotWebhookEvent;
  } catch {
    json(res, 400, { error: "Invalid JSON payload." });
    return;
  }

  const shouldSync =
    event.event_type === "NEW_TRANSACTIONS_AVAILABLE" ||
    event.event_type === "UPDATED_TRANSACTIONS_AVAILABLE";

  if (!shouldSync) {
    json(res, 200, { ok: true, ignored: event.event_type });
    return;
  }

  if (
    typeof event.merchant_id !== "number" ||
    typeof event.external_user_id !== "string"
  ) {
    json(res, 400, {
      error: "Webhook payload missing merchant_id or external_user_id."
    });
    return;
  }

  const transactions = await knotClient.syncAllTransactions({
    merchant_id: event.merchant_id,
    external_user_id: event.external_user_id
  });

  let processed = 0;
  for (const transaction of transactions) {
    const purchase = knotTransactionToPurchaseEvent(
      transaction,
      event.external_user_id
    );
    await onPurchaseReceived(
      purchase,
      {
        getOffers: async (productId) =>
          mockOffers.filter((offer) => offer.productId === productId),
        notifier
      },
      {
        maxDistance: 5,
        minSavingsAbs: 1.5,
        minSavingsPct: 0.08
      }
    );
    processed += 1;
  }

  json(res, 200, { ok: true, processed });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url === "/webhooks/knot") {
      await handleKnotWebhook(req, res);
      return;
    }

    json(res, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    json(res, 500, { error: message });
  }
});

server.listen(env.port, () => {
  console.log(`Webhook server listening on http://localhost:${env.port}`);
  console.log("POST /webhooks/knot for Knot webhook events");
});
