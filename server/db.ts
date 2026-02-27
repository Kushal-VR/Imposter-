import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

let poolInstance: Pool | null = null;

if (connectionString && connectionString.startsWith('postgres')) {
  poolInstance = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.warn('DATABASE_URL is not set or invalid. Database features will be disabled.');
}

export const pool = poolInstance;

export async function query(text: string, params?: any[]) {
  if (!poolInstance) {
    console.warn('Database query skipped (no valid connection):', text);
    return null;
  }
  return poolInstance.query(text, params);
}

// Initialize tables if they don't exist
export async function initDb() {
  if (!poolInstance) return;
  
  try {
    await poolInstance.query(`
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
