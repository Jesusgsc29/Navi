export class KnotApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "KnotApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Retry-After header: seconds or HTTP-date. Returns delay in ms. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const trimmed = header.trim();
  const seconds = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(seconds) && String(seconds) === trimmed) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

/**
 * Fetch with retries on HTTP 429 (Knot rate limits). Respects Retry-After when present.
 */
export async function knotFetch(
  url: string,
  init: RequestInit,
  options?: { maxRetries?: number }
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 4;
  let attempt = 0;

  for (;;) {
    const response = await fetch(url, init);

    if (response.status !== 429 || attempt >= maxRetries) {
      return response;
    }

    attempt += 1;
    const fromHeader = parseRetryAfterMs(response.headers.get("retry-after"));
    const backoff = Math.min(1000 * 2 ** (attempt - 1), 16_000);
    const delayMs = fromHeader ?? backoff;
    await sleep(delayMs);
  }
}
