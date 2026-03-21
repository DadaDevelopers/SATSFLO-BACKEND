'use strict';

/**
 * Add optional title and mood columns to journal_entries.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE journal_entries
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS mood  TEXT
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE journal_entries
      DROP COLUMN IF EXISTS title,
      DROP COLUMN IF EXISTS mood
  `);
};
