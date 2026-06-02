import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';
import matchRoutes from '../modules/match/match.routes';
import socialRoutes from '../modules/social/social.routes';
import notificationRoutes from '../modules/notification/notification.routes';

const router = Router();

/**
 * API Routes
 * Base path: /api
 */

// Authentication routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

// Match routes
router.use('/matches', matchRoutes);

// Social routes
router.use('/social', socialRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
