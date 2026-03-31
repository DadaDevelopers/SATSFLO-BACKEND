'use strict';

/**
 * Add luteal_phase_length and ignore_irregular_cycle to cycle_profiles.
 * These are referenced in the service layer but were missing from the schema.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cycle_profiles
      ADD COLUMN IF NOT EXISTS luteal_phase_length    SMALLINT NOT NULL DEFAULT 14
                                                        CHECK (luteal_phase_length BETWEEN 7 AND 21),
      ADD COLUMN IF NOT EXISTS ignore_irregular_cycle BOOLEAN  NOT NULL DEFAULT FALSE
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cycle_profiles
      DROP COLUMN IF EXISTS luteal_phase_length,
      DROP COLUMN IF EXISTS ignore_irregular_cycle
  `);
};
