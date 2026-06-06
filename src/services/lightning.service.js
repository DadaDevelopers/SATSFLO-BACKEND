'use strict';

const { pool, dbConfig } = require('../config/database');
const { blinkConfig } = require('../config/blink');
const blinkService = require('./blink.service');

const WALLET_TABLE = dbConfig.tables.LIGHTNING_WALLETS;
const TRANSACTION_TABLE = dbConfig.tables.LIGHTNING_TRANSACTIONS;
const LNURL_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const PAYMENT_METHODS = {
  BOLT11: 'bolt11',
  LNURL_PAY: 'lnurl_pay',
  LN_ADDRESS: 'ln_address',
};

function buildLightningError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizeStatus(status) {
  switch ((status || '').toUpperCase()) {
    case 'SUCCESS':
    case 'SETTLED':
      return 'settled';
    case 'FAILED':
    case 'FAILURE':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function normalizeLightningAddress(lightningAddress) {
  const trimmed = String(lightningAddress || '').trim();
  const parts = trimmed.split('@');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw buildLightningError('lightningAddress must look like name@domain');
  }

  return `${parts[0]}@${parts[1].toLowerCase()}`;
}

function isLocalhostHostname(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

function normalizeRemoteUrl(input, label) {
  let parsed;

  try {
    parsed = new URL(input);
  } catch (error) {
    throw buildLightningError(`${label} is not a valid URL`, 400, error.message);
  }

  const isLocalhost = isLocalhostHostname(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
    throw buildLightningError(`${label} must use HTTPS`, 400);
  }

  return parsed;
}

function bech32Polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;

  values.forEach((value) => {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;

    for (let i = 0; i < generators.length; i += 1) {
      if ((top >> i) & 1) {
        checksum ^= generators[i];
      }
    }
  });

  return checksum;
}

function bech32HrpExpand(hrp) {
  const expanded = [];

  for (let i = 0; i < hrp.length; i += 1) {
    expanded.push(hrp.charCodeAt(i) >> 5);
  }

  expanded.push(0);

  for (let i = 0; i < hrp.length; i += 1) {
    expanded.push(hrp.charCodeAt(i) & 31);
  }

  return expanded;
}

function verifyBech32Checksum(hrp, data) {
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 1;
}

function decodeBech32(input) {
  const value = String(input || '').trim();
  const lower = value.toLowerCase();
  const upper = value.toUpperCase();

  if (value !== lower && value !== upper) {
    throw buildLightningError('LNURL bech32 value must not mix upper and lower case');
  }

  const normalized = lower;
  const separatorIndex = normalized.lastIndexOf('1');

  if (separatorIndex < 1 || separatorIndex + 7 > normalized.length) {
    throw buildLightningError('Invalid LNURL bech32 format');
  }

  const hrp = normalized.slice(0, separatorIndex);
  const dataPart = normalized.slice(separatorIndex + 1);
  const data = [];

  for (const char of dataPart) {
    const index = LNURL_CHARSET.indexOf(char);

    if (index === -1) {
      throw buildLightningError('Invalid LNURL bech32 character');
    }

    data.push(index);
  }

  if (!verifyBech32Checksum(hrp, data)) {
    throw buildLightningError('Invalid LNURL checksum');
  }

  return {
    hrp,
    data: data.slice(0, -6),
  };
}

function convertBits(data, fromBits, toBits, pad) {
  let value = 0;
  let bits = 0;
  const maxValue = (1 << toBits) - 1;
  const result = [];

  data.forEach((entry) => {
    if (entry < 0 || entry >> fromBits !== 0) {
      throw buildLightningError('Invalid LNURL data');
    }

    value = (value << fromBits) | entry;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      result.push((value >> bits) & maxValue);
    }
  });

  if (pad) {
    if (bits > 0) {
      result.push((value << (toBits - bits)) & maxValue);
    }
  } else if (bits >= fromBits || (value << (toBits - bits)) & maxValue) {
    throw buildLightningError('Invalid LNURL padding');
  }

  return result;
}

