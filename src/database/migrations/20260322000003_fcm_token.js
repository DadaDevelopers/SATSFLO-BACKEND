'use strict';

exports.up = async (pgm) => {
  pgm.addColumns('users', {
    fcm_token: { type: 'VARCHAR(500)', notNull: false, default: null },
    fcm_platform: { type: 'VARCHAR(20)', notNull: false, default: null },
  });
};

exports.down = async (pgm) => {
  pgm.dropColumns('users', ['fcm_token', 'fcm_platform']);
};
