'use strict';

/**
 * Add weight_unit and temperature_unit to day_logs.
 * Expand flow_level CHECK to include 'very_heavy'.
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
  // Expand flow_level CHECK to include 'very_heavy'
  pgm.sql(`ALTER TABLE day_logs DROP CONSTRAINT IF EXISTS day_logs_flow_level_check`);
  pgm.sql(`
    ALTER TABLE day_logs
      ADD CONSTRAINT day_logs_flow_level_check
      CHECK (flow_level IN ('spotting','light','medium','heavy','very_heavy'))
  `);

  // Add unit columns
  pgm.sql(`
    ALTER TABLE day_logs
      ADD COLUMN IF NOT EXISTS weight_unit      TEXT NOT NULL DEFAULT 'kg'
                                                  CHECK (weight_unit IN ('kg','lb')),
      ADD COLUMN IF NOT EXISTS temperature_unit TEXT NOT NULL DEFAULT 'C'
                                                  CHECK (temperature_unit IN ('C','F'))
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE day_logs DROP COLUMN IF EXISTS weight_unit`);
  pgm.sql(`ALTER TABLE day_logs DROP COLUMN IF EXISTS temperature_unit`);

  pgm.sql(`ALTER TABLE day_logs DROP CONSTRAINT IF EXISTS day_logs_flow_level_check`);
  pgm.sql(`
    ALTER TABLE day_logs
      ADD CONSTRAINT day_logs_flow_level_check
      CHECK (flow_level IN ('spotting','light','medium','heavy'))
  `);
};
