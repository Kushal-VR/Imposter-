import { Pool } from 'pg';

// Private pool instance — use getPool() instead of importing pool directly,
// since initDb() runs asynchronously after module load.
let poolInstance: Pool | null = null;

/**
 * Returns the active pool, or null if the database is not configured.
 * Safe to call before initDb() resolves — callers should check for null.
 */
export function getPool(): Pool | null {
  return poolInstance;
}

export async function query(text: string, params?: any[]) {
  if (!poolInstance) {
    console.warn('Database query skipped (no valid connection):', text);
    return null;
  }
  return poolInstance.query(text, params);
}

/** Initialize the connection pool and create tables if needed. */
export async function initDb() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString && connectionString.startsWith('postgres')) {
    poolInstance = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  } else {
    console.warn(
      'DATABASE_URL is not set or invalid. Database features will be disabled.'
    );
    return;
  }

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
