import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';

const router = Router();

/**
 * API Routes
 * Base path: /api
 */

// Authentication routes
router.use('/auth', authRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
