import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
