'use strict';

/**
 * Migration: profile_wallet
 * - users.phone
 * - cycle_profiles.luteal_phase_length
 * - cycle_profiles.ignore_irregular_cycle
 */

exports.up = (pgm) => {
  // Phone number on users
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);

  // Luteal phase override on cycle_profiles
  pgm.sql(`ALTER TABLE cycle_profiles ADD COLUMN IF NOT EXISTS luteal_phase_length SMALLINT DEFAULT 14 CHECK (luteal_phase_length BETWEEN 7 AND 21)`);

  // Ignore irregular cycle flag
  pgm.sql(`ALTER TABLE cycle_profiles ADD COLUMN IF NOT EXISTS ignore_irregular_cycle BOOLEAN NOT NULL DEFAULT false`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE cycle_profiles DROP COLUMN IF EXISTS ignore_irregular_cycle`);
  pgm.sql(`ALTER TABLE cycle_profiles DROP COLUMN IF EXISTS luteal_phase_length`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS phone`);
};
