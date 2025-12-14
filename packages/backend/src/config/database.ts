import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'reconx_dev',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

/**
 * Execute a query on the database
 * @param text SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      console.warn(`⚠️  Slow query detected (${duration}ms):`, text);
    }

    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns Database client
 */
export const getClient = async () => {
  return await pool.connect();
};

/**
 * Close all database connections
 */
export const closePool = async () => {
  await pool.end();
  console.log('🔌 Database connection pool closed');
};

export default pool;
