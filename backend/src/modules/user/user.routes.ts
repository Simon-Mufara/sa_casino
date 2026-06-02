import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Protected routes (require authentication)
router.get('/me', authMiddleware, userController.getMe);
router.put('/me', authMiddleware, userController.updateMe);
router.delete('/me', authMiddleware, userController.deleteMe);

// Public routes
router.get('/search', userController.searchUsers);
router.get('/leaderboard', userController.getLeaderboard);
router.get('/:id', userController.getUserById);
router.get('/:id/stats', userController.getUserStats);
router.get('/username/:username', userController.getUserByUsername);

export default router;
