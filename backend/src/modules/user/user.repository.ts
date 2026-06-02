import { Pool } from 'pg';
import { DatabaseConnection } from '../../database/connection';

/**
 * User Profile Update Data
 */
export interface UpdateUserProfile {
  username?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  preferredLanguage?: string;
}

/**
 * User Statistics Interface
 */
export interface UserStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  totalPoints: number;
  averagePoints: number;
  longestWinStreak: number;
  currentWinStreak: number;
  rank: number;
  tier: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Repository
 * Handles database operations for user management
 */
export class UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<any | null> {
    const query = `
      SELECT
        id, username, email, email_verified, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1 AND account_status != 'deleted'
    `;

    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      phoneNumber: user.phone_number,
      phoneVerified: user.phone_verified,
      avatarUrl: user.avatar_url,
      countryCode: user.country_code,
      preferredLanguage: user.preferred_language,
      isPremium: user.is_premium,
      premiumExpiresAt: user.premium_expires_at,
      accountStatus: user.account_status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<any | null> {
    const query = `
      SELECT
        id, username, email, email_verified, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
      FROM users
      WHERE username = $1 AND account_status != 'deleted'
    `;

    const result = await this.pool.query(query, [username]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      phoneNumber: user.phone_number,
      phoneVerified: user.phone_verified,
      avatarUrl: user.avatar_url,
      countryCode: user.country_code,
      preferredLanguage: user.preferred_language,
      isPremium: user.is_premium,
      premiumExpiresAt: user.premium_expires_at,
      accountStatus: user.account_status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateUserProfile): Promise<any | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }

    if (data.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(data.phoneNumber);
    }

    if (data.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatarUrl);
    }

    if (data.preferredLanguage !== undefined) {
      updates.push(`preferred_language = $${paramIndex++}`);
      values.push(data.preferredLanguage);
    }

    if (updates.length === 0) {
      return this.findById(userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_status != 'deleted'
      RETURNING
        id, username, email, email_verified, phone_number, phone_verified,
        avatar_url, country_code, preferred_language, is_premium, premium_expires_at,
        account_status, last_login_at, created_at, updated_at
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      phoneNumber: user.phone_number,
      phoneVerified: user.phone_verified,
      avatarUrl: user.avatar_url,
      countryCode: user.country_code,
      preferredLanguage: user.preferred_language,
      isPremium: user.is_premium,
      premiumExpiresAt: user.premium_expires_at,
      accountStatus: user.account_status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats | null> {
    const query = `
      SELECT
        user_id, games_played, games_won, games_lost, win_rate,
        total_points, average_points, longest_win_streak, current_win_streak,
        rank, tier, created_at, updated_at
      FROM user_stats
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const stats = result.rows[0];
    return {
      userId: stats.user_id,
      gamesPlayed: stats.games_played,
      gamesWon: stats.games_won,
      gamesLost: stats.games_lost,
      winRate: parseFloat(stats.win_rate),
      totalPoints: stats.total_points,
      averagePoints: parseFloat(stats.average_points),
      longestWinStreak: stats.longest_win_streak,
      currentWinStreak: stats.current_win_streak,
      rank: stats.rank,
      tier: stats.tier,
      createdAt: stats.created_at,
      updatedAt: stats.updated_at,
    };
  }

  /**
   * Search users by username (for friends, etc.)
   */
  async searchUsers(searchTerm: string, limit: number = 20): Promise<any[]> {
    const query = `
      SELECT
        id, username, avatar_url, is_premium, account_status
      FROM users
      WHERE
        username ILIKE $1
        AND account_status = 'active'
      ORDER BY username
      LIMIT $2
    `;

    const result = await this.pool.query(query, [`%${searchTerm}%`, limit]);

    return result.rows.map(user => ({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      isPremium: user.is_premium,
    }));
  }

  /**
   * Get leaderboard (top players by rank)
   */
  async getLeaderboard(limit: number = 100, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT
        u.id, u.username, u.avatar_url, u.is_premium,
        us.games_played, us.games_won, us.win_rate, us.total_points, us.rank, us.tier
      FROM users u
      INNER JOIN user_stats us ON u.id = us.user_id
      WHERE u.account_status = 'active'
      ORDER BY us.rank ASC, us.total_points DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);

    return result.rows.map(row => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url,
      isPremium: row.is_premium,
      stats: {
        gamesPlayed: row.games_played,
        gamesWon: row.games_won,
        winRate: parseFloat(row.win_rate),
        totalPoints: row.total_points,
        rank: row.rank,
        tier: row.tier,
      },
    }));
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [userId]);
  }

  /**
   * Soft delete user account
   */
  async deleteAccount(userId: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET account_status = 'deleted', updated_at = NOW()
      WHERE id = $1 AND account_status != 'deleted'
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
