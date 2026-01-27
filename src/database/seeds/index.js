/**
 * Database Seeder
 *
 * Seeds the database with initial data for development/testing
 * Run with: npm run seed
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../../config/database');
const Encryption = require('../../utils/encryption');
const logger = require('../../utils/logger');

const SALT_ROUNDS = 12;

/**
 * Seed users
 */
async function seedUsers() {
  console.log('Seeding users...');

  const users = [
    {
      email: 'admin@satsflow.com',
      password: 'Admin123!',
      name: 'Admin User',
      role: 'admin',
      email_verified: true
    },
    {
      email: 'test@satsflow.com',
      password: 'Test123!',
      name: 'Test User',
      role: 'user',
      email_verified: true
    },
    {
      email: 'demo@satsflow.com',
      password: 'Demo123!',
      name: 'Demo User',
      role: 'user',
      email_verified: true
    }
  ];

  const createdUsers = [];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        email: user.email,
        password_hash: passwordHash,
        name: user.name,
        role: user.role,
        email_verified: user.email_verified,
        status: 'active',
        created_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select('id, email, name, role')
      .single();

    if (error) {
      console.error(`Failed to create user ${user.email}:`, error.message);
    } else {
      console.log(`  Created user: ${data.email} (${data.role})`);
      createdUsers.push(data);
    }
  }

  return createdUsers;
}

/**
 * Seed health profiles
 */
async function seedHealthProfiles(users) {
  console.log('Seeding health profiles...');

  for (const user of users) {
    const { error } = await supabaseAdmin
      .from('health_profiles')
      .upsert({
        user_id: user.id,
        average_cycle_length: Math.floor(Math.random() * 7) + 26, // 26-32
        average_period_length: Math.floor(Math.random() * 3) + 4, // 4-6
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error(`Failed to create health profile for ${user.email}:`, error.message);
    } else {
      console.log(`  Created health profile for: ${user.email}`);
    }
  }
}

/**
 * Seed sample cycles for test user
 */
async function seedCycles(users) {
  console.log('Seeding cycles...');

  const testUser = users.find(u => u.email === 'test@satsflow.com');
  if (!testUser) return;

  // Generate 6 months of cycles
  const today = new Date();
  const cycles = [];

  for (let i = 5; i >= 0; i--) {
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - i);
    startDate.setDate(1 + Math.floor(Math.random() * 5)); // Random start between 1-5

    const periodLength = Math.floor(Math.random() * 3) + 4; // 4-6 days
    const periodEndDate = new Date(startDate);
    periodEndDate.setDate(periodEndDate.getDate() + periodLength - 1);

    cycles.push({
      user_id: testUser.id,
      start_date: startDate.toISOString().split('T')[0],
      period_end_date: periodEndDate.toISOString().split('T')[0],
      period_length: periodLength,
      created_at: new Date().toISOString()
    });
  }

  // Calculate cycle lengths and end dates
  for (let i = 0; i < cycles.length - 1; i++) {
    const endDate = new Date(cycles[i + 1].start_date);
    endDate.setDate(endDate.getDate() - 1);
    cycles[i].end_date = endDate.toISOString().split('T')[0];
    cycles[i].cycle_length = Math.ceil(
      (new Date(cycles[i + 1].start_date) - new Date(cycles[i].start_date)) / (1000 * 60 * 60 * 24)
    );
  }

  for (const cycle of cycles) {
    const { data, error } = await supabaseAdmin
      .from('cycles')
      .insert(cycle)
      .select('id')
      .single();

    if (error) {
      console.error(`Failed to create cycle:`, error.message);
    } else {
      console.log(`  Created cycle starting: ${cycle.start_date}`);
    }
  }
}

/**
 * Seed sample symptoms
 */
async function seedSymptoms(users) {
  console.log('Seeding symptoms...');

  const testUser = users.find(u => u.email === 'test@satsflow.com');
  if (!testUser) return;

  const symptoms = [
    { symptom: 'cramps', category: 'pain', severity: 2 },
    { symptom: 'headache', category: 'pain', severity: 1 },
    { symptom: 'bloating', category: 'physical', severity: 2 },
    { symptom: 'fatigue', category: 'physical', severity: 2 },
    { symptom: 'acne', category: 'skin', severity: 1 }
  ];

  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Random symptoms for the day
    const numSymptoms = Math.floor(Math.random() * 3) + 1;
    const daySymptoms = symptoms
      .sort(() => Math.random() - 0.5)
      .slice(0, numSymptoms);

    for (const s of daySymptoms) {
      const { error } = await supabaseAdmin
        .from('symptoms')
        .insert({
          user_id: testUser.id,
          date: date.toISOString().split('T')[0],
          symptom: s.symptom,
          category: s.category,
          severity: s.severity,
          created_at: new Date().toISOString()
        });

      if (error && !error.message.includes('duplicate')) {
        console.error(`Failed to create symptom:`, error.message);
      }
    }
  }

  console.log('  Created symptoms for past 14 days');
}

/**
 * Seed sample moods
 */
async function seedMoods(users) {
  console.log('Seeding moods...');

  const testUser = users.find(u => u.email === 'test@satsflow.com');
  if (!testUser) return;

  const moods = ['happy', 'calm', 'energetic', 'tired', 'irritable', 'anxious'];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const mood = moods[Math.floor(Math.random() * moods.length)];
    const intensity = Math.floor(Math.random() * 3) + 2; // 2-4

    const { error } = await supabaseAdmin
      .from('moods')
      .insert({
        user_id: testUser.id,
        date: date.toISOString().split('T')[0],
        mood,
        intensity,
        created_at: new Date().toISOString()
      });

    if (error && !error.message.includes('duplicate')) {
      console.error(`Failed to create mood:`, error.message);
    }
  }

  console.log('  Created moods for past 14 days');
}

/**
 * Seed forums
 */
async function seedForums(users) {
  console.log('Seeding forums...');

  const adminUser = users.find(u => u.role === 'admin');

  const forums = [
    { name: 'General Discussion', slug: 'general', description: 'General chat and discussions' },
    { name: 'Health Tips', slug: 'health-tips', description: 'Share and discover health tips' },
    { name: 'Support Circle', slug: 'support', description: 'Support and encouragement' },
    { name: 'Bitcoin & Rewards', slug: 'bitcoin', description: 'Discuss Bitcoin rewards and Lightning' }
  ];

  for (const forum of forums) {
    const { error } = await supabaseAdmin
      .from('forums')
      .upsert({
        ...forum,
        created_by: adminUser?.id,
        created_at: new Date().toISOString()
      }, { onConflict: 'slug' });

    if (error) {
      console.error(`Failed to create forum ${forum.name}:`, error.message);
    } else {
      console.log(`  Created forum: ${forum.name}`);
    }
  }
}

/**
 * Main seed function
 */
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
    console.log('  User:  test@satsflow.com / Test123!');
    console.log('  Demo:  demo@satsflow.com / Demo123!');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seed();
