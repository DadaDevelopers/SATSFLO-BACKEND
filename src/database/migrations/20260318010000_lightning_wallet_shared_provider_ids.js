/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql('ALTER TABLE lightning_wallets DROP CONSTRAINT IF EXISTS lightning_wallets_provider_wallet_id_key');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_lightning_wallets_provider_wallet_id ON lightning_wallets (provider_wallet_id)');
};

exports.down = async (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_lightning_wallets_provider_wallet_id');
  pgm.sql('ALTER TABLE lightning_wallets ADD CONSTRAINT lightning_wallets_provider_wallet_id_key UNIQUE (provider_wallet_id)');
};