/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE lightning_transactions
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bolt11'
      CHECK (payment_method IN ('bolt11', 'lnurl_pay', 'ln_address'))
  `);

  pgm.sql(`ALTER TABLE lightning_transactions ADD COLUMN IF NOT EXISTS lnurl TEXT`);
  pgm.sql(`ALTER TABLE lightning_transactions ADD COLUMN IF NOT EXISTS lightning_address TEXT`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lightning_transactions_payment_method ON lightning_transactions (payment_method)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lightning_transactions_lnurl ON lightning_transactions (lnurl)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lightning_transactions_lightning_address ON lightning_transactions (lightning_address)`);
};

exports.down = async (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_lightning_transactions_lightning_address');
  pgm.sql('DROP INDEX IF EXISTS idx_lightning_transactions_lnurl');
  pgm.sql('DROP INDEX IF EXISTS idx_lightning_transactions_payment_method');
  pgm.sql('ALTER TABLE lightning_transactions DROP COLUMN IF EXISTS lightning_address');
  pgm.sql('ALTER TABLE lightning_transactions DROP COLUMN IF EXISTS lnurl');
  pgm.sql('ALTER TABLE lightning_transactions DROP COLUMN IF EXISTS payment_method');
};