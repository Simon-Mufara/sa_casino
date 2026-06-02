import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../shared/utils/logger';

/**
 * PostgreSQL Database Connection Manager
 * Handles connection pooling and query execution
 */
class DatabaseConnection {
  private static pool: Pool | null = null;

  /**
   * Initialize database connection pool
   */
  static async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database pool already exists');
      return;
    }

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection pool established');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * Execute a query
   */
  static async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      logger.error('Query:', text);
      logger.error('Params:', params);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  static async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    return await this.pool.connect();
  }

  /**
   * Execute queries in a transaction
   */
  static async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all database connections
   */
  static async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL connection pool closed');
    }
  }

  /**
   * Get pool stats for monitoring
   */
  static getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

export { DatabaseConnection };
