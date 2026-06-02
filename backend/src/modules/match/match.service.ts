import { MatchRepository, Match, MatchStatus } from './match.repository';
import { GameEngineService } from '../game-engine/game-engine.service';
import { AppError } from '../../shared/errors/app-error';
import { Pool } from 'pg';
import { DatabaseConnection } from '../../database/connection';

/**
 * Match Player Interface
 */
export interface MatchPlayer {
  id: string;
  matchId: string;
  userId: string;
  playerPosition: number;
  isAi: boolean;
  aiDifficulty?: string;
  score: number;
  isForfeit: boolean;
  joinedAt: Date;
}

/**
 * Match Service
 * Business logic for match management
 */
export class MatchService {
  private matchRepository: MatchRepository;
  private gameEngineService: GameEngineService;
  private pool: Pool;

  constructor() {
    this.matchRepository = new MatchRepository();
    this.gameEngineService = new GameEngineService();
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Create a new match
   */
  async createMatch(data: {
    matchType: 'casual' | 'ranked' | 'tournament' | 'private';
    gameMode: 'two_player' | 'three_player' | 'four_player' | 'partnership';
    scoringMode: 'eleven_point' | 'seven_point';
    creatorId: string;
    isPrivate?: boolean;
    aiOpponents?: number;
    aiDifficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  }): Promise<{ match: Match; players: MatchPlayer[] }> {
    // Validate game mode
    const numPlayers = this.getNumPlayersFromGameMode(data.gameMode);
    const aiOpponents = data.aiOpponents || 0;

    if (aiOpponents >= numPlayers) {
      throw new AppError('Number of AI opponents must be less than total players', 400);
    }

    // Create match
    const match = await this.matchRepository.createMatch({
      matchType: data.matchType,
      gameMode: data.gameMode,
      dealerId: data.creatorId,
      scoringMode: data.scoringMode,
    });

    // Add creator as first player
    const players: MatchPlayer[] = [];

    const creatorPlayer = await this.addPlayerToMatch(
      match.id,
      data.creatorId,
      0,
      false
    );
    players.push(creatorPlayer);

    // Add AI opponents if specified
    for (let i = 0; i < aiOpponents; i++) {
      const aiPlayer = await this.addPlayerToMatch(
        match.id,
        `ai_${i + 1}`,
        i + 1,
        true,
        data.aiDifficulty || 'medium'
      );
      players.push(aiPlayer);
    }

    // If all slots filled with AI, start match immediately
    if (players.length === numPlayers) {
      await this.startMatch(match.id);
    }

    return { match, players };
  }

  /**
   * Join a match
   */
  async joinMatch(matchId: string, userId: string): Promise<MatchPlayer> {
    const match = await this.matchRepository.findById(matchId);

    if (!match) {
      throw new AppError('Match not found', 404);
    }

    if (match.status !== 'waiting') {
      throw new AppError('Match is not open for joining', 400);
    }

    // Check if user is already in match
    const existingPlayers = await this.getMatchPlayers(matchId);
    if (existingPlayers.some(p => p.userId === userId)) {
      throw new AppError('User already in match', 400);
    }

    // Check if match is full
    const numPlayers = this.getNumPlayersFromGameMode(match.gameMode);
    if (existingPlayers.length >= numPlayers) {
      throw new AppError('Match is full', 400);
    }

    // Add player
    const playerPosition = existingPlayers.length;
    const player = await this.addPlayerToMatch(matchId, userId, playerPosition, false);

    // Start match if full
    if (existingPlayers.length + 1 === numPlayers) {
      await this.startMatch(matchId);
    }

    return player;
  }

  /**
   * Leave a match
   */
  async leaveMatch(matchId: string, userId: string): Promise<void> {
    const match = await this.matchRepository.findById(matchId);

    if (!match) {
      throw new AppError('Match not found', 404);
    }

    if (match.status === 'completed') {
      throw new AppError('Cannot leave a completed match', 400);
    }

    const players = await this.getMatchPlayers(matchId);
    const player = players.find(p => p.userId === userId);

    if (!player) {
      throw new AppError('Player not in match', 404);
    }

    if (match.status === 'waiting') {
      // Remove player if match not started
      await this.removePlayerFromMatch(matchId, userId);
    } else {
      // Mark as forfeit if match in progress
      await this.forfeitPlayer(matchId, userId);

      // Check if match should be abandoned
      const activePlayers = players.filter(p => !p.isForfeit && p.userId !== userId);
      if (activePlayers.length < 2) {
        await this.matchRepository.updateStatus(matchId, 'abandoned');
      }
    }
  }

  /**
   * Get match by ID with players
   */
  async getMatch(matchId: string): Promise<{ match: Match; players: MatchPlayer[] }> {
    const match = await this.matchRepository.findById(matchId);

    if (!match) {
      throw new AppError('Match not found', 404);
    }

    const players = await this.getMatchPlayers(matchId);

    return { match, players };
  }

  /**
   * List matches (lobby)
   */
  async listMatches(filters: {
    status?: MatchStatus;
    matchType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ matches: any[]; total: number }> {
    const { status, matchType, limit = 20, offset = 0 } = filters;

    let query = `
      SELECT m.*, COUNT(mp.id) as player_count
      FROM matches m
      LEFT JOIN match_players mp ON m.id = mp.match_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    if (matchType) {
      query += ` AND m.match_type = $${paramIndex++}`;
      params.push(matchType);
    }

    query += `
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    const matches = result.rows.map(row => ({
      ...this.mapMatchRow(row),
      playerCount: parseInt(row.player_count),
    }));

    return { matches, total: matches.length };
  }

  /**
   * Start a match
   */
  private async startMatch(matchId: string): Promise<void> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new AppError('Match not found', 404);
    }

    // Update match status
    await this.matchRepository.updateStatus(matchId, 'active');

    // Initialize game state
    const players = await this.getMatchPlayers(matchId);
    await this.gameEngineService.initializeGame(
      matchId,
      players.map(p => ({ id: p.userId, isAI: p.isAi })),
      match.dealerId,
      match.scoringMode
    );
  }

