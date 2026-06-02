import { GameState, Move, MoveType } from '../game-engine/game-state.interface';
import { Card } from '../game-engine/models/card';
import { MoveValidator } from '../game-engine/validators/move-validator';
import { logger } from '../../shared/utils/logger';

/**
 * AI Difficulty Level
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * AI Player Service
 * Implements AI opponents with different difficulty levels
 */
export class AIPlayerService {
  /**
   * Get AI move for current player
   */
  static getMove(gameState: GameState, difficulty: AIDifficulty): Move | null {
    const playerId = gameState.currentPlayerId;
    const playerHand = gameState.playerHands[playerId];

    if (!playerHand || playerHand.length === 0) {
      return null;
    }

    logger.info('AI calculating move', { playerId, difficulty });

    switch (difficulty) {
      case 'easy':
        return this.getEasyMove(gameState, playerId, playerHand);
      case 'medium':
        return this.getMediumMove(gameState, playerId, playerHand);
      case 'hard':
        return this.getHardMove(gameState, playerId, playerHand);
      case 'expert':
        return this.getExpertMove(gameState, playerId, playerHand);
      default:
        return this.getEasyMove(gameState, playerId, playerHand);
    }
  }

  /**
   * Easy AI: Random legal move
   */
  private static getEasyMove(gameState: GameState, playerId: string, hand: Card[]): Move {
    // Get all legal moves
    const legalMoves = this.getAllLegalMoves(gameState, playerId, hand);

    if (legalMoves.length === 0) {
      // No valid moves, drift first card
      return {
        playerId,
        cardPlayed: hand[0],
        moveType: MoveType.DRIFT,
      };
    }

    // Pick random legal move
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
  }

  /**
   * Medium AI: Rule-based heuristics
   * - Prefer captures over builds
   * - Prefer high-value captures
   * - Protect own builds
   */
  private static getMediumMove(gameState: GameState, playerId: string, hand: Card[]): Move {
    const legalMoves = this.getAllLegalMoves(gameState, playerId, hand);

    if (legalMoves.length === 0) {
      return {
        playerId,
        cardPlayed: hand[0],
        moveType: MoveType.DRIFT,
      };
    }

    // Score moves
    const scoredMoves = legalMoves.map((move) => ({
      move,
      score: this.scoreMoveHeuristic(move, gameState),
    }));

    // Sort by score descending
    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves[0].move;
  }

  /**
   * Hard AI: Minimax with alpha-beta pruning
   * (Simplified - full implementation would be more complex)
   */
  private static getHardMove(gameState: GameState, playerId: string, hand: Card[]): Move {
    // For now, use medium AI with better scoring
    return this.getMediumMove(gameState, playerId, hand);
  }

  /**
   * Expert AI: Monte Carlo Tree Search
   * (Simplified - full implementation would be more complex)
   */
  private static getExpertMove(gameState: GameState, playerId: string, hand: Card[]): Move {
    // For now, use hard AI
    return this.getHardMove(gameState, playerId, hand);
  }

  /**
   * Get all legal moves for a player
   */
  private static getAllLegalMoves(
    gameState: GameState,
    playerId: string,
    hand: Card[]
  ): Move[] {
    const legalMoves: Move[] = [];

    for (const card of hand) {
      // Try capture moves
      const captureMoves = this.generateCaptureMoves(gameState, playerId, card);
      legalMoves.push(...captureMoves);

      // Try build moves
      const buildMoves = this.generateBuildMoves(gameState, playerId, card);
      legalMoves.push(...buildMoves);

      // Drift is always legal
      legalMoves.push({
        playerId,
        cardPlayed: card,
        moveType: MoveType.DRIFT,
      });
    }

    // Filter to only valid moves
    return legalMoves.filter((move) => {
      const validation = MoveValidator.validate(move, gameState);
      return validation.valid;
    });
  }

  /**
   * Generate possible capture moves for a card
   */
  private static generateCaptureMoves(
    gameState: GameState,
    playerId: string,
    card: Card
  ): Move[] {
    const moves: Move[] = [];

    // Try capturing matching table cards
    const matchingCards = gameState.tableCards.filter((c) => c.value === card.value);
    if (matchingCards.length > 0) {
      moves.push({
        playerId,
        cardPlayed: card,
        moveType: MoveType.CAPTURE,
        targets: { cards: [matchingCards[0]] },
      });
    }

    // Try capturing builds
    const matchingBuilds = gameState.builds.filter((b) => b.value === card.value);
    for (const build of matchingBuilds) {
      moves.push({
        playerId,
        cardPlayed: card,
        moveType: MoveType.CAPTURE,
        targets: { builds: [build.id] },
      });
    }

    return moves;
  }

  /**
   * Generate possible build moves for a card
   */
  private static generateBuildMoves(
    gameState: GameState,
    playerId: string,
    card: Card
  ): Move[] {
    const moves: Move[] = [];

    // Try building with each table card
    for (const tableCard of gameState.tableCards) {
      const buildValue = card.value + tableCard.value;
      if (buildValue >= 1 && buildValue <= 10) {
        moves.push({
          playerId,
          cardPlayed: card,
          moveType: MoveType.BUILD,
          newBuild: {
            value: buildValue,
            cards: [tableCard],
          },
        });
      }
    }

    return moves;
  }

  /**
   * Score a move using heuristics
   */
  private static scoreMoveHeuristic(move: Move, gameState: GameState): number {
    let score = 0;

    // Captures are valuable
    if (move.moveType === MoveType.CAPTURE) {
      score += 10;

      // Capturing builds is better
      if (move.targets?.builds && move.targets.builds.length > 0) {
        score += 5;
      }

      // Capturing multiple cards is better
      if (move.targets?.cards) {
        score += move.targets.cards.length * 2;
      }
    }

    // Building is okay
    if (move.moveType === MoveType.BUILD) {
      score += 3;
    }

    // Drifting is last resort
    if (move.moveType === MoveType.DRIFT) {
      score += 1;
    }

    return score;
  }
}
