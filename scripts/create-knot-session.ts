import "dotenv/config";
import { createTransactionLinkSession } from "../src/knot/session.js";

const baseUrl = process.env.KNOT_BASE_URL ?? "https://development.knotapi.com";
const clientId = process.env.KNOT_CLIENT_ID ?? "";
const secret = process.env.KNOT_SECRET ?? "";
const externalFromEnv = process.env.EXTERNAL_USER_ID?.trim();

if (!clientId || !secret) {
  console.error("Set KNOT_CLIENT_ID and KNOT_SECRET (e.g. in .env).");
  process.exit(1);
}

try {
  const { session, external_user_id } = await createTransactionLinkSession({
    baseUrl,
    clientId,
    secret,
    externalUserId: externalFromEnv || undefined
  });
  console.log("external_user_id:", external_user_id);
  console.log("session:", session);
  console.log();
  console.log(
    "Use GET http://localhost:<PORT>/knot to open the Web SDK with a fresh session, or pass this session id into KnotConfiguration."
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