  /**
   * Add player to match
   */
  private async addPlayerToMatch(
    matchId: string,
    userId: string,
    position: number,
    isAi: boolean,
    aiDifficulty?: string
  ): Promise<MatchPlayer> {
    const query = `
      INSERT INTO match_players (match_id, user_id, player_position, is_ai, ai_difficulty)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      matchId,
      userId,
      position,
      isAi,
      aiDifficulty || null,
    ]);

    return this.mapPlayerRow(result.rows[0]);
  }

  /**
   * Remove player from match
   */
  private async removePlayerFromMatch(matchId: string, userId: string): Promise<void> {
    const query = `DELETE FROM match_players WHERE match_id = $1 AND user_id = $2`;
    await this.pool.query(query, [matchId, userId]);
  }

  /**
   * Mark player as forfeit
   */
  private async forfeitPlayer(matchId: string, userId: string): Promise<void> {
    const query = `
      UPDATE match_players
      SET is_forfeit = true
      WHERE match_id = $1 AND user_id = $2
    `;
    await this.pool.query(query, [matchId, userId]);
  }

  /**
   * Get all players in a match
   */
  private async getMatchPlayers(matchId: string): Promise<MatchPlayer[]> {
    const query = `SELECT * FROM match_players WHERE match_id = $1 ORDER BY player_position`;
    const result = await this.pool.query(query, [matchId]);
    return result.rows.map(row => this.mapPlayerRow(row));
  }

  /**
   * Get number of players from game mode
   */
  private getNumPlayersFromGameMode(gameMode: string): number {
    const modePlayers: Record<string, number> = {
      two_player: 2,
      three_player: 3,
      four_player: 4,
      partnership: 4,
    };

    return modePlayers[gameMode] || 2;
  }

  /**
   * Map database row to MatchPlayer
   */
  private mapPlayerRow(row: any): MatchPlayer {
    return {
      id: row.id,
      matchId: row.match_id,
      userId: row.user_id,
      playerPosition: row.player_position,
      isAi: row.is_ai,
      aiDifficulty: row.ai_difficulty,
      score: row.score || 0,
      isForfeit: row.is_forfeit || false,
      joinedAt: row.joined_at,
    };
  }

  /**
   * Map database row to Match (same as repository but needed here)
   */
  private mapMatchRow(row: any): Match {
    return {
      id: row.id,
      matchType: row.match_type,
      gameMode: row.game_mode,
      status: row.status,
      currentRound: row.current_round,
      currentTurnPlayerId: row.current_turn_player_id,
      dealerId: row.dealer_id,
      winnerId: row.winner_id,
      scoringMode: row.scoring_mode,
      tournamentId: row.tournament_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
