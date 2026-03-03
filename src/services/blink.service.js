/**
 * Blink Lightning Service
 * 
 * Integrates with Blink API for Lightning Network payments
 * Docs: https://dev.blink.sv/api
 */

const logger = require('../utils/logger');

class BlinkService {
  constructor() {
    this.apiKey = process.env.BLINK_API_KEY;
    this.apiUrl = process.env.BLINK_API_URL || 'https://api.blink.sv/graphql';
    this.walletId = process.env.BLINK_WALLET_ID; // Your app's main wallet
  }

  /**
   * Send sats to Lightning address (for withdrawals)
   */
  async sendToLightningAddress(lightningAddress, amountSats, memo = '') {
    const mutation = `
      mutation LnAddressSend($input: LnAddressSendInput!) {
        lnAddressSend(input: $input) {
          status
          errors {
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        walletId: this.walletId,
        lnAddress: lightningAddress,
        amount: amountSats,
        memo
      }
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey
        },
        body: JSON.stringify({ query: mutation, variables })
      });

      const result = await response.json();

      if (result.errors || result.data?.lnAddressSend?.errors?.length > 0) {
        const errorMsg = result.errors?.[0]?.message || result.data.lnAddressSend.errors[0].message;
        throw new Error(`Blink payment failed: ${errorMsg}`);
      }

      logger.info('Blink payment sent', { lightningAddress, amountSats });
      return {
        status: result.data.lnAddressSend.status,
        success: true
      };
    } catch (error) {
      logger.error('Blink payment error', error);
      throw error;
    }
  }

  /**
   * Pay Lightning invoice (alternative withdrawal method)
   */
  async payInvoice(invoice, memo = '') {
    const mutation = `
      mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
        lnInvoicePaymentSend(input: $input) {
          status
          errors {
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        walletId: this.walletId,
        paymentRequest: invoice,
        memo
      }
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey
        },
        body: JSON.stringify({ query: mutation, variables })
      });

      const result = await response.json();

      if (result.errors || result.data?.lnInvoicePaymentSend?.errors?.length > 0) {
        const errorMsg = result.errors?.[0]?.message || result.data.lnInvoicePaymentSend.errors[0].message;
        throw new Error(`Invoice payment failed: ${errorMsg}`);
      }

      logger.info('Invoice paid', { invoice: invoice.substring(0, 20) + '...' });
      return {
        status: result.data.lnInvoicePaymentSend.status,
        success: true
      };
    } catch (error) {
      logger.error('Invoice payment error', error);
      throw error;
    }
  }

  /**
   * Get wallet balance (your app's pooled wallet)
   */
  async getBalance() {
    const query = `
      query Me {
        me {
          defaultAccount {
            wallets {
              id
              balance
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey
        },
        body: JSON.stringify({ query })
      });

      const result = await response.json();
      const wallet = result.data?.me?.defaultAccount?.wallets?.find(w => w.id === this.walletId);

      return wallet?.balance || 0;
    } catch (error) {
      logger.error('Failed to get Blink balance', error);
      throw error;
    }
  }

  /**
   * Validate Lightning address format
   */
  isValidLightningAddress(address) {
    // Format: username@domain.com
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(address);
  }

  /**
   * Decode Lightning invoice to get amount
   */
  async decodeInvoice(invoice) {
    // You can use bolt11 library or Blink's decode endpoint
    // For now, basic validation
    return invoice.toLowerCase().startsWith('lnbc');
  }
}

module.exports = new BlinkService();
