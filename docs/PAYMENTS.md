# Lightning Payment Flow

SatsFlo has two parallel Lightning payment systems. They are independent and serve different purposes.

---

## System Overview

| System | Table | Use case | Architecture |
|--------|-------|----------|-------------|
| **Tips** | `gift_transactions` | User-to-user appreciation tips on threads | Peer-to-peer via LNURL-pay |
| **Blink Wallets** | `lightning_wallets`, `lightning_transactions` | Full Lightning wallet (send/receive any payment) | Custodial on Blink |

---

## System 1 — Tips (LNURL-pay)

Tips let any SatsFlo user send sats to another user (or an external Lightning address) as appreciation for a community thread post.

### Flow

```
POST /payments/validate  →  resolve recipient's LNURL endpoint, get min/max sats
POST /payments/tip       →  fetch BOLT11 invoice from recipient's LNURL callback
                         ←  { bolt11_invoice, payment_hash, expires_at }
[user pays invoice in their own wallet]
POST /payments/confirm   →  optimistic confirmation (sender-initiated)
POST /payments/webhook   →  server-side confirmation (from payment processor)
```

### Step-by-step

#### 1. Validate the recipient address

```
POST /api/v1/payments/validate
Body: { lightning_address: "alice@getalby.com" }
      { lightning_address: "LNURL1DP68..." }
```

- Lightning address (`user@domain`) → converted to `https://domain/.well-known/lnurlp/user`
- LNURL bech32 → decoded to a URL (custom bech32 decoder, no external lib)
- `GET` that URL → validates `tag === "payRequest"`, extracts `minSendable`, `maxSendable`

Returns:
```json
{
  "valid": true,
  "min_sats": 1,
  "max_sats": 500000,
  "comment_allowed": 140,
  "description": "..."
}
```

#### 2. Create the tip (fetch invoice)

```
POST /api/v1/payments/tip
Body: {
  "recipient_id": "<uuid>",        // SatsFlo user
  "lightning_address": "...",      // OR external address (recipient_id not needed)
  "amount_sats": 100,
  "thread_id": "<uuid>",           // optional, links tip to thread
  "note": "Great post!"            // optional, sent as LNURL comment
}
```

- Validates `amount_sats` is within `[min_sats, max_sats]`
- Calls `GET {callback}?amount={msats}&comment={note}`
- Extracts the BOLT11 invoice from the response
- Stores in `gift_transactions` with `status = 'pending'`, expires in 10 minutes

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

#### 3. User pays the invoice

The client app hands the `bolt11_invoice` to the user's own Lightning wallet (e.g. via deep-link or display as QR). SatsFlo does **not** initiate the payment — it is peer-to-peer.

#### 4. Confirm payment

Two paths run in parallel:

**Path A — Optimistic (sender-initiated)**
```
POST /api/v1/payments/confirm
Body: { "payment_hash": "abc123..." }
Authorization: Bearer <sender's token>
```
- Matches `payment_hash` AND `sender_id` (scoped to prevent abuse)
- Marks `status = 'completed'`
- Returns 409 if already confirmed, 410 if expired

**Path B — Webhook (provider-initiated)**
```
POST /api/v1/payments/webhook
Headers: { "x-webhook-secret": "<WEBHOOK_SECRET>" }
Body: { "payment_hash": "abc123..." }
```
- No user auth required
- Validates `x-webhook-secret` header (only if `WEBHOOK_SECRET` env var is set)
- Marks `status = 'completed'`

#### Status transitions

```
pending  →  completed   (confirm or webhook)
pending  →  failed      (auto-expiry — getStatus() checks expires_at)
```

### Payment status & history

```
GET /api/v1/payments/status/:paymentHash   → current status
GET /api/v1/payments/history?type=sent     → sent tips (last 50)
GET /api/v1/payments/history?type=received → received tips (last 50)
```

Tips where the recipient is an external address have `receiver_id = null` — these still appear in the sender's history with the `lightning_address` field set.

---

## System 2 — Blink Wallet Integration

