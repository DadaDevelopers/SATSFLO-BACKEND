'use strict';

/**
 * Migration: gift_transactions_fix
 * - Make receiver_id nullable (tips can go to external Lightning addresses)
 * - Add lightning_address column to store the resolved address used
 */

exports.up = (pgm) => {
  // Allow external tips (no SatsFlo account needed)
  pgm.sql(`ALTER TABLE gift_transactions ALTER COLUMN receiver_id DROP NOT NULL`);

  // Store the resolved lightning address used for the payment
  pgm.sql(`ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS lightning_address TEXT`);

  // Also relax sender_id NOT NULL → ON DELETE SET NULL already handles it,
  // but the FK itself should not cascade-delete transactions on user delete
  pgm.sql(`ALTER TABLE gift_transactions ALTER COLUMN sender_id DROP NOT NULL`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE gift_transactions DROP COLUMN IF EXISTS lightning_address`);
  pgm.sql(`ALTER TABLE gift_transactions ALTER COLUMN receiver_id SET NOT NULL`);
  pgm.sql(`ALTER TABLE gift_transactions ALTER COLUMN sender_id SET NOT NULL`);
};
