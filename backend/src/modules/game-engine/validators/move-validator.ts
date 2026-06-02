import { Card, CardUtil } from '../models/card';
import { Build, BuildUtil } from '../models/build';
import { GameState, Move, MoveType } from '../game-state.interface';
import { ValidationError } from '../../../shared/errors/app-error';

/**
 * Move Validator
 * Validates all game moves according to Khasino rules
 */
export class MoveValidator {
  /**
   * Validate a move
   */
  static validate(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    // Check if it's the player's turn
    if (move.playerId !== gameState.currentPlayerId) {
      return { valid: false, error: 'Not your turn' };
    }

    // Check if player has the card
    const playerHand = gameState.playerHands[move.playerId];
    const hasCard = playerHand.some((c) => CardUtil.equals(c, move.cardPlayed));
    if (!hasCard) {
      return { valid: false, error: 'Card not in hand' };
    }

    // Validate based on move type
    switch (move.moveType) {
      case MoveType.CAPTURE:
        return this.validateCapture(move, gameState);
      case MoveType.BUILD:
        return this.validateBuild(move, gameState);
      case MoveType.CHANGE_BUILD:
        return this.validateChangeBuild(move, gameState);
      case MoveType.AUGMENT:
        return this.validateAugment(move, gameState);
      case MoveType.DRIFT:
        return this.validateDrift(move, gameState);
      case MoveType.STASH:
        return this.validateStash(move, gameState);
      default:
        return { valid: false, error: 'Invalid move type' };
    }
  }

