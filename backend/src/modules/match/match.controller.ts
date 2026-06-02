import { Request, Response, NextFunction } from 'express';
import { MatchService } from './match.service';
import { AppError } from '../../shared/errors/app-error';

/**
 * Match Controller
 * HTTP request handlers for match endpoints
 */
export class MatchController {
  private matchService: MatchService;

  constructor() {
    this.matchService = new MatchService();
  }

  /**
   * POST /api/matches
   * Create a new match
   */
  createMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { matchType, gameMode, scoringMode, isPrivate, aiOpponents, aiDifficulty } = req.body;

      if (!matchType || !gameMode || !scoringMode) {
        throw new AppError('Missing required fields', 400);
      }

      const result = await this.matchService.createMatch({
        matchType,
        gameMode,
        scoringMode,
        creatorId: userId,
        isPrivate,
        aiOpponents,
        aiDifficulty,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/matches
   * List available matches
   */
  listMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, matchType, limit, offset } = req.query;

      const result = await this.matchService.listMatches({
        status: status as any,
        matchType: matchType as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: result.matches,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/matches/:id
   * Get match details
   */
  getMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await this.matchService.getMatch(id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/matches/:id/join
   * Join a match
   */
  joinMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const player = await this.matchService.joinMatch(id, userId);

      res.json({
        success: true,
        data: player,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/matches/:id/leave
   * Leave a match
   */
  leaveMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      await this.matchService.leaveMatch(id, userId);

      res.json({
        success: true,
        message: 'Left match successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
