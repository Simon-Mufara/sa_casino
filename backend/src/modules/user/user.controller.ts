import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { AppError } from '../../shared/errors/app-error';

/**
 * User Controller
 * HTTP request handlers for user endpoints
 */
export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * GET /api/users/me
   * Get current user profile
   */
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const user = await this.userService.getUserById(userId);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/users/me
   * Update current user profile
   */
  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { username, phoneNumber, avatarUrl, preferredLanguage } = req.body;

      const updatedUser = await this.userService.updateProfile(userId, {
        username,
        phoneNumber,
        avatarUrl,
        preferredLanguage,
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/users/me
   * Delete current user account
   */
  deleteMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.userService.deleteAccount(userId);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/users/:id
   * Get user profile by ID
   */
  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userService.getUserById(id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/users/username/:username
   * Get user profile by username
   */
  getUserByUsername = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username } = req.params;

      const user = await this.userService.getUserByUsername(username);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/users/:id/stats
   * Get user statistics
   */
  getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const stats = await this.userService.getUserStats(id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/users/search?q=searchTerm
   * Search users by username
   */
  searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q: searchTerm } = req.query;

      if (!searchTerm || typeof searchTerm !== 'string') {
        throw new AppError('Search term is required', 400);
      }

      const users = await this.userService.searchUsers(searchTerm);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/users/leaderboard
   * Get global leaderboard
   */
  getLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 100;

      const leaderboard = await this.userService.getLeaderboard(page, pageSize);

      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  };
}
