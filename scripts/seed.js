/**
 * Database seed script — initial data for PostgreSQL.
 * Usage: DATABASE_URL=postgresql://... node scripts/seed.js
 */

const bcrypt = require('bcryptjs');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set. Skipping seed (using JSON storage).');
    process.exit(0);
  }

  const db = require('../server/services/db-storage');
  
  // Ensure tables exist
  await db.migrate();

  // Check if admin already exists
  const existing = await db.findUser('tasirin');
  if (existing) {
    console.log('Admin account already exists. Skipping seed.');
    await db.disconnect();
    process.exit(0);
  }

  console.log('Seeding database...');

  // Create admin account
  const hashed = await bcrypt.hash('255280', 10);
  await db.createUser('tasirin', hashed, 1000000);

  // Promote to admin + set balance
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('UPDATE users SET "isAdmin"=true, balance=$1 WHERE username=$2', [
    BigInt(999999999), 'tasirin'
  ]);
  await pool.end();

  console.log('Admin account created: tasirin / 255280');

  // Seed default config
  await db.updateConfig({
    difficulty: 'medium',
    winRate: 0.15,
    payoutMultiplier: 3.0,
    minSpinsBeforeWin: 10,
    jackpotHitRate: 0.005,
    jackpot: 5000000,
    startingMoney: 10000,
    minBet: 10,
    maxBet: 10000,
    betAmount: 100,
  });

  // Seed default games
  const defaultGames = [
    { id: 'classic777', name: 'Classic 777', category: 'slot', rtp: 97.5, badge: 'HOT', sortOrder: 1 },
    { id: 'luckyfruits', name: 'Lucky Fruits', category: 'slot', rtp: 96.8, badge: 'NEW', sortOrder: 2 },
    { id: 'plinko', name: 'Plinko', category: 'arcade', rtp: 99.1, sortOrder: 3 },
    { id: 'coinflip', name: 'Coin Flip', category: 'arcade', rtp: 98.5, sortOrder: 4 },
    { id: 'diceroll', name: 'Dice Roll', category: 'arcade', rtp: 97.2, sortOrder: 5 },
  ];

  const p2 = new (require('pg')).Pool({ connectionString: process.env.DATABASE_URL });
  for (const g of defaultGames) {
    const {rows} = await p2.query('SELECT id FROM games WHERE id=$1', [g.id]);
    if (!rows.length) {
      await p2.query(
        'INSERT INTO games (id, name, category, rtp, badge, "sortOrder") VALUES ($1,$2,$3,$4,$5,$6)',
        [g.id, g.name, g.category, g.rtp, g.badge, g.sortOrder]
      );
      console.log(`  Created game: ${g.name}`);
    }
  }
  await p2.end();

  console.log('Seed complete!');
  await db.disconnect();
}

main().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
