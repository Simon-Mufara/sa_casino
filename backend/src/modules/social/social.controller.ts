import { Request, Response, NextFunction } from 'express';
import { SocialService } from './social.service';
import { AppError } from '../../shared/errors/app-error';

/**
 * Social Controller
 * HTTP request handlers for social features
 */
export class SocialController {
  private socialService: SocialService;

  constructor() {
    this.socialService = new SocialService();
  }

  /**
   * GET /api/social/friends
   * Get user's friends list
   */
  getFriends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const friends = await this.socialService.getFriends(userId);

      res.json({
        success: true,
        data: friends,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/social/friends/request
   * Send friend request
   */
  sendFriendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { receiverId } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      if (!receiverId) {
        throw new AppError('Receiver ID is required', 400);
      }

      const request = await this.socialService.sendFriendRequest(userId, receiverId);

      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/social/friends/requests/pending
   * Get pending friend requests (received)
   */
  getPendingRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const requests = await this.socialService.getPendingRequests(userId);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/social/friends/requests/sent
   * Get sent friend requests
   */
  getSentRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const requests = await this.socialService.getSentRequests(userId);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/social/friends/requests/:id/accept
   * Accept friend request
   */
  acceptFriendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.socialService.acceptFriendRequest(userId, id);

      res.json({
        success: true,
        message: 'Friend request accepted',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/social/friends/requests/:id/reject
   * Reject friend request
   */
  rejectFriendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.socialService.rejectFriendRequest(userId, id);

      res.json({
        success: true,
        message: 'Friend request rejected',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/social/friends/requests/:id
   * Cancel sent friend request
   */
  cancelFriendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.socialService.cancelFriendRequest(userId, id);

      res.json({
        success: true,
        message: 'Friend request cancelled',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/social/friends/:friendId
   * Remove friend
   */
  removeFriend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { friendId } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.socialService.removeFriend(userId, friendId);

      res.json({
        success: true,
        message: 'Friend removed',
      });
    } catch (error) {
      next(error);
    }
  };
}