  /**
   * Validate CAPTURE move
   * Can capture: matching cards, builds you own, builds with matching value
   */
  private static validateCapture(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    const cardValue = move.cardPlayed.value;

    if (!move.targets || (!move.targets.cards?.length && !move.targets.builds?.length)) {
      return { valid: false, error: 'Must specify cards or builds to capture' };
    }

    // Validate card captures
    if (move.targets.cards) {
      const totalValue = move.targets.cards.reduce((sum, card) => sum + card.value, 0);

      // Can capture if: single matching card, or sum equals card value
      const singleMatch = move.targets.cards.length === 1 && move.targets.cards[0].value === cardValue;
      const sumMatch = totalValue === cardValue && move.targets.cards.length > 1;

      if (!singleMatch && !sumMatch) {
        return { valid: false, error: 'Invalid card capture combination' };
      }

      // Verify all target cards are on table
      for (const target of move.targets.cards) {
        const onTable = gameState.tableCards.some((c) => CardUtil.equals(c, target));
        if (!onTable) {
          return { valid: false, error: 'Target card not on table' };
        }
      }
    }

    // Validate build captures
    if (move.targets.builds) {
      for (const buildId of move.targets.builds) {
        const build = gameState.builds.find((b) => b.id === buildId);
        if (!build) {
          return { valid: false, error: 'Build not found' };
        }

        // Can only capture build if card value matches build value
        if (build.value !== cardValue) {
          return { valid: false, error: `Card value (${cardValue}) doesn't match build value (${build.value})` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate BUILD move
   * Create a new build with card from hand + cards from table
   */
  private static validateBuild(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    if (!move.newBuild) {
      return { valid: false, error: 'Build details missing' };
    }

    const { value, cards } = move.newBuild;

    // Build value must be 1-10
    if (!BuildUtil.isValidValue(value)) {
      return { valid: false, error: 'Build value must be between 1 and 10' };
    }

    // Must have card in hand that can capture this build later
    const playerHand = gameState.playerHands[move.playerId];
    const hasMatchingCard = playerHand.some((c) => c.value === value && !CardUtil.equals(c, move.cardPlayed));
    if (!hasMatchingCard) {
      return { valid: false, error: 'Must have a card in hand to capture this build' };
    }

    // Cards must be from table
    for (const card of cards) {
      const onTable = gameState.tableCards.some((c) => CardUtil.equals(c, card));
      if (!onTable) {
        return { valid: false, error: 'Build cards must be from table' };
      }
    }

    // Card played + build cards must sum to value
    const totalValue = move.cardPlayed.value + cards.reduce((sum, c) => sum + c.value, 0);
    if (totalValue !== value) {
      return { valid: false, error: `Cards don't sum to build value (${totalValue} !== ${value})` };
    }

    return { valid: true };
  }

  /**
   * Validate CHANGE_BUILD move
   * Increase the value of an existing build you own
   */
  private static validateChangeBuild(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    if (!move.targets?.builds || move.targets.builds.length !== 1) {
      return { valid: false, error: 'Must specify exactly one build to change' };
    }

    const buildId = move.targets.builds[0];
    const build = gameState.builds.find((b) => b.id === buildId);

    if (!build) {
      return { valid: false, error: 'Build not found' };
    }

    // Can only change builds you own
    if (build.ownerId !== move.playerId) {
      return { valid: false, error: 'Can only change builds you own' };
    }

    // Cannot change compound builds
    if (build.isCompound) {
      return { valid: false, error: 'Cannot change compound builds' };
    }

    if (!move.newBuild) {
      return { valid: false, error: 'New build value required' };
    }

    const newValue = move.newBuild.value;

    // New value must be different and valid
    if (newValue === build.value) {
      return { valid: false, error: 'New value must be different' };
    }

    if (!BuildUtil.isValidValue(newValue)) {
      return { valid: false, error: 'Build value must be between 1 and 10' };
    }

    // Must have card in hand that can capture the new value
    const playerHand = gameState.playerHands[move.playerId];
    const hasMatchingCard = playerHand.some((c) => c.value === newValue && !CardUtil.equals(c, move.cardPlayed));
    if (!hasMatchingCard) {
      return { valid: false, error: 'Must have card to capture new build value' };
    }

    // Card played + existing build must equal new value
    const totalValue = move.cardPlayed.value + build.value;
    if (totalValue !== newValue) {
      return { valid: false, error: 'Card + build value must equal new value' };
    }

    return { valid: true };
  }

  /**
   * Validate AUGMENT move
   * Add cards to an existing build (can be owned by anyone)
   */
  private static validateAugment(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    if (!move.targets?.builds || move.targets.builds.length !== 1) {
      return { valid: false, error: 'Must specify exactly one build to augment' };
    }

    const buildId = move.targets.builds[0];
    const build = gameState.builds.find((b) => b.id === buildId);

    if (!build) {
      return { valid: false, error: 'Build not found' };
    }

    // Card played must match build value
    if (move.cardPlayed.value !== build.value) {
      return { valid: false, error: 'Card value must match build value' };
    }

    // Must have card in hand that can capture this build
    const playerHand = gameState.playerHands[move.playerId];
    const hasMatchingCard = playerHand.some((c) => c.value === build.value && !CardUtil.equals(c, move.cardPlayed));
    if (!hasMatchingCard) {
      return { valid: false, error: 'Must have card to capture this build' };
    }

    return { valid: true };
  }

  /**
   * Validate DRIFT move
   * Play a card to table without capturing (when no other move possible)
   */
  private static validateDrift(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    // Drift is only allowed if player has a build they own
    // (must protect own builds by not allowing optional drift)
    const hasOwnBuild = gameState.builds.some((b) => b.ownerId === move.playerId);

    if (hasOwnBuild) {
      // If player owns a build, they must capture it if possible
      const canCaptureBuild = gameState.builds.some(
        (b) => b.ownerId === move.playerId && b.value === move.cardPlayed.value
      );

      if (canCaptureBuild) {
        return { valid: false, error: 'Must capture your own build' };
      }
    }

    // Otherwise drift is allowed
    return { valid: true };
  }

  /**
   * Validate STASH move
   * Combine multiple builds into a compound build
   */
  private static validateStash(move: Move, gameState: GameState): { valid: boolean; error?: string } {
    if (!move.targets?.builds || move.targets.builds.length < 2) {
      return { valid: false, error: 'Must specify at least 2 builds to combine' };
    }

    if (!move.newBuild) {
      return { valid: false, error: 'Compound build value required' };
    }

    const targetValue = move.newBuild.value;

    // All builds must have the same value
    for (const buildId of move.targets.builds) {
      const build = gameState.builds.find((b) => b.id === buildId);
      if (!build) {
        return { valid: false, error: 'Build not found' };
      }

      if (build.value !== targetValue) {
        return { valid: false, error: 'All builds must have same value' };
      }
    }

    // Card played must match the build value
    if (move.cardPlayed.value !== targetValue) {
      return { valid: false, error: 'Card must match build value' };
    }

    // Must have card in hand to capture
    const playerHand = gameState.playerHands[move.playerId];
    const hasMatchingCard = playerHand.some((c) => c.value === targetValue && !CardUtil.equals(c, move.cardPlayed));
    if (!hasMatchingCard) {
      return { valid: false, error: 'Must have card to capture compound build' };
    }

    return { valid: true };
  }
}
