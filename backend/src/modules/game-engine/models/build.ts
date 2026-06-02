import { Card } from './card';

/**
 * Build Interface
 * Represents a build on the table
 */
export interface Build {
  id: string;
  ownerId: string; // Player who created/owns the build
  value: number; // Target value (1-10)
  isCompound: boolean; // Simple or compound build
  cards: Card[]; // Cards in the build
  components?: Build[]; // For compound builds - contains simple builds
  position: number; // Position on table
  createdAt: Date;
}

/**
 * Build Type
 */
export enum BuildType {
  SIMPLE = 'SIMPLE',
  COMPOUND = 'COMPOUND',
}

/**
 * Build Utilities
 */
export class BuildUtil {
  /**
   * Create a simple build
   */
  static createSimpleBuild(
    id: string,
    ownerId: string,
    cards: Card[],
    value: number,
    position: number
  ): Build {
    return {
      id,
      ownerId,
      value,
      isCompound: false,
      cards,
      position,
      createdAt: new Date(),
    };
  }

  /**
   * Create a compound build from existing builds
   */
  static createCompoundBuild(
    id: string,
    ownerId: string,
    components: Build[],
    value: number,
    position: number
  ): Build {
    // Flatten all cards from component builds
    const allCards = components.flatMap((b) => b.cards);

    return {
      id,
      ownerId,
      value,
      isCompound: true,
      cards: allCards,
      components,
      position,
      createdAt: new Date(),
    };
  }

  /**
   * Calculate total value of cards in a build
   */
  static calculateValue(cards: Card[]): number {
    return cards.reduce((sum, card) => sum + card.value, 0);
  }

  /**
   * Validate build value (must be 1-10)
   */
  static isValidValue(value: number): boolean {
    return value >= 1 && value <= 10;
  }

  /**
   * Check if player owns a build
   */
  static isOwnedBy(build: Build, playerId: string): boolean {
    return build.ownerId === playerId;
  }

  /**
   * Check if build contains a specific card
   */
  static containsCard(build: Build, targetCard: Card): boolean {
    return build.cards.some(
      (card) => card.suit === targetCard.suit && card.rank === targetCard.rank
    );
  }

  /**
   * Get all card values in a build
   */
  static getCardValues(build: Build): number[] {
    return build.cards.map((card) => card.value);
  }

  /**
   * Convert build to JSON-serializable format
   */
  static toJSON(build: Build): any {
    return {
      id: build.id,
      ownerId: build.ownerId,
      value: build.value,
      isCompound: build.isCompound,
      cards: build.cards,
      components: build.components?.map((c) => this.toJSON(c)),
      position: build.position,
      createdAt: build.createdAt.toISOString(),
    };
  }
}
