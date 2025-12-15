import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * DATABASE CONNECTION MODULE
 *
 * Purpose: Provides secure database connection with pooling, error handling, and query helpers.
 *
 * Security Features:
 * - Connection pooling to prevent resource exhaustion
 * - Parameterized queries to prevent SQL injection
 * - Error handling and logging
 * - Slow query detection
 * - Transaction support
 *
 * IMPORTANT: ALWAYS use parameterized queries ($1, $2, etc.) - NEVER concatenate user input into SQL
 */

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'reconx_dev',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout after 2 seconds if no connection available
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Connection event handlers
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit process - let the application handle the error
});

/**
 * Execute a parameterized query on the database
 *
 * SECURITY: Always use parameterized queries to prevent SQL injection
 *
 * @param text SQL query string with $1, $2, etc. placeholders
 * @param params Query parameters (values for $1, $2, etc.)
 * @returns Query result
 *
 * @example
 * // GOOD - Parameterized query (SAFE)
 * await query('SELECT * FROM invoices WHERE invoice_number = $1', ['INV001']);
 *
 * // BAD - String concatenation (VULNERABLE TO SQL INJECTION)
 * await query(`SELECT * FROM invoices WHERE invoice_number = '${userInput}'`);
 */
export const query = async <T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();

  try {
    // Execute query with parameters
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      console.warn(`⚠️  Slow query detected (${duration}ms):`, {
        query: text.substring(0, 100),
        duration,
      });
    }

    return result;
  } catch (error: any) {
    console.error('❌ Database query error:', {
      message: error.message,
      query: text.substring(0, 100),
      code: error.code,
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 *
 * IMPORTANT: Always release the client after use!
 *
 * @returns Database client
 *
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('UPDATE invoices SET amount = $1 WHERE id = $2', [100, id]);
 *   await client.query('COMMIT');
 * } catch (error) {
 *   await client.query('ROLLBACK');
 *   throw error;
 * } finally {
 *   client.release();
 * }
 */
export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

/**
 * Execute a transaction with automatic commit/rollback
 *
 * @param callback Transaction callback function
 * @returns Result from callback
 *
 * @example
 * await transaction(async (client) => {
 *   await client.query('UPDATE invoices SET status = $1 WHERE id = $2', ['paid', id]);
 *   await client.query('INSERT INTO audit_log ...', [...]);
 * });
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Insert a single record and return the inserted row
 *
 * @param table Table name
 * @param data Object with column names as keys
 * @returns Inserted row
 *
 * @example
 * const invoice = await insert('invoices', {
 *   invoice_number: 'INV001',
 *   amount: 150.00,
 *   patient_name: 'John Smith'
 * });
 */
export const insert = async <T = any>(
  table: string,
  data: Record<string, any>
): Promise<T> => {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const text = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await query<T>(text, values);
  return result.rows[0];
};

/**
 * Update records and return updated rows
 *
 * @param table Table name
 * @param data Object with column names as keys
 * @param where WHERE clause object
 * @returns Updated rows
 *
 * @example
 * const updated = await update(
 *   'invoices',
 *   { status: 'paid', outstanding_amount: 0 },
 *   { id: invoiceId }
 * );
 */
export const update = async <T = any>(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>
): Promise<T[]> => {
  const dataEntries = Object.entries(data);
  const whereEntries = Object.entries(where);

  const setClause = dataEntries
    .map(([key], i) => `${key} = $${i + 1}`)
    .join(', ');

  const whereClause = whereEntries
    .map(([key], i) => `${key} = $${dataEntries.length + i + 1}`)
    .join(' AND ');

  const values = [...dataEntries.map(([, value]) => value), ...whereEntries.map(([, value]) => value)];

  const text = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
    RETURNING *
  `;

  const result = await query<T>(text, values);
  return result.rows;
};

/**
 * Find records by criteria
 *
 * @param table Table name
 * @param where WHERE clause object (optional)
 * @param options Query options (limit, offset, orderBy)
 * @returns Matching rows
 *
 * @example
 * const unpaidInvoices = await findBy('invoices', { status: 'unpaid' });
 * const recentPayments = await findBy('payments', {}, { orderBy: 'payment_date DESC', limit: 10 });
 */
export const findBy = async <T = any>(
  table: string,
  where?: Record<string, any>,
  options?: { limit?: number; offset?: number; orderBy?: string }
): Promise<T[]> => {
  let text = `SELECT * FROM ${table}`;
  const values: any[] = [];

  if (where && Object.keys(where).length > 0) {
    const whereEntries = Object.entries(where);
    const whereClause = whereEntries
      .map(([key], i) => `${key} = $${i + 1}`)
      .join(' AND ');
    text += ` WHERE ${whereClause}`;
    values.push(...whereEntries.map(([, value]) => value));
  }

  if (options?.orderBy) {
    text += ` ORDER BY ${options.orderBy}`;
  }

  if (options?.limit) {
    text += ` LIMIT ${options.limit}`;
  }

  if (options?.offset) {
    text += ` OFFSET ${options.offset}`;
  }

  const result = await query<T>(text, values);
  return result.rows;
};

/**
 * Find a single record by criteria
 *
 * @param table Table name
 * @param where WHERE clause object
 * @returns Single row or null
 *
 * @example
 * const invoice = await findOne('invoices', { invoice_number: 'INV001' });
 */
export const findOne = async <T = any>(
  table: string,
  where: Record<string, any>
): Promise<T | null> => {
  const rows = await findBy<T>(table, where, { limit: 1 });
  return rows[0] || null;
};

/**
 * Delete records by criteria
 *
 * @param table Table name
 * @param where WHERE clause object
 * @returns Deleted rows
 *
 * @example
 * await deleteBy('matches', { status: 'rejected' });
 */
export const deleteBy = async <T = any>(
  table: string,
  where: Record<string, any>
): Promise<T[]> => {
  const whereEntries = Object.entries(where);
  const whereClause = whereEntries
    .map(([key], i) => `${key} = $${i + 1}`)
    .join(' AND ');

  const values = whereEntries.map(([, value]) => value);

  const text = `
    DELETE FROM ${table}
    WHERE ${whereClause}
    RETURNING *
  `;

  const result = await query<T>(text, values);
  return result.rows;
};

/**
 * Count records by criteria
 *
 * @param table Table name
 * @param where WHERE clause object (optional)
 * @returns Count
 *
 * @example
 * const unpaidCount = await count('invoices', { status: 'unpaid' });
 */
export const count = async (
  table: string,
  where?: Record<string, any>
): Promise<number> => {
  let text = `SELECT COUNT(*) FROM ${table}`;
  const values: any[] = [];

  if (where && Object.keys(where).length > 0) {
    const whereEntries = Object.entries(where);
    const whereClause = whereEntries
      .map(([key], i) => `${key} = $${i + 1}`)
      .join(' AND ');
    text += ` WHERE ${whereClause}`;
    values.push(...whereEntries.map(([, value]) => value));
  }

  const result = await query<{ count: string }>(text, values);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Check if pool is healthy
 *
 * @returns true if database is accessible, false otherwise
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
};

/**
 * Close all database connections
 *
 * IMPORTANT: Call this when shutting down the application
 */
export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('🔌 Database connection pool closed');
};

/**
 * Get connection pool statistics
 *
 * @returns Pool statistics
 */
export const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
};

export default pool;
