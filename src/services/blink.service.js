'use strict';

const { blinkConfig, assertBlinkConfigured } = require('../config/blink');

function buildBlinkError(message, statusCode = 502, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function raiseIfBlinkErrors(errors) {
  if (Array.isArray(errors) && errors.length > 0) {
    throw buildBlinkError(errors.map((entry) => entry.message).join('; '), 502, errors);
  }
}

class BlinkService {
  async request(query, variables = {}) {
    assertBlinkConfigured();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), blinkConfig.timeoutMs);

    try {
      const response = await fetch(blinkConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': blinkConfig.apiKey
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw buildBlinkError(`Blink request failed with status ${response.status}`, 502, payload);
      }

      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        throw buildBlinkError(payload.errors.map((entry) => entry.message).join('; '), 502, payload.errors);
      }

      return payload.data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw buildBlinkError('Blink request timed out', 504);
      }

      if (error.statusCode) {
        throw error;
      }

      throw buildBlinkError(error.message || 'Blink request failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getWallets() {
    const data = await this.request(
      `query Me {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
              balance
            }
          }
        }
      }`
    );

    return (data?.me?.defaultAccount?.wallets || []).map((wallet) => ({
      id: wallet.id,
      walletCurrency: wallet.walletCurrency,
      balance: Number(wallet.balance || 0)
    }));
  }

  async getBtcWallet(preferredWalletId = blinkConfig.btcWalletId) {
    const wallets = await this.getWallets();
    const wallet = preferredWalletId
      ? wallets.find((entry) => entry.id === preferredWalletId)
      : wallets.find((entry) => entry.walletCurrency === 'BTC');

    if (!wallet) {
      throw buildBlinkError('Blink BTC wallet not found for the configured account', 404);
    }

    return wallet;
  }

  async createInvoice({ walletId, amountSats, memo }) {
    const data = await this.request(
      `mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
            paymentHash
            paymentSecret
            satoshis
          }
          errors {
            message
          }
        }
      }`,
      {
        input: {
          walletId,
          amount: String(amountSats),
          memo: memo || undefined
        }
      }
    );

    raiseIfBlinkErrors(data?.lnInvoiceCreate?.errors);
    return data?.lnInvoiceCreate?.invoice;
  }

  async probeInvoiceFee({ walletId, paymentRequest }) {
    const data = await this.request(
      `mutation LnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {
        lnInvoiceFeeProbe(input: $input) {
          amount
          errors {
            message
          }
        }
      }`,
      {
        input: {
          walletId,
          paymentRequest
        }
      }
    );

    raiseIfBlinkErrors(data?.lnInvoiceFeeProbe?.errors);
    return {
      amountSats: Number(data?.lnInvoiceFeeProbe?.amount || 0)
    };
  }

  async payInvoice({ walletId, paymentRequest }) {
    const data = await this.request(
      `mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
        lnInvoicePaymentSend(input: $input) {
          status
          errors {
            message
            path
            code
          }
        }
      }`,
      {
        input: {
          walletId,
          paymentRequest
        }
      }
    );

    raiseIfBlinkErrors(data?.lnInvoicePaymentSend?.errors);
    return data?.lnInvoicePaymentSend;
  }

  async payLnurl({ walletId, lnurl, amountSats }) {
    const data = await this.request(
      `mutation LnurlPaymentSend($input: LnurlPaymentSendInput!) {
        lnurlPaymentSend(input: $input) {
          status
          errors {
            code
            message
            path
          }
        }
      }`,
      {
        input: {
          walletId,
          lnurl,
          amount: String(amountSats)
        }
      }
    );

    raiseIfBlinkErrors(data?.lnurlPaymentSend?.errors);
    return data?.lnurlPaymentSend;
  }

  async payLightningAddress({ walletId, lnAddress, amountSats }) {
    const data = await this.request(
      `mutation LnAddressPaymentSend($input: LnAddressPaymentSendInput!) {
        lnAddressPaymentSend(input: $input) {
          status
          errors {
            code
            message
            path
          }
        }
      }`,
      {
        input: {
          walletId,
          lnAddress,
          amount: String(amountSats)
        }
      }
    );

    raiseIfBlinkErrors(data?.lnAddressPaymentSend?.errors);
    return data?.lnAddressPaymentSend;
  }

  async getProofOfPayments(first = 5) {
    const data = await this.request(
      `query PaymentsWithProof($first: Int) {
        me {
          defaultAccount {
            transactions(first: $first) {
              edges {
                node {
                  initiationVia {
                    ... on InitiationViaLn {
                      paymentRequest
                      paymentHash
                    }
                  }
                  settlementVia {
                    ... on SettlementViaIntraLedger {
                      preImage
                    }
                    ... on SettlementViaLn {
                      preImage
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { first }
    );

    return (data?.me?.defaultAccount?.transactions?.edges || [])
      .map((edge) => edge.node)
      .filter(Boolean)
      .map((entry) => ({
        paymentRequest: entry.initiationVia?.paymentRequest || null,
        paymentHash: entry.initiationVia?.paymentHash || null,
        preImage: entry.settlementVia?.preImage || null
      }));
  }
}

module.exports = new BlinkService();