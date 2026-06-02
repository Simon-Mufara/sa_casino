/**
 * Card Suit Enum
 */
export enum Suit {
  HEARTS = 'HEARTS',
  DIAMONDS = 'DIAMONDS',
  CLUBS = 'CLUBS',
  SPADES = 'SPADES',
}

/**
 * Card Rank Enum
 */
export enum Rank {
  ACE = 'A',
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
}

/**
 * Card Interface
 * Represents a single playing card in the Khasino game
 */
export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 1-10 for game calculations
}

/**
 * Card Utilities
 */
export class CardUtil {
  /**
   * Get numeric value of a card (1-10 for Khasino rules)
   */
  static getValue(rank: Rank): number {
    switch (rank) {
      case Rank.ACE:
        return 1;
      case Rank.TWO:
        return 2;
      case Rank.THREE:
        return 3;
      case Rank.FOUR:
        return 4;
      case Rank.FIVE:
        return 5;
      case Rank.SIX:
        return 6;
      case Rank.SEVEN:
        return 7;
      case Rank.EIGHT:
        return 8;
      case Rank.NINE:
        return 9;
      case Rank.TEN:
      case Rank.JACK:
      case Rank.QUEEN:
      case Rank.KING:
        return 10;
    }
  }

  /**
   * Create a card
   */
  static createCard(suit: Suit, rank: Rank): Card {
    return {
      suit,
      rank,
      value: this.getValue(rank),
    };
  }

  /**
   * Check if card is Big Casino (10 of Diamonds)
   */
  static isBigCasino(card: Card): boolean {
    return card.suit === Suit.DIAMONDS && card.rank === Rank.TEN;
  }

  /**
   * Check if card is Little Casino (2 of Spades)
   */
  static isLittleCasino(card: Card): boolean {
    return card.suit === Suit.SPADES && card.rank === Rank.TWO;
  }

  /**
   * Check if card is an Ace
   */
  static isAce(card: Card): boolean {
    return card.rank === Rank.ACE;
  }

  /**
   * Check if card is a Spade
   */
  static isSpade(card: Card): boolean {
    return card.suit === Suit.SPADES;
  }

  /**
   * Compare two cards for equality
   */
  static equals(card1: Card, card2: Card): boolean {
    return card1.suit === card2.suit && card1.rank === card2.rank;
  }

  /**
   * Create a card from string representation
   */
  static fromString(cardString: string): Card {
    // Format: "AS" (Ace of Spades), "10H" (10 of Hearts), etc.
    const rankStr = cardString.slice(0, -1);
    const suitStr = cardString.slice(-1);

    const rank = this.rankFromString(rankStr);
    const suit = this.suitFromString(suitStr);

    return this.createCard(suit, rank);
  }

  /**
   * Convert card to string representation
   */
  static toString(card: Card): string {
    const suitChar = card.suit.charAt(0); // H, D, C, S
    return `${card.rank}${suitChar}`;
  }

  /**
   * Get rank from string
   */
  private static rankFromString(rankStr: string): Rank {
    const ranks: { [key: string]: Rank } = {
      'A': Rank.ACE,
      '2': Rank.TWO,
      '3': Rank.THREE,
      '4': Rank.FOUR,
      '5': Rank.FIVE,
      '6': Rank.SIX,
      '7': Rank.SEVEN,
      '8': Rank.EIGHT,
      '9': Rank.NINE,
      '10': Rank.TEN,
      'J': Rank.JACK,
      'Q': Rank.QUEEN,
      'K': Rank.KING,
    };
    return ranks[rankStr];
  }

  /**
   * Get suit from string
   */
  private static suitFromString(suitStr: string): Suit {
    const suits: { [key: string]: Suit } = {
      'H': Suit.HEARTS,
      'D': Suit.DIAMONDS,
      'C': Suit.CLUBS,
      'S': Suit.SPADES,
    };
    return suits[suitStr];
  }
}
