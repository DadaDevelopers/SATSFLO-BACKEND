'use strict';

const axios = require('axios');
const { bech32 } = require('bech32');
const bolt11Decoder = require('bolt11');
const { pool } = require('../config/database');

// ─── Format validators ───────────────────────────────────────────────────────

const LN_ADDRESS_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
const LNURL_RE      = /^lnurl[a-z0-9]+$/i;

function err(msg, code = 400) {
  return Object.assign(new Error(msg), { statusCode: code });
}

class PaymentService {

  // ─── Address resolution ────────────────────────────────────────────────────

  /**
   * Detect input type and return the LNURL-pay metadata URL.
   * Accepts: "user@domain.com" or "LNURL1..." bech32.
   */
  _resolveLnurlPayUrl(input) {
    const trimmed = input.trim();

    // Lightning address  e.g. alice@getalby.com
    if (LN_ADDRESS_RE.test(trimmed)) {
      const [username, domain] = trimmed.split('@');
      return `https://${domain}/.well-known/lnurlp/${username}`;
    }

    // LNURL bech32  e.g. LNURL1DP68GURN8...
    if (LNURL_RE.test(trimmed)) {
      try {
        const { words } = bech32.decode(trimmed.toLowerCase(), 2000);
        const bytes = bech32.fromWords(words);
        const url = Buffer.from(bytes).toString('utf8');
        return url;
      } catch {
        throw err('Invalid LNURL encoding');
      }
    }

    throw err('Enter a lightning address (user@domain.com) or an LNURL code');
  }

  /**
   * Fetch LNURL-pay metadata from a lightning address or LNURL.
   * Returns the raw metadata object { tag, callback, minSendable, maxSendable, ... }
   */
  async _fetchPayMetadata(lightningTarget) {
    const metaUrl = this._resolveLnurlPayUrl(lightningTarget);
    let metaRes;
    try {
      metaRes = await axios.get(metaUrl, { timeout: 10000 });
    } catch (e) {
      throw err(`Could not reach lightning address: ${e.message}`, 502);
    }

    const meta = metaRes.data;
    if (meta.tag !== 'payRequest') throw err('Not a valid LNURL-pay endpoint');
    if (!meta.callback)           throw err('LNURL-pay response missing callback');

    return meta;
  }

  // ─── Validate address (Step 1 — before amount entry) ──────────────────────

  /**
   * Validate a lightning address or LNURL and return payment limits.
   * Used by the frontend before showing the amount input.
   */
  async validateAddress(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) throw err('lightning_address or lnurl is required');

    if (!LN_ADDRESS_RE.test(trimmed) && !LNURL_RE.test(trimmed)) {
      throw err('Enter a lightning address (user@domain.com) or an LNURL code');
    }

    const meta = await this._fetchPayMetadata(trimmed);

    // Try to extract a display description from metadata JSON
    let description = '';
    try {
      const parsed = JSON.parse(meta.metadata || '[]');
      const textEntry = parsed.find(([type]) => type === 'text/plain');
      if (textEntry) description = textEntry[1];
    } catch { /* metadata may not be JSON */ }

