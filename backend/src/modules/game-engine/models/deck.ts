import { Card, Suit, Rank, CardUtil } from './card';

/**
 * Deck Class
 * Manages a deck of 40 cards (no 8s, 9s, 10s - as per Khasino rules)
 */
export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = [];
    this.initialize();
  }

  /**
   * Initialize a fresh 40-card deck
   * Excludes 8s, 9s, and 10s (except 10 of Diamonds - Big Casino)
   */
  private initialize(): void {
    const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
    const ranks = [
      Rank.ACE,
      Rank.TWO,
      Rank.THREE,
      Rank.FOUR,
      Rank.FIVE,
      Rank.SIX,
      Rank.SEVEN,
      Rank.JACK,
      Rank.QUEEN,
      Rank.KING,
    ];

    // Create standard cards (excluding 8, 9, 10)
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(CardUtil.createCard(suit, rank));
      }
    }

    // Add special card: 10 of Diamonds (Big Casino)
    this.cards.push(CardUtil.createCard(Suit.DIAMONDS, Rank.TEN));
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deal a card from the top of the deck
   */
  deal(): Card | null {
    return this.cards.pop() || null;
  }

  /**
   * Deal multiple cards
   */
  dealMultiple(count: number): Card[] {
    const dealt: Card[] = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      const card = this.deal();
      if (card) {
        dealt.push(card);
      }
    }
    return dealt;
  }

  /**
   * Get number of remaining cards
   */
  remaining(): number {
    return this.cards.length;
  }

  /**
   * Check if deck is empty
   */
  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /**
   * Reset and shuffle deck
   */
  reset(): void {
    this.cards = [];
    this.initialize();
    this.shuffle();
  }

  /**
   * Get all cards (for testing)
   */
  getCards(): Card[] {
    return [...this.cards];
  }
}
