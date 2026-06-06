const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../src/config/database');

const createTestUser = async ({ email, password = 'Test1234!', name = 'Test User' } = {}) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, email, name, password_hash, role, status, email_verified, created_at)
     VALUES ($1, $2, $3, $4, 'user', 'active', true, NOW())`,
    [userId, email, name, passwordHash]
  );

  // Create default health profile so cycle endpoints don't 500
  await pool.query(
    `INSERT INTO health_profiles (user_id, average_cycle_length, average_period_length, created_at)
     VALUES ($1, 28, 5, NOW()) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const accessToken = jwt.sign(
    { userId, email, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '15m', issuer: 'satsflow-api', audience: 'satsflow-mobile-app' }
  );

  return { userId, accessToken, email, password };
};

const cleanupUser = async (email) => {
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
};

const cleanupTestUsers = async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@satsflo.test'");
};

module.exports = { createTestUser, cleanupUser, cleanupTestUsers, pool };