    return {
      valid: true,
      min_sats: Math.ceil(meta.minSendable / 1000),
      max_sats: Math.floor(meta.maxSendable / 1000),
      comment_allowed: meta.commentAllowed || 0,
      description,
    };
  }

  // ─── Fetch invoice ─────────────────────────────────────────────────────────

  /**
   * Resolve a lightning target to a BOLT11 invoice.
   * lightningTarget: "user@domain.com" OR "LNURL1..."
   */
  async fetchInvoice(lightningTarget, amountSats, comment = '') {
    const meta = await this._fetchPayMetadata(lightningTarget);

    const amountMsats = amountSats * 1000;
    if (amountMsats < meta.minSendable || amountMsats > meta.maxSendable) {
      throw err(
        `Amount must be between ${Math.ceil(meta.minSendable / 1000)} and ${Math.floor(meta.maxSendable / 1000)} sats`
      );
    }

    const callbackUrl = new URL(meta.callback);
    callbackUrl.searchParams.set('amount', amountMsats);
    if (comment && meta.commentAllowed > 0) {
      callbackUrl.searchParams.set('comment', comment.slice(0, meta.commentAllowed));
    }

    let invoiceRes;
    try {
      invoiceRes = await axios.get(callbackUrl.toString(), { timeout: 10000 });
    } catch (e) {
      throw err(`Failed to fetch invoice: ${e.message}`, 502);
    }

    const bolt11Invoice = invoiceRes.data.pr;
    if (!bolt11Invoice) throw err('Lightning address returned no invoice', 502);

    // Prefer payment_hash from callback response; decode from BOLT11 as fallback
    let paymentHash = invoiceRes.data.payment_hash;
    if (!paymentHash) {
      try {
        const decoded = bolt11Decoder.decode(bolt11Invoice);
        paymentHash = decoded.tagsObject.payment_hash;
      } catch {
        paymentHash = require('crypto').randomBytes(32).toString('hex');
      }
    }

    return { bolt11Invoice, paymentHash };
  }

  // ─── Create tip ────────────────────────────────────────────────────────────

  /**
   * Create a tip transaction.
   * Accepts either recipient_id (SatsFlo user) OR lightning_address/lnurl directly.
   */
  async createTip({ senderId, recipientId, lightningAddress, amountSats, threadId, note }) {
    let resolvedAddress = lightningAddress;
    let resolvedRecipientId = recipientId || null;

    if (recipientId) {
      // SatsFlo user — look up their lightning address
      const userResult = await pool.query(
        'SELECT id, name, lightning_address FROM users WHERE id = $1',
        [recipientId]
      );
      const recipient = userResult.rows[0];
      if (!recipient) throw err('Recipient not found', 404);
      if (!recipient.lightning_address) throw err('Recipient has not set a lightning address', 422);
      resolvedAddress = recipient.lightning_address;
    } else if (lightningAddress) {
      // External address — no SatsFlo user record required
      if (!LN_ADDRESS_RE.test(lightningAddress) && !LNURL_RE.test(lightningAddress)) {
        throw err('Invalid lightning address or LNURL');
      }
    } else {
      throw err('recipient_id or lightning_address is required');
    }

    const { bolt11Invoice, paymentHash } = await this.fetchInvoice(resolvedAddress, amountSats, note || '');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO gift_transactions
         (sender_id, receiver_id, lightning_address, amount_sats, thread_id, note,
          bolt11_invoice, payment_hash, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING id, amount_sats, status, created_at, payment_hash, expires_at, lightning_address`,
      [senderId, resolvedRecipientId, resolvedAddress, amountSats,
       threadId || null, note || null, bolt11Invoice, paymentHash, expiresAt]
    );

    const tx = result.rows[0];
    return {
      transaction_id: tx.id,
      bolt11_invoice: bolt11Invoice,
      payment_hash: tx.payment_hash,
      amount_sats: tx.amount_sats,
      expires_at: tx.expires_at,
      lightning_address: tx.lightning_address,
    };
  }

  /**
   * Get payment status by payment hash.
   */
  async getStatus(userId, paymentHash) {
    const result = await pool.query(
      `SELECT id, status, amount_sats, created_at, expires_at, payment_hash
       FROM gift_transactions
       WHERE payment_hash = $1 AND sender_id = $2`,
      [paymentHash, userId]
    );
    const tx = result.rows[0];
    if (!tx) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });

    // Auto-expire if past expiry and still pending
    if (tx.status === 'pending' && new Date(tx.expires_at) < new Date()) {
      await pool.query(
        "UPDATE gift_transactions SET status = 'failed' WHERE id = $1",
        [tx.id]
      );
      tx.status = 'failed';
    }

    return tx;
  }

  /**
   * Mark a transaction as completed by the sender (frontend confirm after paying).
   * Scoped to sender_id so users can only confirm their own outgoing payments.
   */
  async confirmBySender(senderId, paymentHash) {
    const result = await pool.query(
      `UPDATE gift_transactions
       SET status = 'completed'
       WHERE payment_hash = $1
         AND sender_id = $2
         AND status = 'pending'
         AND expires_at > NOW()
       RETURNING id, payment_hash, amount_sats, status, lightning_address, receiver_id`,
      [paymentHash, senderId]
    );
    if (!result.rows[0]) {
      // Check whether it exists but expired vs genuinely missing
      const check = await pool.query(
        `SELECT status, expires_at FROM gift_transactions WHERE payment_hash = $1 AND sender_id = $2`,
        [paymentHash, senderId]
      );
      if (!check.rows[0]) {
        throw err('Transaction not found', 404);
      }
      if (check.rows[0].status !== 'pending') {
        throw err(`Transaction is already ${check.rows[0].status}`, 409);
      }
      throw err('Invoice has expired. Please create a new tip.', 410);
    }
    return result.rows[0];
  }

  /**
   * Mark a transaction as completed (called by webhook — no sender scope).
   */
  async confirmPayment(paymentHash) {
    const result = await pool.query(
      "UPDATE gift_transactions SET status = 'completed' WHERE payment_hash = $1 AND status = 'pending' RETURNING *",
      [paymentHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Get payment history for a user.
   */
  async getHistory(userId, type = 'sent') {
    const field = type === 'received' ? 'receiver_id' : 'sender_id';
    const joinField = type === 'received' ? 'sender_id' : 'receiver_id';
    const joinAlias = type === 'received' ? 'sender' : 'recipient';

    const result = await pool.query(
      `SELECT
         gt.id, gt.amount_sats, gt.status, gt.note, gt.created_at,
         gt.thread_id, gt.payment_hash,
         u.id   AS other_user_id,
         u.name AS other_user_name,
         u.avatar_url AS other_user_avatar
       FROM gift_transactions gt
       JOIN users u ON gt.${joinField} = u.id
       WHERE gt.${field} = $1
       ORDER BY gt.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return result.rows.map(r => ({
      id: r.id,
      amount_sats: r.amount_sats,
      status: r.status,
      note: r.note,
      created_at: r.created_at,
      thread_id: r.thread_id,
      payment_hash: r.payment_hash,
      [joinAlias]: { id: r.other_user_id, name: r.other_user_name, avatar_url: r.other_user_avatar }
    }));
  }
}

module.exports = new PaymentService();
