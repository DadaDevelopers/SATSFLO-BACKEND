/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS lightning_wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'blink' CHECK (provider IN ('blink')),
      provider_wallet_id TEXT NOT NULL UNIQUE,
      wallet_currency TEXT NOT NULL DEFAULT 'BTC',
      lightning_address TEXT,
      balance_sats BIGINT NOT NULL DEFAULT 0 CHECK (balance_sats >= 0),
      is_default BOOLEAN NOT NULL DEFAULT TRUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, provider)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lightning_wallets_user ON lightning_wallets (user_id)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS lightning_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_id UUID REFERENCES lightning_wallets(id) ON DELETE SET NULL,
      provider TEXT NOT NULL DEFAULT 'blink' CHECK (provider IN ('blink')),
      provider_transaction_id TEXT UNIQUE,
      direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'reward', 'tip', 'payout')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'settled', 'failed', 'expired', 'cancelled')),
      amount_sats BIGINT CHECK (amount_sats IS NULL OR amount_sats > 0),
      fee_sats BIGINT NOT NULL DEFAULT 0 CHECK (fee_sats >= 0),
      memo TEXT,
      payment_request TEXT,
      payment_hash TEXT UNIQUE,
      payment_preimage TEXT,
      destination TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      settled_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_lightning_transactions_user ON lightning_transactions (user_id, created_at DESC)`
  );
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_lightning_transactions_status ON lightning_transactions (status)`
  );
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_lightning_transactions_request ON lightning_transactions (payment_request)`
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS reward_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lightning_transaction_id UUID REFERENCES lightning_transactions(id) ON DELETE SET NULL,
      amount_sats BIGINT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('earn', 'redeem', 'adjustment', 'tip_sent', 'tip_received', 'bonus')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'available', 'claimed', 'reversed')),
      reason TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON reward_ledger (user_id, created_at DESC)`
  );
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS reward_ledger');
  pgm.sql('DROP TABLE IF EXISTS lightning_transactions');
  pgm.sql('DROP TABLE IF EXISTS lightning_wallets');
};
