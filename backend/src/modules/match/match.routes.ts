import { Router } from 'express';
import { MatchController } from './match.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const matchController = new MatchController();

// All match routes require authentication
router.post('/', authMiddleware, matchController.createMatch);
router.get('/', matchController.listMatches); // Can be public for lobby viewing
router.get('/:id', matchController.getMatch);
router.post('/:id/join', authMiddleware, matchController.joinMatch);
router.post('/:id/leave', authMiddleware, matchController.leaveMatch);

export default router;
