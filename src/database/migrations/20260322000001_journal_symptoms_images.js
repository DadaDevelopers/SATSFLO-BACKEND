'use strict';

/**
 * Add symptoms (tag array) and images (base64/URL array) to journal_entries.
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE journal_entries
      ADD COLUMN IF NOT EXISTS symptoms TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS images   TEXT[] NOT NULL DEFAULT '{}'
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE journal_entries
      DROP COLUMN IF EXISTS symptoms,
      DROP COLUMN IF EXISTS images
  `);
};