function decodeLnurlToUrl(lnurl) {
  const trimmed = String(lnurl || '').trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeRemoteUrl(trimmed, 'LNURL').toString();
  }

  if (!/^lnurl/i.test(trimmed)) {
    throw buildLightningError('LNURL must be a bech32 LNURL or HTTPS URL');
  }

  const decoded = decodeBech32(trimmed);
  if (decoded.hrp !== 'lnurl') {
    throw buildLightningError('Invalid LNURL prefix');
  }

  const bytes = convertBits(decoded.data, 5, 8, false);
  const url = Buffer.from(bytes).toString('utf8');
  return normalizeRemoteUrl(url, 'LNURL').toString();
}

function parseLnurlMetadata(metadata) {
  if (typeof metadata !== 'string' || metadata.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(metadata);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function fetchJson(url, { timeoutMs = blinkConfig.timeoutMs } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw buildLightningError(`Request failed with status ${response.status}`, 502, payload);
    }

    if (!payload || typeof payload !== 'object') {
      throw buildLightningError('Expected a JSON response from Lightning target', 502);
    }

    if (String(payload.status || '').toUpperCase() === 'ERROR') {
      throw buildLightningError(
        payload.reason || 'Lightning target returned an error',
        502,
        payload
      );
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw buildLightningError('Lightning target request timed out', 504);
    }

    if (error.statusCode) {
      throw error;
    }

    throw buildLightningError(error.message || 'Lightning target request failed', 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapResolutionResult({
  paymentMethod,
  target,
  resolvedUrl,
  response,
  callback,
  lightningAddress = null,
}) {
  const minSendableMsat = Number(response.minSendable || 0);
  const maxSendableMsat = Number(response.maxSendable || 0);
  const commentAllowed = Number(response.commentAllowed || 0);

  if (
    !Number.isFinite(minSendableMsat) ||
    !Number.isFinite(maxSendableMsat) ||
    minSendableMsat <= 0 ||
    maxSendableMsat < minSendableMsat
  ) {
    throw buildLightningError(
      'Lightning target returned invalid min/max sendable values',
      502,
      response
    );
  }

  return {
    paymentMethod,
    target,
    lightningAddress,
    resolvedUrl,
    callback,
    domain: new URL(resolvedUrl).hostname,
    minSendableMsat,
    maxSendableMsat,
    minSendableSats: Math.ceil(minSendableMsat / 1000),
    maxSendableSats: Math.floor(maxSendableMsat / 1000),
    metadataEntries: parseLnurlMetadata(response.metadata),
    metadataRaw: response.metadata || null,
    commentAllowed,
    allowsNostr: Boolean(response.allowsNostr),
    nostrPubkey: response.nostrPubkey || null,
    tag: response.tag,
    raw: response,
  };
}

async function requestLnurlInvoice(resolution, { amountSats, comment }) {
  if (!Number.isSafeInteger(amountSats) || amountSats < 1) {
    throw buildLightningError('amountSats must be a positive integer');
  }

  const amountMsat = amountSats * 1000;
  if (amountMsat < resolution.minSendableMsat || amountMsat > resolution.maxSendableMsat) {
    throw buildLightningError(
      `amountSats must be between ${resolution.minSendableSats} and ${resolution.maxSendableSats} for this target`
    );
  }

  if (comment) {
    if (!resolution.commentAllowed) {
      throw buildLightningError('This LNURL target does not allow comments');
    }

    if (comment.length > resolution.commentAllowed) {
      throw buildLightningError(
        `comment exceeds the allowed limit of ${resolution.commentAllowed} characters`
      );
    }
  }

  const callbackUrl = new URL(resolution.callback);
  callbackUrl.searchParams.set('amount', String(amountMsat));

  if (comment) {
    callbackUrl.searchParams.set('comment', comment);
  }

  const response = await fetchJson(callbackUrl.toString());
  const paymentRequest = response.pr || response.paymentRequest || null;

  if (!paymentRequest) {
    throw buildLightningError('LNURL callback did not return a BOLT11 invoice', 502, response);
  }

  return {
    paymentRequest,
    callbackUrl: callbackUrl.toString(),
    disposable: Boolean(response.disposable),
    successAction: response.successAction || null,
    verifyUrl: response.verify || null,
    raw: response,
  };
}

async function createOutgoingPaymentRecord({
  userId,
  walletId,
  status,
  amountSats = null,
  memo = null,
  paymentMethod,
  paymentRequest = null,
  lnurl = null,
  lightningAddress = null,
  destination = null,
  metadata = {},
  settledAt = null,
}) {
  const result = await pool.query(
    `INSERT INTO ${TRANSACTION_TABLE}
      (user_id, wallet_id, provider, direction, transaction_type, status, amount_sats, memo,
       payment_method, payment_request, lnurl, lightning_address, destination, metadata, settled_at)
     VALUES ($1, $2, 'blink', 'outgoing', 'payment', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      userId,
      walletId,
      status,
      amountSats,
      memo,
      paymentMethod,
      paymentRequest,
      lnurl,
      lightningAddress,
      destination,
      metadata,
      settledAt,
    ]
  );

  return result.rows[0];
}

class LightningService {
  async submitResolvedInvoicePayment(
    userId,
    {
      walletId,
      paymentRequest,
      memo,
      amountSats = null,
      paymentMethod,
      lnurl = null,
      lightningAddress = null,
      destination = null,
      metadata = {},
    }
  ) {
    const { localWallet, providerWallet } = await this.syncWallet(userId, walletId);
    const payment = await blinkService.payInvoice({
      walletId: providerWallet.id,
      paymentRequest,
    });
    const status = normalizeStatus(payment?.status);

    const transaction = await createOutgoingPaymentRecord({
      userId,
      walletId: localWallet.id,
      status,
      amountSats,
      memo: memo || null,
      paymentMethod,
      paymentRequest,
      lnurl,
      lightningAddress,
      destination,
      metadata: {
        ...metadata,
        blinkPayment: payment,
      },
      settledAt: status === 'settled' ? new Date() : null,
    });

    return {
      wallet: providerWallet,
      payment,
      transaction,
    };
  }

  async syncWallet(userId, preferredWalletId) {
    const remoteWallet = await blinkService.getBtcWallet(preferredWalletId);

    const result = await pool.query(
      `INSERT INTO ${WALLET_TABLE}
        (user_id, provider, provider_wallet_id, wallet_currency, balance_sats, is_default, metadata, last_synced_at)
       VALUES ($1, 'blink', $2, $3, $4, true, $5, NOW())
       ON CONFLICT (user_id, provider)
       DO UPDATE SET
         provider_wallet_id = EXCLUDED.provider_wallet_id,
         wallet_currency = EXCLUDED.wallet_currency,
         balance_sats = EXCLUDED.balance_sats,
         metadata = EXCLUDED.metadata,
         last_synced_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        remoteWallet.id,
        remoteWallet.walletCurrency,
        remoteWallet.balance,
        { providerWallet: remoteWallet },
      ]
    );

    return {
      localWallet: result.rows[0],
      providerWallet: remoteWallet,
    };
  }

  async getWallet(userId, preferredWalletId) {
    return this.syncWallet(userId, preferredWalletId);
  }

  async createInvoice(userId, { amountSats, memo, walletId }) {
    const { localWallet, providerWallet } = await this.syncWallet(userId, walletId);
    const invoice = await blinkService.createInvoice({
      walletId: providerWallet.id,
      amountSats,
      memo,
    });

    const result = await pool.query(
      `INSERT INTO ${TRANSACTION_TABLE}
        (user_id, wallet_id, provider, direction, transaction_type, status, amount_sats, memo,
         payment_method, payment_request, payment_hash, metadata)
       VALUES ($1, $2, 'blink', 'incoming', 'invoice', 'pending', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        localWallet.id,
        Number(invoice?.satoshis || amountSats),
        memo || null,
        PAYMENT_METHODS.BOLT11,
        invoice?.paymentRequest || null,
        invoice?.paymentHash || null,
        { blinkInvoice: invoice },
      ]
    );

    return {
      wallet: providerWallet,
      invoice,
      transaction: result.rows[0],
    };
  }

  async probePayment(userId, { paymentRequest, walletId }) {
    const { providerWallet } = await this.syncWallet(userId, walletId);
    const probe = await blinkService.probeInvoiceFee({
      walletId: providerWallet.id,
      paymentRequest,
    });

    return {
      wallet: providerWallet,
      paymentRequest,
      feeSats: probe.amountSats,
    };
  }

  async payInvoice(userId, { paymentRequest, walletId, memo }) {
    return this.submitResolvedInvoicePayment(userId, {
      walletId,
      paymentRequest,
      memo,
      paymentMethod: PAYMENT_METHODS.BOLT11,
      destination: paymentRequest,
      metadata: {
        paymentInput: {
          paymentRequest,
        },
      },
    });
  }

  async resolveLnurl(lnurl) {
    const resolvedUrl = decodeLnurlToUrl(lnurl);
    const response = await fetchJson(resolvedUrl);

    if (String(response.tag || '').toLowerCase() !== 'payrequest') {
      throw buildLightningError('Resolved LNURL is not an LNURL-pay target', 400, response);
    }

    if (!response.callback) {
      throw buildLightningError('LNURL-pay target is missing a callback URL', 502, response);
    }

    const callback = normalizeRemoteUrl(response.callback, 'LNURL callback').toString();

    return mapResolutionResult({
      paymentMethod: PAYMENT_METHODS.LNURL_PAY,
      target: lnurl,
      resolvedUrl,
      response,
      callback,
    });
  }

  async resolveLightningAddress(lightningAddress) {
    const normalizedAddress = normalizeLightningAddress(lightningAddress);
    const [name, domain] = normalizedAddress.split('@');
    const addressHost = new URL(`http://${domain}`).hostname;
    const protocol = isLocalhostHostname(addressHost) ? 'http' : 'https';
    const resolvedUrl = normalizeRemoteUrl(
      `${protocol}://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`,
      'Lightning Address endpoint'
    ).toString();
    const response = await fetchJson(resolvedUrl);

    if (String(response.tag || '').toLowerCase() !== 'payrequest') {
      throw buildLightningError(
        'Lightning Address did not resolve to an LNURL-pay target',
        400,
        response
      );
    }

    if (!response.callback) {
      throw buildLightningError(
        'Lightning Address target is missing a callback URL',
        502,
        response
      );
    }

    const callback = normalizeRemoteUrl(response.callback, 'Lightning Address callback').toString();

    return mapResolutionResult({
      paymentMethod: PAYMENT_METHODS.LN_ADDRESS,
      target: normalizedAddress,
      lightningAddress: normalizedAddress,
      resolvedUrl,
      response,
      callback,
    });
  }

  async previewPayment(
    userId,
    { paymentMethod, paymentRequest, lnurl, lightningAddress, amountSats, walletId, comment }
  ) {
    switch (paymentMethod) {
      case PAYMENT_METHODS.BOLT11: {
        const probe = await this.probePayment(userId, { paymentRequest, walletId });
        return {
          paymentMethod,
          paymentRequest,
          wallet: probe.wallet,
          feeSats: probe.feeSats,
        };
      }

      case PAYMENT_METHODS.LNURL_PAY: {
        const resolution = await this.resolveLnurl(lnurl);
        const preview = {
          paymentMethod,
          resolution,
        };

        if (Number.isSafeInteger(amountSats) && amountSats > 0) {
          const invoice = await requestLnurlInvoice(resolution, { amountSats, comment });
          preview.invoice = invoice;

          if (blinkConfig.apiKey) {
            const probe = await this.probePayment(userId, {
              paymentRequest: invoice.paymentRequest,
              walletId,
            });
            preview.wallet = probe.wallet;
            preview.feeSats = probe.feeSats;
          }
        }

        return preview;
      }

      case PAYMENT_METHODS.LN_ADDRESS: {
        const resolution = await this.resolveLightningAddress(lightningAddress);
        const preview = {
          paymentMethod,
          resolution,
        };

        if (Number.isSafeInteger(amountSats) && amountSats > 0) {
          const invoice = await requestLnurlInvoice(resolution, { amountSats, comment });
          preview.invoice = invoice;

          if (blinkConfig.apiKey) {
            const probe = await this.probePayment(userId, {
              paymentRequest: invoice.paymentRequest,
              walletId,
            });
            preview.wallet = probe.wallet;
            preview.feeSats = probe.feeSats;
          }
        }

        return preview;
      }

      default:
        throw buildLightningError(
          'Unsupported paymentMethod. Use bolt11, lnurl_pay, or ln_address.'
        );
    }
  }

  async payLnurl(userId, { lnurl, amountSats, walletId, memo }) {
    const resolution = await this.resolveLnurl(lnurl);
    const invoice = await requestLnurlInvoice(resolution, { amountSats });

    return this.submitResolvedInvoicePayment(userId, {
      walletId,
      paymentRequest: invoice.paymentRequest,
      memo,
      amountSats,
      paymentMethod: PAYMENT_METHODS.LNURL_PAY,
      lnurl,
      destination: lnurl,
      metadata: {
        lnurlResolution: resolution,
        lnurlInvoice: invoice,
        paymentInput: {
          lnurl,
          amountSats,
        },
      },
    });
  }

  async payLightningAddress(userId, { lightningAddress, amountSats, walletId, memo }) {
    const resolution = await this.resolveLightningAddress(lightningAddress);
    const invoice = await requestLnurlInvoice(resolution, { amountSats });
    const normalizedAddress =
      resolution.lightningAddress || normalizeLightningAddress(lightningAddress);

    return this.submitResolvedInvoicePayment(userId, {
      walletId,
      paymentRequest: invoice.paymentRequest,
      memo,
      amountSats,
      paymentMethod: PAYMENT_METHODS.LN_ADDRESS,
      lightningAddress: normalizedAddress,
      destination: normalizedAddress,
      metadata: {
        lightningAddressResolution: resolution,
        lnurlInvoice: invoice,
        paymentInput: {
          lightningAddress: normalizedAddress,
          amountSats,
        },
      },
    });
  }

  async listTransactions(userId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TRANSACTION_TABLE} WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT t.*, w.provider_wallet_id, w.wallet_currency
         FROM ${TRANSACTION_TABLE} t
         LEFT JOIN ${WALLET_TABLE} w ON w.id = t.wallet_id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
    ]);

    return {
      transactions: rowsResult.rows,
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async getProofOfPayment(userId, { paymentRequest, limit = 5 }) {
    const proofs = await blinkService.getProofOfPayments(limit);
    const matchingProofs = paymentRequest
      ? proofs.filter((entry) => entry.paymentRequest === paymentRequest)
      : proofs;

    if (paymentRequest && matchingProofs.length === 0) {
      const error = new Error('Proof of payment not found for the provided invoice');
      error.statusCode = 404;
      throw error;
    }

    await Promise.all(
      matchingProofs
        .filter((entry) => entry.paymentRequest)
        .map((entry) =>
          pool.query(
            `UPDATE ${TRANSACTION_TABLE}
             SET payment_hash = COALESCE($1, payment_hash),
                 payment_preimage = COALESCE($2, payment_preimage),
                 status = CASE WHEN $2 IS NOT NULL THEN 'settled' ELSE status END,
                 settled_at = CASE WHEN $2 IS NOT NULL THEN COALESCE(settled_at, NOW()) ELSE settled_at END,
                 updated_at = NOW()
             WHERE user_id = $3 AND payment_request = $4`,
            [entry.paymentHash, entry.preImage, userId, entry.paymentRequest]
          )
        )
    );

    return matchingProofs;
  }
}

module.exports = new LightningService();
