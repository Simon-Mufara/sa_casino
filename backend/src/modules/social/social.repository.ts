import { Pool } from 'pg';
import { DatabaseConnection } from '../../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Friend Request Status
 */
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Friend Interface
 */
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  createdAt: Date;
}

/**
 * Friend Request Interface
 */
export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Social Repository
 * Handles database operations for social features (friends)
 */
export class SocialRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    const query = `
      INSERT INTO friend_requests (sender_id, receiver_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `;

    const result = await this.pool.query(query, [senderId, receiverId]);
    return this.mapFriendRequestRow(result.rows[0]);
  }

  /**
   * Get friend request by ID
   */
  async getFriendRequest(requestId: string): Promise<FriendRequest | null> {
    const query = `SELECT * FROM friend_requests WHERE id = $1`;
    const result = await this.pool.query(query, [requestId]);
    return result.rows[0] ? this.mapFriendRequestRow(result.rows[0]) : null;
  }

  /**
   * Check if friend request exists
   */
  async findPendingRequest(senderId: string, receiverId: string): Promise<FriendRequest | null> {
    const query = `
      SELECT * FROM friend_requests
      WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
      LIMIT 1
    `;

    const result = await this.pool.query(query, [senderId, receiverId]);
    return result.rows[0] ? this.mapFriendRequestRow(result.rows[0]) : null;
  }

  /**
   * Get pending friend requests for a user
   */
  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    const query = `
      SELECT * FROM friend_requests
      WHERE receiver_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => this.mapFriendRequestRow(row));
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    const query = `
      SELECT * FROM friend_requests
      WHERE sender_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => this.mapFriendRequestRow(row));
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    const query = `
      UPDATE friend_requests
      SET status = 'accepted', updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [requestId]);
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    const query = `
      UPDATE friend_requests
      SET status = 'rejected', updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [requestId]);
  }

  /**
   * Add friendship (both ways for easier querying)
   */
  async createFriendship(userId: string, friendId: string): Promise<void> {
    const query = `
      INSERT INTO user_friends (user_id, friend_id)
      VALUES ($1, $2), ($2, $1)
    `;

    await this.pool.query(query, [userId, friendId]);
  }

  /**
   * Remove friendship (both ways)
   */
  async removeFriendship(userId: string, friendId: string): Promise<void> {
    const query = `
      DELETE FROM user_friends
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
    `;

    await this.pool.query(query, [userId, friendId]);
  }

  /**
   * Check if users are friends
   */
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM user_friends
      WHERE user_id = $1 AND friend_id = $2
    `;

    const result = await this.pool.query(query, [userId, friendId]);
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get user's friends
   */
  async getFriends(userId: string): Promise<any[]> {
    const query = `
      SELECT u.id, u.username, u.avatar_url, u.is_premium, uf.created_at as friend_since
      FROM user_friends uf
      INNER JOIN users u ON uf.friend_id = u.id
      WHERE uf.user_id = $1 AND u.account_status = 'active'
      ORDER BY uf.created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url,
      isPremium: row.is_premium,
      friendSince: row.friend_since,
    }));
  }

  /**
   * Get friend count
   */
  async getFriendCount(userId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM user_friends WHERE user_id = $1`;
    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Map database row to FriendRequest
   */
  private mapFriendRequestRow(row: any): FriendRequest {
    return {
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
