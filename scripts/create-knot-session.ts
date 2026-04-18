import { randomUUID } from "node:crypto";
import "dotenv/config";

const baseUrl = (process.env.KNOT_BASE_URL ?? "https://development.knotapi.com").replace(
  /\/$/,
  ""
);
const clientId = process.env.KNOT_CLIENT_ID ?? "";
const secret = process.env.KNOT_SECRET ?? "";
const externalUserId =
  process.env.EXTERNAL_USER_ID?.trim() || `test-${randomUUID()}`;

if (!clientId || !secret) {
  console.error("Set KNOT_CLIENT_ID and KNOT_SECRET (e.g. in .env).");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/session/create`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`
  },
  body: JSON.stringify({
    type: "transaction_link",
    external_user_id: externalUserId
  })
});

const bodyText = await response.text();
let payload: { session?: string } = {};
try {
  payload = bodyText ? (JSON.parse(bodyText) as { session?: string }) : {};
} catch {
  // ignore
}

if (!response.ok) {
  console.error(`Knot session/create failed (${response.status}):`, bodyText);
  process.exit(1);
}

console.log("external_user_id:", externalUserId);
console.log("session:", payload.session ?? "(no session in response)");
console.log();
console.log(
  "Pass this session id to KnotConfiguration / the SDK. Use the same external_user_id in webhooks and sync."
);
