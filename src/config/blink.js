'use strict';

const blinkConfig = {
  apiUrl: process.env.BLINK_API_URL || 'https://api.blink.sv/graphql',
  apiKey: process.env.BLINK_API_KEY || '',
  btcWalletId: process.env.BLINK_BTC_WALLET_ID || '',
  timeoutMs: Number.parseInt(process.env.BLINK_API_TIMEOUT_MS || '10000', 10)
};

function assertBlinkConfigured() {
  if (!blinkConfig.apiKey) {
    const error = new Error('Blink API is not configured. Set BLINK_API_KEY in the runtime environment or SATSFLO-BACKEND/.env, then restart the backend.');
    error.statusCode = 503;
    throw error;
  }
}

module.exports = {
  blinkConfig,
  assertBlinkConfigured
};