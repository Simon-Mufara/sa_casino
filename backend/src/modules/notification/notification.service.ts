import { NotificationRepository, Notification, NotificationType } from './notification.repository';

/**
 * Notification Service
 */
export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * Create and send notification
   */
  async sendNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): Promise<Notification> {
    return this.notificationRepository.create(data);
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ notifications: Notification[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const notifications = await this.notificationRepository.getUserNotifications(
      userId,
      pageSize,
      offset
    );

    return {
      notifications,
      total: notifications.length,
    };
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepository.getUnreadNotifications(userId);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.delete(notificationId, userId);
  }
}
