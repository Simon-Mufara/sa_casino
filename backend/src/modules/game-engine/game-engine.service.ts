import { v4 as uuidv4 } from 'uuid';
import { Deck } from './models/deck';
import { Card, CardUtil } from './models/card';
import { Build, BuildUtil } from './models/build';
import {
  GameState,
  GameConfig,
  GamePhase,
  Move,
  MoveType,
  MoveResult,
} from './game-state.interface';
import { MoveValidator } from './validators/move-validator';
import { ScoringService } from './scoring.service';
import { ValidationError, InternalServerError } from '../../shared/errors/app-error';
import { logger } from '../../shared/utils/logger';

/**
 * Game Engine Service
 * Server-authoritative game engine - the only source of truth
 * Clients never calculate game state
 */
export class GameEngineService {
  /**
   * Initialize a new game
   */
  static initializeGame(config: GameConfig): GameState {
    logger.info('Initializing new game', { matchId: config.matchId });

    const deck = new Deck();
    deck.shuffle();

    // Initial dealing: 4 cards to each player, 4 cards to table
    const playerHands: { [playerId: string]: Card[] } = {};
    const initialTableCards: Card[] = [];

    // Deal to players
    for (const player of config.players) {
      playerHands[player.id] = deck.dealMultiple(4);
    }

    // Deal to table
    for (let i = 0; i < 4; i++) {
      const card = deck.deal();
      if (card) initialTableCards.push(card);
    }

    // Initialize capture piles
    const capturePiles: { [playerId: string]: Card[] } = {};
    for (const player of config.players) {
      capturePiles[player.id] = [];
    }

    // Initialize scores
    const currentScores: { [playerId: string]: number } = {};
    for (const player of config.players) {
      currentScores[player.id] = 0;
    }

    // Determine first player (left of dealer)
    const dealerPosition = config.players.find((p) => p.id === config.dealerId)?.position || 0;
    const firstPlayerPosition = (dealerPosition + 1) % config.players.length;
    const firstPlayer = config.players.find((p) => p.position === firstPlayerPosition)!;

    const gameState: GameState = {
      matchId: config.matchId,
      phase: GamePhase.PLAYING,
      currentRound: 1,
      turnNumber: 1,
      currentPlayerId: firstPlayer.id,
      currentPlayerPosition: firstPlayer.position,
      deckRemaining: deck.remaining(),
      tableCards: initialTableCards,
      builds: [],
      playerHands,
      capturePiles,
      currentScores,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    logger.info('Game initialized', {
      matchId: config.matchId,
      players: config.players.length,
      deckRemaining: gameState.deckRemaining,
    });

    return gameState;
  }

  /**
   * Execute a move and return new game state
   */
  static executeMove(move: Move, gameState: GameState): MoveResult {
    logger.info('Executing move', {
      matchId: gameState.matchId,
      playerId: move.playerId,
      moveType: move.moveType,
      turnNumber: gameState.turnNumber,
    });

    // Validate move
    const validation = MoveValidator.validate(move, gameState);
    if (!validation.valid) {
      logger.warn('Invalid move', { error: validation.error, move });
      return {
        success: false,
        message: validation.error,
      };
    }

    // Create new state (immutable update)
    const newState = this.cloneGameState(gameState);

    // Execute move based on type
    let capturedCards: Card[] = [];
    let capturedBuilds: Build[] = [];

    try {
      switch (move.moveType) {
        case MoveType.CAPTURE:
          ({ capturedCards, capturedBuilds } = this.executeCapture(move, newState));
          break;
        case MoveType.BUILD:
          this.executeBuild(move, newState);
          break;
        case MoveType.CHANGE_BUILD:
          this.executeChangeBuild(move, newState);
          break;
        case MoveType.AUGMENT:
          this.executeAugment(move, newState);
          break;
        case MoveType.DRIFT:
          this.executeDrift(move, newState);
          break;
        case MoveType.STASH:
          this.executeStash(move, newState);
          break;
      }

      // Remove card from player's hand
      newState.playerHands[move.playerId] = newState.playerHands[move.playerId].filter(
        (c) => !CardUtil.equals(c, move.cardPlayed)
      );

      // Update last move
      newState.lastMove = {
        playerId: move.playerId,
        moveType: move.moveType,
        timestamp: new Date(),
      };

      // Check if round is over (all players out of cards)
      const allHandsEmpty = Object.values(newState.playerHands).every((hand) => hand.length === 0);

      if (allHandsEmpty) {
        this.handleRoundEnd(newState);
      } else {
        // Advance to next player
        this.advanceTurn(newState);
      }

      newState.updatedAt = new Date();

      logger.info('Move executed successfully', {
        matchId: newState.matchId,
        turnNumber: newState.turnNumber,
      });

      return {
        success: true,
        capturedCards,
        capturedBuilds,
        newState,
      };
    } catch (error) {
      logger.error('Error executing move', { error, move });
      return {
        success: false,
        message: 'Failed to execute move',
      };
    }
  }

  /**
   * Execute CAPTURE move
   */
  private static executeCapture(
    move: Move,
    state: GameState
  ): { capturedCards: Card[]; capturedBuilds: Build[] } {
    const capturedCards: Card[] = [move.cardPlayed];
    const capturedBuilds: Build[] = [];

    // Capture cards from table
    if (move.targets?.cards) {
      for (const card of move.targets.cards) {
        capturedCards.push(card);
        state.tableCards = state.tableCards.filter((c) => !CardUtil.equals(c, card));
      }
    }

    // Capture builds
    if (move.targets?.builds) {
      for (const buildId of move.targets.builds) {
        const buildIndex = state.builds.findIndex((b) => b.id === buildId);
        if (buildIndex !== -1) {
          const build = state.builds[buildIndex];
          capturedCards.push(...build.cards);
          capturedBuilds.push(build);
          state.builds.splice(buildIndex, 1);
        }
      }
    }

    // Add all captured cards to player's capture pile
    state.capturePiles[move.playerId].push(...capturedCards);

    return { capturedCards, capturedBuilds };
  }

  /**
   * Execute BUILD move
   */
  private static executeBuild(move: Move, state: GameState): void {
    if (!move.newBuild) return;

    const buildCards = [move.cardPlayed, ...move.newBuild.cards];

    // Remove cards from table
    for (const card of move.newBuild.cards) {
      state.tableCards = state.tableCards.filter((c) => !CardUtil.equals(c, card));
    }

    // Create new build
    const build = BuildUtil.createSimpleBuild(
      uuidv4(),
      move.playerId,
      buildCards,
      move.newBuild.value,
      state.builds.length
    );

    state.builds.push(build);
  }

  /**
   * Execute CHANGE_BUILD move
   */
  private static executeChangeBuild(move: Move, state: GameState): void {
    if (!move.targets?.builds || !move.newBuild) return;

    const buildId = move.targets.builds[0];
    const buildIndex = state.builds.findIndex((b) => b.id === buildId);

    if (buildIndex !== -1) {
      const existingBuild = state.builds[buildIndex];
      const newCards = [...existingBuild.cards, move.cardPlayed];

      // Update build
      state.builds[buildIndex] = BuildUtil.createSimpleBuild(
        existingBuild.id,
        move.playerId,
        newCards,
        move.newBuild.value,
        existingBuild.position
      );
    }
  }

  /**
   * Execute AUGMENT move
   */
  private static executeAugment(move: Move, state: GameState): void {
    if (!move.targets?.builds) return;

    const buildId = move.targets.builds[0];
    const buildIndex = state.builds.findIndex((b) => b.id === buildId);

    if (buildIndex !== -1) {
      const build = state.builds[buildIndex];
      build.cards.push(move.cardPlayed);
    }
  }

  /**
   * Execute DRIFT move
   */
  private static executeDrift(move: Move, state: GameState): void {
    state.tableCards.push(move.cardPlayed);
  }

  /**
   * Execute STASH move (create compound build)
   */
  private static executeStash(move: Move, state: GameState): void {
    if (!move.targets?.builds || !move.newBuild) return;

    const targetBuilds: Build[] = [];

    // Collect target builds
    for (const buildId of move.targets.builds) {
      const build = state.builds.find((b) => b.id === buildId);
      if (build) targetBuilds.push(build);
    }

    // Remove original builds
    state.builds = state.builds.filter((b) => !move.targets!.builds!.includes(b.id));

    // Create compound build
    const compoundBuild = BuildUtil.createCompoundBuild(
      uuidv4(),
      move.playerId,
      targetBuilds,
      move.newBuild.value,
      state.builds.length
    );

    // Add played card to compound build
    compoundBuild.cards.push(move.cardPlayed);

    state.builds.push(compoundBuild);
  }

  /**
   * Advance to next player's turn
   */
  private static advanceTurn(state: GameState): void {
    const currentPlayerIndex = state.config.players.findIndex(
      (p) => p.id === state.currentPlayerId
    );
    const nextPlayerIndex = (currentPlayerIndex + 1) % state.config.players.length;
    const nextPlayer = state.config.players[nextPlayerIndex];

    state.currentPlayerId = nextPlayer.id;
    state.currentPlayerPosition = nextPlayer.position;
    state.turnNumber++;
  }

  /**
   * Handle end of round
   */
  private static handleRoundEnd(state: GameState): void {
    logger.info('Round ended', {
      matchId: state.matchId,
      round: state.currentRound,
    });

    // Award last capture (remaining table cards go to last capturer)
    if (state.lastMove && state.lastMove.moveType === MoveType.CAPTURE) {
      ScoringService.awardLastCapture(
        state.lastMove.playerId,
        state.tableCards,
        state.capturePiles
      );
      state.tableCards = [];
    }

    // Calculate round scores
    const roundScores = ScoringService.calculateRoundScore(state.capturePiles);

    // Update total scores
    for (const score of roundScores) {
      state.currentScores[score.playerId] += score.totalPoints;
    }

    // Check if game is over
    const gameOverResult = ScoringService.isGameOver(
      state.currentScores,
      state.config.scoringMode
    );

    if (gameOverResult.isOver) {
      state.phase = GamePhase.GAME_END;
      logger.info('Game ended', {
        matchId: state.matchId,
        winnerId: gameOverResult.winnerId,
      });
    } else if (state.currentRound < 2) {
      // Start round 2
      state.currentRound = 2;
      state.phase = GamePhase.ROUND_END;
      // TODO: Re-deal cards for round 2
    } else {
      // Game over after 2 rounds
      state.phase = GamePhase.GAME_END;
    }
  }

  /**
   * Clone game state for immutable updates
   */
  private static cloneGameState(state: GameState): GameState {
    return {
      ...state,
      tableCards: [...state.tableCards],
      builds: state.builds.map((b) => ({ ...b })),
      playerHands: { ...state.playerHands },
      capturePiles: { ...state.capturePiles },
      currentScores: { ...state.currentScores },
      config: { ...state.config },
    };
  }
}
