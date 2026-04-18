# Price Alert Agent (Mock + Knot Webhook + Spectrum TS)

This project demonstrates a purchase-triggered AI-style workflow:

1. Receive a purchase event.
2. Sync transactions from Knot when webhook events arrive.
3. Compare paid price against nearby mock store offers.
4. Send a "cheaper option" notification to the user.

The project uses `spectrum-ts` content builders for notification content.

## Run

```bash
npm install
npm run dev
```

## Run webhook server (Knot integration)

```bash
set KNOT_CLIENT_ID=your_client_id
set KNOT_SECRET=your_secret
set KNOT_BASE_URL=https://development.knotapi.com
set PORT=3000
npm run dev:webhook
```

Optional signature verification:

```bash
set KNOT_WEBHOOK_SECRET=your_webhook_secret
set KNOT_WEBHOOK_SIGNATURE_HEADER=x-knot-signature
```

Webhook endpoint:

- `POST /webhooks/knot`
- Health check: `GET /health`

Expected webhook body shape:

```json
{
  "event_type": "NEW_TRANSACTIONS_AVAILABLE",
  "merchant_id": 19,
  "external_user_id": "user_001"
}
```

## Example output

```text
[Spectrum mock -> user_001] Hey! You spent $18.99 on Whey Protein 2lb. Store B has it for $14.49 (2.1 mi away). Potential savings: $4.50 (23.7%).
```

## Files

- `src/agent/compare.ts`: deterministic price-comparison logic
- `src/agent/message.ts`: user-facing notification template
- `src/agent/workflow.ts`: event-driven orchestration
- `src/server.ts`: Knot webhook server and transaction sync handler
- `src/knot/client.ts`: Knot API client (`/transactions/sync`)
- `src/knot/mapper.ts`: Knot transaction -> internal purchase mapping
- `src/mock/*`: mock purchase and store offer data
- `src/notifications/notifier.ts`: Spectrum-compatible notification output
