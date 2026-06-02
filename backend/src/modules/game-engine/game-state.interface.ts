import { Card } from './models/card';
import { Build } from './models/build';

/**
 * Player Hand
 */
export interface PlayerHand {
  playerId: string;
  cards: Card[];
}

/**
 * Player Capture Pile
 */
export interface CapturePile {
  playerId: string;
  cards: Card[];
}

/**
 * Game Phase
 */
export enum GamePhase {
  SETUP = 'SETUP', // Initial dealing
  PLAYING = 'PLAYING', // Active gameplay
  ROUND_END = 'ROUND_END', // Round completed
  GAME_END = 'GAME_END', // Game completed
}

/**
 * Player Role
 */
export interface Player {
  id: string;
  position: number; // 0-3
  isAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  partnerId?: string; // For partnership mode
}

/**
 * Game Configuration
 */
export interface GameConfig {
  matchId: string;
  gameMode: 'two_player' | 'three_player' | 'four_player' | 'partnership';
  scoringMode: 'eleven_point' | 'seven_point';
  players: Player[];
  dealerId: string;
}

/**
 * Game State
 * Complete state of an active game
 * Server is the only source of truth - clients receive this state
 */
export interface GameState {
  // Match metadata
  matchId: string;
  phase: GamePhase;
  currentRound: number; // 1 or 2
  turnNumber: number; // Sequential turn counter

  // Current turn
  currentPlayerId: string;
  currentPlayerPosition: number;

  // Deck status
  deckRemaining: number;

  // Table state
  tableCards: Card[]; // Loose cards on the table
  builds: Build[]; // Active builds

  // Player states
  playerHands: { [playerId: string]: Card[] };
  capturePiles: { [playerId: string]: Card[] };

  // Scores
  currentScores: { [playerId: string]: number };

  // Game config
  config: GameConfig;

  // Last move tracking
  lastMove?: {
    playerId: string;
    moveType: string;
    timestamp: Date;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Move Type
 */
export enum MoveType {
  CAPTURE = 'capture', // Capture cards/builds
  BUILD = 'build', // Create a build
  CHANGE_BUILD = 'change_build', // Change build value
  AUGMENT = 'augment', // Add to existing build
  DRIFT = 'drift', // Play card without capturing
  STASH = 'stash', // Add to compound build
}

/**
 * Move Interface
 */
export interface Move {
  playerId: string;
  cardPlayed: Card;
  moveType: MoveType;
  targets?: {
    cards?: Card[];
    builds?: string[]; // Build IDs
  };
  newBuild?: {
    value: number;
    cards: Card[];
  };
}

/**
 * Move Result
 */
export interface MoveResult {
  success: boolean;
  message?: string;
  capturedCards?: Card[];
  capturedBuilds?: Build[];
  newState?: GameState;
}

/**
 * Round Result
 */
export interface RoundResult {
  playerId: string;
  cardsCount: number;
  spadesCount: number;
  hasBigCasino: boolean;
  hasLittleCasino: boolean;
  acesCount: number;
  points: number;
}

/**
 * Game Score
 */
export interface GameScore {
  playerId: string;
  cardsPoints: number; // 3 points for majority of cards
  spadesPoints: number; // 1 point for majority of spades
  bigCasinoPoints: number; // 2 points for 10 of Diamonds
  littleCasinoPoints: number; // 1 point for 2 of Spades
  acesPoints: number; // 1 point per Ace
  totalPoints: number;
}
