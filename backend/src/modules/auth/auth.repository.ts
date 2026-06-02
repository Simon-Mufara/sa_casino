import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnection } from '../../../database/connection';

/**
 * User Entity Interface
 */
export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  avatarUrl?: string;
  countryCode: string;
  preferredLanguage: string;
  isPremium: boolean;
  premiumExpiresAt?: Date;
  accountStatus: 'active' | 'suspended' | 'banned' | 'deleted';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auth Session Entity Interface
 */
export interface AuthSession {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo?: any;
  ipAddress?: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

/**
 * Auth Repository
 * Handles database operations for authentication
 */
export class AuthRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Create a new user
   */
  async createUser(data: {
    username: string;
    email: string;
    passwordHash: string;
    countryCode: string;
    preferredLanguage: string;
  }): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash, country_code, preferred_language)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id, username, email, email_verified, password_hash, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
    `;

    const result = await DatabaseConnection.query(query, [
      data.username,
      data.email,
      data.passwordHash,
      data.countryCode,
      data.preferredLanguage,
    ]);

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT
        id, username, email, email_verified, password_hash, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await DatabaseConnection.query(query, [email]);
    return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT
        id, username, email, email_verified, password_hash, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
      FROM users
      WHERE username = $1
    `;

    const result = await DatabaseConnection.query(query, [username]);
    return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT
        id, username, email, email_verified, password_hash, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await DatabaseConnection.query(query, [id]);
    return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await DatabaseConnection.query(query, [userId]);
  }

  /**
   * Mark email as verified
   */
  async verifyEmail(userId: string): Promise<void> {
    const query = `
      UPDATE users
      SET email_verified = true
      WHERE id = $1
    `;

    await DatabaseConnection.query(query, [userId]);
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `;

    await DatabaseConnection.query(query, [passwordHash, userId]);
  }

  /**
   * Create auth session
   */
  async createSession(data: {
    userId: string;
    refreshToken: string;
    deviceInfo?: any;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<AuthSession> {
    const query = `
      INSERT INTO auth_sessions (user_id, refresh_token, device_info, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, refresh_token, device_info, ip_address, expires_at, revoked, created_at
    `;

    const result = await DatabaseConnection.query(query, [
      data.userId,
      data.refreshToken,
      data.deviceInfo ? JSON.stringify(data.deviceInfo) : null,
      data.ipAddress,
      data.expiresAt,
    ]);

    return this.mapSessionRow(result.rows[0]);
  }

  /**
   * Find session by refresh token
   */
  async findSessionByToken(refreshToken: string): Promise<AuthSession | null> {
    const query = `
      SELECT id, user_id, refresh_token, device_info, ip_address, expires_at, revoked, created_at
      FROM auth_sessions
      WHERE refresh_token = $1 AND NOT revoked
    `;

    const result = await DatabaseConnection.query(query, [refreshToken]);
    return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const query = `
      UPDATE auth_sessions
      SET revoked = true
      WHERE id = $1
    `;

    await DatabaseConnection.query(query, [sessionId]);
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const query = `
      UPDATE auth_sessions
      SET revoked = true
      WHERE user_id = $1 AND NOT revoked
    `;

    await DatabaseConnection.query(query, [userId]);
  }

  /**
   * Delete expired sessions
   */
  async deleteExpiredSessions(): Promise<void> {
    const query = `
      DELETE FROM auth_sessions
      WHERE expires_at < CURRENT_TIMESTAMP OR revoked = true
    `;

    await DatabaseConnection.query(query);
  }

  /**
   * Map database row to User entity
   */
  private mapUserRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      emailVerified: row.email_verified,
      passwordHash: row.password_hash,
      phoneNumber: row.phone_number,
      phoneVerified: row.phone_verified,
      avatarUrl: row.avatar_url,
      countryCode: row.country_code,
      preferredLanguage: row.preferred_language,
      isPremium: row.is_premium,
      premiumExpiresAt: row.premium_expires_at,
      accountStatus: row.account_status,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to AuthSession entity
   */
  private mapSessionRow(row: any): AuthSession {
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      expiresAt: row.expires_at,
      revoked: row.revoked,
      createdAt: row.created_at,
    };
  }
}
