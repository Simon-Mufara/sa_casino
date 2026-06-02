import { Router } from 'express';
import { SocialController } from './social.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const socialController = new SocialController();

// All social routes require authentication
router.use(authMiddleware);

// Friends management
router.get('/friends', socialController.getFriends);
router.delete('/friends/:friendId', socialController.removeFriend);

// Friend requests
router.post('/friends/request', socialController.sendFriendRequest);
router.get('/friends/requests/pending', socialController.getPendingRequests);
router.get('/friends/requests/sent', socialController.getSentRequests);
router.post('/friends/requests/:id/accept', socialController.acceptFriendRequest);
router.post('/friends/requests/:id/reject', socialController.rejectFriendRequest);
router.delete('/friends/requests/:id', socialController.cancelFriendRequest);

export default router;
