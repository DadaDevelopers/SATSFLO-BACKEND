exports.up = (pgm) => {
  // Allow Google-only accounts to have no password
  pgm.alterColumn('users', 'password_hash', { notNull: false });

  pgm.addColumns('users', {
    google_id: { type: 'VARCHAR(255)', unique: true },
    auth_provider: { type: 'VARCHAR(20)', default: "'local'", notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['google_id', 'auth_provider']);
  pgm.alterColumn('users', 'password_hash', { notNull: true });
};
