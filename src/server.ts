import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onPurchaseReceived } from "./agent/workflow.js";
import { mockOffers } from "./mock/offers.js";
import { createConsoleNotifier } from "./notifications/notifier.js";
import { KnotClient } from "./knot/client.js";
import { knotTransactionToPurchaseEvent } from "./knot/mapper.js";
import { createTransactionLinkSession, KnotApiError } from "./knot/session.js";
import { KnotWebhookEvent } from "./knot/types.js";
import "dotenv/config";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const knotDemoPagePath = path.join(projectRoot, "public", "knot.html");

const env = {
  port: Number(process.env.PORT ?? 5000),
  /** Comma-separated browser origins allowed to call POST /api/knot/session (e.g. static dev server on another port). */
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  knotBaseUrl: process.env.KNOT_BASE_URL ?? "https://development.knotapi.com",
  knotClientId: process.env.KNOT_CLIENT_ID ?? "",
  knotSecret: process.env.KNOT_SECRET ?? "",
  knotWebhookSecret: process.env.KNOT_WEBHOOK_SECRET ?? "",
  knotWebhookSignatureHeader:
    process.env.KNOT_WEBHOOK_SIGNATURE_HEADER ?? "x-knot-signature",
  knotMerchantId: (() => {
    const raw = process.env.KNOT_MERCHANT_ID;
    const n = Number(raw && raw.trim() !== "" ? raw : "19");
    if (!Number.isFinite(n) || n <= 0) {
      return 19;
    }
    return n;
  })()
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

function requestOrigin(req: IncomingMessage): string | undefined {
  const v = req.headers.origin;
  if (Array.isArray(v)) {
    return v[0];
  }
  return typeof v === "string" ? v : undefined;
}

/** Dev-only: allow CORS when the page is served from an ngrok browser tunnel (Origin ends with ngrok host). */
function isNgrokBrowserOrigin(origin: string): boolean {
  if (process.env.CORS_ALLOW_NGROK !== "true") {
    return false;
  }
  try {
    const host = new URL(origin).hostname;
    return (
      host.endsWith(".ngrok-free.dev") ||
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".ngrok.io")
    );
  } catch {
    return false;
  }
}

function isFrontendOriginAllowed(origin: string): boolean {
  return (
    env.frontendOrigins.includes(origin) || isNgrokBrowserOrigin(origin)
  );
}

/** CORS for the Knot demo when the HTML is served from FRONTEND_ORIGIN (another port). */
function applyCorsForSessionApi(req: IncomingMessage, res: ServerResponse): void {
  const origin = requestOrigin(req);
  if (!origin || !isFrontendOriginAllowed(origin)) {
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Expose-Headers", "retry-after");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function jsonCors(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>
): void {
  applyCorsForSessionApi(req, res);
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function pathnameOnly(url: string | undefined): string {
  if (!url) return "/";
  const p = url.split("?")[0] ?? "/";
  return p === "" ? "/" : p;
}

function knotSdkEnvironment(): "development" | "production" {
  const v = process.env.KNOT_SDK_ENVIRONMENT;
  if (v === "production" || v === "development") {
    return v;
  }
  return env.knotBaseUrl.includes("development") ? "development" : "production";
}

async function serveKnotDemoPage(res: ServerResponse): Promise<void> {
  try {
    const html = await readFile(knotDemoPagePath, "utf8");
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  } catch {
    json(res, 500, { error: "Could not read public/knot.html." });
  }
}

async function handleKnotWebSession(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!env.knotClientId || !env.knotSecret) {
    jsonCors(req, res, 500, {
      error: "Missing Knot credentials. Set KNOT_CLIENT_ID and KNOT_SECRET."
    });
    return;
  }

  let merchantIds: number[] = [env.knotMerchantId];
  let externalUserId: string | undefined =
    process.env.EXTERNAL_USER_ID?.trim() || undefined;

  if (req.method === "POST") {
    const raw = await readBody(req);
    if (raw.trim()) {
      let parsed: {
        external_user_id?: unknown;
        merchant_ids?: unknown;
      };
      try {
        parsed = JSON.parse(raw) as {
          external_user_id?: unknown;
          merchant_ids?: unknown;
        };
      } catch {
        jsonCors(req, res, 400, { error: "Invalid JSON body." });
        return;
      }
      if (
        typeof parsed.external_user_id === "string" &&
        parsed.external_user_id.trim()
      ) {
        externalUserId = parsed.external_user_id.trim();
      }
      if (Array.isArray(parsed.merchant_ids) && parsed.merchant_ids.length > 0) {
        const ids = parsed.merchant_ids.filter(
          (x): x is number => typeof x === "number"
        );
        if (ids.length > 0) {
          merchantIds = ids;
        }
      }
    }
  }

  try {
    const { session, external_user_id } = await createTransactionLinkSession({
      baseUrl: env.knotBaseUrl,
      clientId: env.knotClientId,
      secret: env.knotSecret,
      externalUserId
    });
    jsonCors(req, res, 200, {
      sessionId: session,
      clientId: env.knotClientId,
      environment: knotSdkEnvironment(),
      merchantIds,
      product: "transaction_link",
      external_user_id
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Session create failed.";
    const status =
      error instanceof KnotApiError && error.status === 429 ? 429 : 502;
    jsonCors(req, res, status, { error: message }, status === 429 ? { "Retry-After": "60" } : undefined);
  }
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
    const pathName = pathnameOnly(req.url);
    if (req.method === "GET" && pathName === "/") {
      json(res, 200, {
        message:
          "Welcome to the Navi webhook server! Use GET /health or POST /webhooks/knot",
      });
      return;
    }

    if (req.method === "OPTIONS" && pathName === "/api/knot/session") {
      applyCorsForSessionApi(req, res);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === "GET" && pathName === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathName === "/knot") {
      await serveKnotDemoPage(res);
      return;
    }

    if (req.method === "POST" && pathName === "/api/knot/session") {
      await handleKnotWebSession(req, res);
      return;
    }

    if (req.method === "POST" && pathName === "/webhooks/knot") {
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
  console.log(`API + webhooks: http://localhost:${env.port}`);
  console.log("POST /webhooks/knot");
  console.log("POST /api/knot/session (CORS: FRONTEND_ORIGIN or CORS_ALLOW_NGROK=true)");
  console.log(`GET  /knot — same-origin Knot demo (optional)`);
  console.log(
    `Frontend demo: npm run dev:frontend → http://localhost:3000/knot.html (API ${env.port})`
  );
  console.log(`FRONTEND_ORIGIN allowlist: ${env.frontendOrigins.join(", ")}`);
  if (process.env.CORS_ALLOW_NGROK === "true") {
    console.log("CORS_ALLOW_NGROK: allowing *.ngrok-free.dev / *.ngrok-free.app / *.ngrok.io");
  }
});
