'use strict';

const axios = require('axios');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class PaymentService {
  /**
   * Resolve a lightning address to a BOLT11 invoice via LNURL-pay.
   * lightningAddress: "user@domain.com"
   * amountSats: number
   */
  async fetchInvoiceFromLightningAddress(lightningAddress, amountSats, comment = '') {
    const [username, domain] = lightningAddress.split('@');
    if (!username || !domain) throw Object.assign(new Error('Invalid lightning address'), { statusCode: 400 });

    const lnurlPayUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    const metaRes = await axios.get(lnurlPayUrl, { timeout: 10000 });
    const meta = metaRes.data;

    if (meta.tag !== 'payRequest') throw Object.assign(new Error('Not a valid LNURL-pay endpoint'), { statusCode: 400 });

    const amountMsats = amountSats * 1000;
    if (amountMsats < meta.minSendable || amountMsats > meta.maxSendable) {
      throw Object.assign(
        new Error(`Amount must be between ${meta.minSendable / 1000} and ${meta.maxSendable / 1000} sats`),
        { statusCode: 400 }
      );
    }

    const callbackUrl = new URL(meta.callback);
    callbackUrl.searchParams.set('amount', amountMsats);
    if (comment && meta.commentAllowed > 0) {
      callbackUrl.searchParams.set('comment', comment.slice(0, meta.commentAllowed));
    }

    const invoiceRes = await axios.get(callbackUrl.toString(), { timeout: 10000 });
    const { pr: bolt11Invoice, routes } = invoiceRes.data;

    if (!bolt11Invoice) throw Object.assign(new Error('Failed to fetch invoice from lightning address'), { statusCode: 502 });

    // Extract payment hash from invoice (last 64 hex chars before checksum for bech32)
    // Simple approach: use the payment_hash from the response if available, else derive
    const paymentHash = invoiceRes.data.payment_hash || bolt11Invoice.slice(-64);

    return { bolt11Invoice, paymentHash };
  }

  /**
   * Create a tip transaction.
   */
  async createTip({ senderId, recipientId, amountSats, threadId, note }) {
    // Get recipient's lightning address
    const userResult = await pool.query(
      'SELECT id, name, lightning_address FROM users WHERE id = $1',
      [recipientId]
    );
    const recipient = userResult.rows[0];
    if (!recipient) throw Object.assign(new Error('Recipient not found'), { statusCode: 404 });
    if (!recipient.lightning_address) throw Object.assign(new Error('Recipient has not set a lightning address'), { statusCode: 422 });

    const { bolt11Invoice, paymentHash } = await this.fetchInvoiceFromLightningAddress(
      recipient.lightning_address, amountSats, note || ''
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const result = await pool.query(
      `INSERT INTO gift_transactions
         (sender_id, receiver_id, amount_sats, thread_id, note, bolt11_invoice, payment_hash, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id, amount_sats, status, created_at, payment_hash, expires_at`,
      [senderId, recipientId, amountSats, threadId || null, note || null, bolt11Invoice, paymentHash, expiresAt]
    );

    const tx = result.rows[0];
    return {
      transaction_id: tx.id,
      invoice: bolt11Invoice,
      payment_hash: tx.payment_hash,
      amount_sats: tx.amount_sats,
      expires_at: tx.expires_at,
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
   * Mark a transaction as completed (called by webhook).
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
