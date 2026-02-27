import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:6Kp7_7VsEuD,/ET@db.soywnjuyltvoxykmohle.supabase.co:5432/postgres';

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize tables if they don't exist
export async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_results (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) NOT NULL,
        imposter_id VARCHAR(50) NOT NULL,
        imposter_name VARCHAR(100) NOT NULL,
        imposter_won BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}
