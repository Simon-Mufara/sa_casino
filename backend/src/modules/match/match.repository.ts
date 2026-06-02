import { Pool } from 'pg';
import { DatabaseConnection } from '../../database/connection';
import { GameConfig, GameState, GamePhase } from '../game-engine/game-state.interface';

/**
 * Match Status
 */
export type MatchStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

/**
 * Match Entity
 */
export interface Match {
  id: string;
  matchType: 'casual' | 'ranked' | 'tournament' | 'private';
  gameMode: 'two_player' | 'three_player' | 'four_player' | 'partnership';
  status: MatchStatus;
  currentRound: number;
  currentTurnPlayerId?: string;
  dealerId: string;
  winnerId?: string;
  scoringMode: 'eleven_point' | 'seven_point';
  tournamentId?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Match Repository
 */
export class MatchRepository {
  private pool: Pool;

  constructor() {
    this.pool = DatabaseConnection.getPool();
  }

  /**
   * Create a new match
   */
  async createMatch(data: {
    matchType: string;
    gameMode: string;
    dealerId: string;
    scoringMode: string;
  }): Promise<Match> {
    const query = `
      INSERT INTO matches (match_type, game_mode, dealer_id, scoring_mode)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await DatabaseConnection.query(query, [
      data.matchType,
      data.gameMode,
      data.dealerId,
      data.scoringMode,
    ]);

    return this.mapMatchRow(result.rows[0]);
  }

  /**
   * Find match by ID
   */
  async findById(matchId: string): Promise<Match | null> {
    const query = `SELECT * FROM matches WHERE id = $1`;
    const result = await DatabaseConnection.query(query, [matchId]);
    return result.rows[0] ? this.mapMatchRow(result.rows[0]) : null;
  }

  /**
   * Update match status
   */
  async updateStatus(matchId: string, status: MatchStatus): Promise<void> {
    const query = `
      UPDATE matches
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await DatabaseConnection.query(query, [status, matchId]);
  }

  /**
   * Set match winner
   */
  async setWinner(matchId: string, winnerId: string): Promise<void> {
    const query = `
      UPDATE matches
      SET winner_id = $1, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await DatabaseConnection.query(query, [winnerId, matchId]);
  }

  /**
   * Map database row to Match entity
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
