/**
 * Database Seeder
 *
 * Seeds the database with initial data for development/testing
 * Run with: npm run seed
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');

const SALT_ROUNDS = 12;

async function seedUsers() {
  console.log('Seeding users...');

  const users = [
    {
      email: 'admin@satsflow.com',
      password: 'Admin123!',
      name: 'Admin User',
      role: 'admin',
      email_verified: true,
    },
    {
      email: 'test@satsflow.com',
      password: 'Test123!',
      name: 'Test User',
      role: 'user',
      email_verified: true,
    },
    {
      email: 'demo@satsflow.com',
      password: 'Demo123!',
      name: 'Demo User',
      role: 'user',
      email_verified: true,
    },
  ];

  const createdUsers = [];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    try {
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         ON CONFLICT (email) DO UPDATE SET
           password_hash  = EXCLUDED.password_hash,
           name           = EXCLUDED.name,
           role           = EXCLUDED.role,
           email_verified = EXCLUDED.email_verified
         RETURNING id, email, name, role`,
        [user.email, passwordHash, user.name, user.role, user.email_verified]
      );
      console.log(`  Created user: ${result.rows[0].email} (${result.rows[0].role})`);
      createdUsers.push(result.rows[0]);
    } catch (err) {
      console.error(`Failed to create user ${user.email}:`, err.message);
    }
  }

  return createdUsers;
}

async function seedHealthProfiles(users) {
  console.log('Seeding health profiles...');

  for (const user of users) {
    try {
      await pool.query(
        `INSERT INTO health_profiles (user_id, average_cycle_length, average_period_length, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [
          user.id,
          Math.floor(Math.random() * 7) + 26, // 26-32
          Math.floor(Math.random() * 3) + 4, // 4-6
        ]
      );
      console.log(`  Created health profile for: ${user.email}`);
    } catch (err) {
      console.error(`Failed to create health profile for ${user.email}:`, err.message);
    }
  }
}

async function seedCycles(users) {
  console.log('Seeding cycles...');

  const testUser = users.find((u) => u.email === 'test@satsflow.com');
  if (!testUser) return;

  const today = new Date();
  const cycles = [];

  for (let i = 5; i >= 0; i--) {
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - i);
    startDate.setDate(1 + Math.floor(Math.random() * 5));

    const periodLength = Math.floor(Math.random() * 3) + 4;
    const periodEndDate = new Date(startDate);
    periodEndDate.setDate(periodEndDate.getDate() + periodLength - 1);

    cycles.push({
      user_id: testUser.id,
      start_date: startDate.toISOString().split('T')[0],
      period_end_date: periodEndDate.toISOString().split('T')[0],
      period_length: periodLength,
    });
  }

  // Fill in cycle lengths and end dates
  for (let i = 0; i < cycles.length - 1; i++) {
    const endDate = new Date(cycles[i + 1].start_date);
    endDate.setDate(endDate.getDate() - 1);
    cycles[i].end_date = endDate.toISOString().split('T')[0];
    cycles[i].cycle_length = Math.ceil(
      (new Date(cycles[i + 1].start_date) - new Date(cycles[i].start_date)) / (1000 * 60 * 60 * 24)
    );
  }

  for (const cycle of cycles) {
    try {
      const keys = Object.keys(cycle);
      const values = Object.values(cycle);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      await pool.query(
        `INSERT INTO cycles (${keys.join(', ')}, created_at) VALUES (${placeholders}, NOW())`,
        values
      );
      console.log(`  Created cycle starting: ${cycle.start_date}`);
    } catch (err) {
      console.error('Failed to create cycle:', err.message);
    }
  }
}

async function seedSymptoms(users) {
  console.log('Seeding symptoms...');

  const testUser = users.find((u) => u.email === 'test@satsflow.com');
  if (!testUser) return;

  const symptoms = [
    { symptom: 'cramps', category: 'pain', severity: 2 },
    { symptom: 'headache', category: 'pain', severity: 1 },
    { symptom: 'bloating', category: 'physical', severity: 2 },
    { symptom: 'fatigue', category: 'physical', severity: 2 },
    { symptom: 'acne', category: 'skin', severity: 1 },
  ];

  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const numSymptoms = Math.floor(Math.random() * 3) + 1;
    const daySymptoms = [...symptoms].sort(() => Math.random() - 0.5).slice(0, numSymptoms);

    for (const s of daySymptoms) {
      try {
        await pool.query(
          `INSERT INTO symptoms (user_id, date, symptom, category, severity, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT DO NOTHING`,
          [testUser.id, dateStr, s.symptom, s.category, s.severity]
        );
      } catch (err) {
        if (!err.message.includes('duplicate')) {
          console.error('Failed to create symptom:', err.message);
        }
      }
    }
  }

  console.log('  Created symptoms for past 14 days');
}

async function seedMoods(users) {
  console.log('Seeding moods...');

  const testUser = users.find((u) => u.email === 'test@satsflow.com');
  if (!testUser) return;

  const moods = ['happy', 'calm', 'energetic', 'tired', 'irritable', 'anxious'];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const mood = moods[Math.floor(Math.random() * moods.length)];
    const intensity = Math.floor(Math.random() * 3) + 2;

    try {
      await pool.query(
        `INSERT INTO moods (user_id, date, mood, intensity, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [testUser.id, dateStr, mood, intensity]
      );
    } catch (err) {
      if (!err.message.includes('duplicate')) {
        console.error('Failed to create mood:', err.message);
      }
    }
  }

  console.log('  Created moods for past 14 days');
}

async function seedForums(users) {
  console.log('Seeding forums...');

  const adminUser = users.find((u) => u.role === 'admin');

  const forums = [
    { name: 'General Discussion', slug: 'general', description: 'General chat and discussions' },
    { name: 'Health Tips', slug: 'health-tips', description: 'Share and discover health tips' },
    { name: 'Support Circle', slug: 'support', description: 'Support and encouragement' },
    {
      name: 'Bitcoin & Rewards',
      slug: 'bitcoin',
      description: 'Discuss Bitcoin rewards and Lightning',
    },
  ];

  for (const forum of forums) {
    try {
      await pool.query(
        `INSERT INTO forums (name, slug, description, created_by, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [forum.name, forum.slug, forum.description, adminUser?.id]
      );
      console.log(`  Created forum: ${forum.name}`);
    } catch (err) {
      console.error(`Failed to create forum ${forum.name}:`, err.message);
    }
  }
}

async function seed() {
  console.log('\n========================================');
  console.log('  SATSFLOW DATABASE SEEDER');
  console.log('========================================\n');

  try {
    const users = await seedUsers();
    await seedHealthProfiles(users);
    await seedCycles(users);
    await seedSymptoms(users);
    await seedMoods(users);
    await seedForums(users);

    console.log('\n========================================');
    console.log('  SEEDING COMPLETE!');
    console.log('========================================');
    console.log('\nTest Accounts:');
    console.log('  Admin: admin@satsflow.com / Admin123!');
    console.log('  User:  test@satsflow.com  / Test123!');
    console.log('  Demo:  demo@satsflow.com  / Demo123!');
    console.log('\n');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();
