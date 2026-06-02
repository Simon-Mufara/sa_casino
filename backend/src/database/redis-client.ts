import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../shared/utils/logger';

/**
 * Redis Client Manager
 * Handles caching, session storage, and real-time data
 */
class RedisClient {
  private static client: RedisClientType | null = null;

  /**
   * Connect to Redis
   */
  static async connect(): Promise<void> {
    if (this.client) {
      logger.warn('Redis client already exists');
      return;
    }

    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    await this.client.connect();
  }

  /**
   * Get a value from Redis
   */
  static async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    return await this.client.get(key);
  }

  /**
   * Set a value in Redis
   */
  static async set(
    key: string,
    value: string,
    expirySeconds?: number
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    if (expirySeconds) {
      await this.client.setEx(key, expirySeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Delete a key from Redis
   */
  static async del(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    await this.client.del(key);
  }

  /**
   * Check if a key exists
   */
  static async exists(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiry on a key
   */
  static async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    await this.client.expire(key, seconds);
  }

  /**
   * Get object from Redis (auto JSON parse)
   */
  static async getObject<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set object in Redis (auto JSON stringify)
   */
  static async setObject(
    key: string,
    value: any,
    expirySeconds?: number
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), expirySeconds);
  }

  /**
   * Increment a value
   */
  static async incr(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    return await this.client.incr(key);
  }

  /**
   * Disconnect from Redis
   */
  static async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis client disconnected');
    }
  }
}

export { RedisClient };
