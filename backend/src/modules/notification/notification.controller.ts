import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { AppError } from '../../shared/errors/app-error';

/**
 * Notification Controller
 */
export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * GET /api/notifications
   * Get user notifications
   */
  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const result = await this.notificationService.getUserNotifications(userId, page, pageSize);

      res.json({
        success: true,
        data: result.notifications,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/notifications/unread
   * Get unread notifications
   */
  getUnreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const notifications = await this.notificationService.getUnreadNotifications(userId);

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/notifications/unread/count
   * Get unread notification count
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const count = await this.notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/notifications/:id
   * Delete notification
   */
  deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.notificationService.deleteNotification(id, userId);

      res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  };
}
