'use strict';

exports.up = async (pgm) => {
  // Add OTP columns to users
  pgm.addColumns('users', {
    email_otp: {
      type: 'VARCHAR(6)',
      notNull: false,
    },
    email_otp_expires: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
    lightning_address: {
      type: 'VARCHAR(255)',
      notNull: false,
    },
  }, { ifNotExists: true });

  // Add payment columns to gift_transactions
  pgm.addColumns('gift_transactions', {
    bolt11_invoice: {
      type: 'TEXT',
      notNull: false,
    },
    payment_hash: {
      type: 'VARCHAR(255)',
      notNull: false,
      unique: true,
    },
    note: {
      type: 'TEXT',
      notNull: false,
    },
    expires_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
  }, { ifNotExists: true });

  // Index on gift_transactions(payment_hash)
  pgm.createIndex('gift_transactions', 'payment_hash', {
    name: 'idx_gift_transactions_payment_hash',
    ifNotExists: true,
  });
};

exports.down = async (pgm) => {
  pgm.dropIndex('gift_transactions', 'payment_hash', {
    name: 'idx_gift_transactions_payment_hash',
    ifExists: true,
  });

  pgm.dropColumns('gift_transactions', ['bolt11_invoice', 'payment_hash', 'note', 'expires_at'], {
    ifExists: true,
  });

  pgm.dropColumns('users', ['email_otp', 'email_otp_expires', 'lightning_address'], {
    ifExists: true,
  });
};
