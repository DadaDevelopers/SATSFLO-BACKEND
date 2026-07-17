# Payment Flow

SatsFlo currently implements peer-to-peer Lightning tipping — no third-party wallet API, no fund custody. Users tip each other using their own Lightning wallets via the LNURL-pay standard.

> **Future scope:** A full in-app Lightning wallet (custodial, via Blink or similar) is planned for a later version when SatsFlo becomes a wallet product. The database schema (`lightning_wallets`, `lightning_transactions`) and service stubs (`lightning.service.js`, `blink.service.js`) are already in the codebase but are **not wired up to any active frontend**. Do not build on them yet.

---

## How It Works

```
POST /payments/validate  →  resolve recipient's Lightning address / LNURL, get min/max sats
POST /payments/tip       →  fetch BOLT11 invoice from recipient's LNURL callback
                         ←  { bolt11_invoice, payment_hash, expires_at }
[user pays invoice in their own Lightning wallet — SatsFlo never touches funds]
POST /payments/confirm   →  sender tells us the payment went through (optimistic)
POST /payments/webhook   →  OR the payment processor tells us (async confirmation)
```

SatsFlo's backend only fetches invoices and records status. It never holds or routes sats.

---

## Step-by-step

### 1. Validate the recipient address

```
POST /api/v1/payments/validate
Body: { "lightning_address": "alice@getalby.com" }
  OR  { "lightning_address": "LNURL1DP68..." }
```

- Lightning address (`user@domain`) → converted to `https://domain/.well-known/lnurlp/user`
- LNURL bech32 → decoded to a URL using a custom bech32 decoder (no external lib)
- `GET {url}` → validates `tag === "payRequest"`, extracts sendable range

Returns:
```json
{
  "valid": true,
  "min_sats": 1,
  "max_sats": 500000,
  "comment_allowed": 140,
  "description": "Tips for Alice"
}
```

### 2. Create the tip — fetch a BOLT11 invoice

```
POST /api/v1/payments/tip
Body: {
  "recipient_id": "<uuid>",          // SatsFlo user (optional if lightning_address given)
  "lightning_address": "...",        // OR external address
  "amount_sats": 100,
  "thread_id": "<uuid>",             // optional — links tip to a community thread
  "note": "Great post!"              // optional — sent as LNURL comment
}
```

What happens:
1. Validates `amount_sats` is within `[min_sats, max_sats]`
2. Calls `GET {callback}?amount={msats}&comment={note}` on the recipient's LNURL endpoint
3. Extracts the BOLT11 invoice (`pr`) from the response
4. Inserts a `gift_transactions` row — `status = 'pending'`, expires in **10 minutes**

Returns:
```json
{
  "transaction_id": "...",
  "bolt11_invoice": "lnbc...",
  "payment_hash": "abc123...",
  "amount_sats": 100,
  "expires_at": "2026-06-08T11:10:00Z",
  "lightning_address": "alice@getalby.com"
}
```

### 3. User pays the invoice

The frontend displays the `bolt11_invoice` as a QR code or passes it to a deep-link handler so the user's own wallet app opens and pays it. SatsFlo does not initiate or route the payment.

### 4. Confirm the payment

Two independent paths — whichever fires first wins:

**Path A — Optimistic (sender-initiated)**
```
POST /api/v1/payments/confirm
Authorization: Bearer <sender's token>
Body: { "payment_hash": "abc123..." }
```
- The WHERE clause includes `sender_id = $2` — a sender can only confirm their own tip
- Sets `status = 'completed'`
- Returns 409 if already confirmed, 410 if expired

**Path B — Webhook (provider-initiated)**
```
POST /api/v1/payments/webhook
Headers: { "x-webhook-secret": "<WEBHOOK_SECRET>" }
Body: { "payment_hash": "abc123..." }
```
- No user auth — called by the payment processor
- Validates the `x-webhook-secret` header (only enforced if `WEBHOOK_SECRET` env var is set)
- Sets `status = 'completed'`

### Status transitions

```
pending  →  completed   (confirm or webhook)
pending  →  failed      (auto-expiry — getStatus() checks expires_at on read)
```

---

## Other Endpoints

```
GET /api/v1/payments/status/:paymentHash   → { status, amount_sats, expires_at, ... }
GET /api/v1/payments/history?type=sent     → last 50 sent tips
GET /api/v1/payments/history?type=received → last 50 received tips
GET /api/v1/payments/btc-price             → current BTC/USD rate
```

Tips to external addresses (no SatsFlo `receiver_id`) appear in the sender's history with `lightning_address` set and `recipient: null`.

---

## Error Codes

| Code | Scenario |
|------|----------|
| 400 | Invalid address format, amount out of range |
| 401 | Invalid webhook secret |
| 404 | Transaction not found |
| 409 | Transaction already completed or failed |
| 410 | Invoice expired |
| 422 | Recipient has no lightning address set on their profile |
| 502 | LNURL endpoint unreachable or returned an invalid response |
| 504 | LNURL request timed out (10 s) |

---

## Database Table

```
gift_transactions
  id               UUID PK
  sender_id        UUID → users (nullable — external sender)
  receiver_id      UUID → users (nullable — external recipient)
  amount_sats      BIGINT
  thread_id        UUID (optional)
  bolt11_invoice   TEXT
  payment_hash     VARCHAR(255) UNIQUE
  lightning_address TEXT
  note             TEXT
  status           pending | completed | failed
  expires_at       TIMESTAMPTZ (10 min from creation)
  created_at       TIMESTAMPTZ
```

---

## Configuration

```
WEBHOOK_SECRET=<optional>   # if set, validates x-webhook-secret header on /payments/webhook
```

No other payment-specific env vars are needed for the current implementation.
