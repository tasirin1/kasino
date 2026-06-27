/**
 * Database migration script.
 * Creates all tables. Requires DATABASE_URL and pg module.
 * Usage: DATABASE_URL=postgresql://... node scripts/migrate.js
 */

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set. Skipping migration (using JSON storage).');
    process.exit(0);
  }

  try {
    const db = require('../server/services/db-storage');
    await db.migrate();
    console.log('Migration complete! All tables created.');
    await db.disconnect();
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && e.message.includes('pg')) {
      console.error('pg module not found. Install with: npm install pg');
    } else {
      console.error('Migration failed:', e.message);
    }
    process.exit(1);
  }
}

main();
