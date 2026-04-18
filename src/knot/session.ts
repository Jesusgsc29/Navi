import { randomUUID } from "node:crypto";
import { knotFetch, KnotApiError } from "./knotFetch.js";

export { KnotApiError };
export type CreateTransactionLinkSessionInput = {
  baseUrl: string;
  clientId: string;
  secret: string;
  /** If omitted, a unique `test-<uuid>` id is generated. */
  externalUserId?: string;
};

export type CreateTransactionLinkSessionResult = {
  session: string;
  external_user_id: string;
};

export async function createTransactionLinkSession(
  input: CreateTransactionLinkSessionInput
): Promise<CreateTransactionLinkSessionResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const external_user_id =
    input.externalUserId?.trim() || `test-${randomUUID()}`;

  const response = await knotFetch(`${base}/session/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(
        `${input.clientId}:${input.secret}`
      ).toString("base64")}`
    },
    body: JSON.stringify({
      type: "transaction_link",
      external_user_id
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
    throw new KnotApiError(
      `Knot session/create failed (${response.status}): ${bodyText || response.statusText}`,
      response.status
    );
  }

  const session = payload.session;
  if (typeof session !== "string" || session.length === 0) {
    throw new Error("Knot session/create response missing session.");
  }

  return { session, external_user_id };
}