For users who want a full Lightning wallet managed through SatsFlo. Backed by [Blink](https://blink.sv) (Galoy).

### Architecture

```
React Native App
      │
      ▼
SatsFlo Backend  ──────────────────────────►  Blink GraphQL API
      │                                              │
      │  sync wallet state                           │  holds BTC balance
      │  store tx history                            │  routes payments
      ▼                                              ▼
PostgreSQL                                   Lightning Network
(lightning_wallets, lightning_transactions)
```

SatsFlo is a stateless proxy — it never holds funds. Blink holds the user's BTC. Every API call syncs the local wallet state from Blink.

### Wallet Sync

Every payment call starts with `syncWallet(userId, walletId)`:

1. Fetches the Blink wallet via GraphQL (`getWallets()`, `getBtcWallet()`)
2. Upserts into `lightning_wallets` (`ON CONFLICT (user_id, provider) DO UPDATE`)
3. Returns `{ localWallet, providerWallet }` — the providerWallet has the live balance

This is idempotent — calling it multiple times never causes duplicate records.

### Create Invoice (Receive Payment)

```
POST /api/v1/lightning/invoices
Body: { "walletId": "...", "amountSats": 5000, "memo": "for coffee" }
```

1. `syncWallet`
2. Call Blink: `lnInvoiceCreate(walletId, amount, memo)`
3. Insert `lightning_transactions` with `direction = 'incoming'`, `status = 'pending'`

Returns the BOLT11 `paymentRequest` the user can share.

### Send Payment

Three payment methods, all converge on a single `submitResolvedInvoicePayment()` call:

#### BOLT11 (direct invoice)

```
POST /api/v1/lightning/payments/pay
Body: { "walletId": "...", "paymentRequest": "lnbc..." }
```

#### LNURL-pay

```
POST /api/v1/lightning/payments/lnurl
Body: { "walletId": "...", "lnurl": "LNURL1...", "amountSats": 100 }
```

1. Decode LNURL → URL
2. `GET {url}` → resolution (`callback`, `minSendable`, `maxSendable`)
3. `GET {callback}?amount={msats}` → BOLT11 invoice
4. `submitResolvedInvoicePayment()`

#### Lightning Address

```
POST /api/v1/lightning/payments/ln-address
Body: { "walletId": "...", "lightningAddress": "alice@example.com", "amountSats": 100 }
```

Same as LNURL after resolving `alice@example.com` → `https://example.com/.well-known/lnurlp/alice`.

#### Unified submission

```js
submitResolvedInvoicePayment(userId, { walletId, paymentRequest, ... })
  1. syncWallet
  2. Blink GraphQL: lnInvoicePaymentSend(walletId, paymentRequest)
  3. Insert lightning_transactions (direction='outgoing')
     - status: 'settled' if Blink returns SUCCESS/SETTLED, else 'pending'
     - settled_at set immediately if status is settled
```

### Fee Estimation (Probe)

```
POST /api/v1/lightning/payments/probe
Body: { "walletId": "...", "paymentRequest": "lnbc..." }
```

Calls Blink `lnInvoiceFeeProbe()` — read-only, does not deduct balance. Returns `feeSats`.

### Payment Preview

```
POST /api/v1/lightning/payments/preview
Body: { "walletId": "...", "paymentMethod": "lnurl_pay", "lnurl": "...", "amountSats": 100 }
```

Resolves the LNURL/address and optionally probes the fee without committing. Used to show the user a confirmation screen before they pay.

### Proof of Payment

```
GET /api/v1/lightning/proof-of-payment?paymentRequest=lnbc...&limit=5
```

Calls Blink to fetch recent transactions and extracts `preImage` (proof). Updates local `lightning_transactions` records with `payment_preimage` and marks them `settled`. This is lazy — called on-demand, not pushed.

### Transaction History

```
GET /api/v1/lightning/transactions?page=1&limit=20
```

Returns local `lightning_transactions` records (sorted by `created_at DESC`).

---

## Error Codes

| Code | Scenario |
|------|----------|
| 400 | Invalid address format, amount out of range |
| 401 | Invalid webhook secret |
| 404 | Transaction or user not found |
| 409 | Transaction already completed or failed |
| 410 | Invoice expired |
| 422 | Recipient has no lightning address set |
| 502 | LNURL endpoint unreachable, Blink API error |
| 503 | `BLINK_API_KEY` not configured |
| 504 | LNURL/Blink request timed out (10s default) |

---

## Configuration

```
BLINK_API_URL=https://api.blink.sv/graphql   (default)
BLINK_API_KEY=<required for Blink features>
BLINK_BTC_WALLET_ID=<required>
BLINK_API_TIMEOUT_MS=10000                   (default)
WEBHOOK_SECRET=<optional, validates webhook calls>
```

Lightning features return `503` if `BLINK_API_KEY` is not set.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `gift_transactions` | Tip invoices (LNURL-pay system) |
| `lightning_wallets` | Blink wallet state per user |
| `lightning_transactions` | All Blink payment history |
| `reward_ledger` | Reward earn/redeem tracking |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full column-level schema.
