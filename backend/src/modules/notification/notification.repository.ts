import { Pool } from 'pg';
import { DatabaseConnection } from '../../database/connection';

/**
 * Notification Type
 */
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'match_invite'
  | 'match_started'
  | 'tournament_starting'
  | 'achievement_unlocked'
  | 'payment_success'
  | 'system';

/**
 * Notification Interface
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Notification Repository
 */
export class NotificationRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Create notification
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): Promise<Notification> {
    const query = `
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      data.userId,
      data.type,
      data.title,
      data.message,
      data.data ? JSON.stringify(data.data) : null,
    ]);

    return this.mapNotificationRow(result.rows[0]);
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows.map(row => this.mapNotificationRow(row));
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1 AND is_read = false
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => this.mapNotificationRow(row));
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = $1 AND is_read = false
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const query = `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [notificationId, userId]);
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1 AND is_read = false
    `;

    await this.pool.query(query, [userId]);
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [notificationId, userId]);
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `;

    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Map database row to Notification
   */
  private mapNotificationRow(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }
}
