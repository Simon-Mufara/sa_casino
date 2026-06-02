import { Card, CardUtil } from '../models/card';
import { GameScore, RoundResult } from '../game-state.interface';

/**
 * Scoring Service
 * Calculates points according to Khasino rules
 */
export class ScoringService {
  /**
   * Calculate points for a round
   */
  static calculateRoundScore(capturePiles: { [playerId: string]: Card[] }): GameScore[] {
    const playerIds = Object.keys(capturePiles);
    const scores: GameScore[] = [];

    // Calculate individual player stats
    const playerStats = playerIds.map((playerId) => {
      const cards = capturePiles[playerId];
      return this.calculatePlayerStats(playerId, cards);
    });

    // Determine majority winners
    const cardMajority = this.findMajority(playerStats, (p) => p.cardsCount);
    const spadeMajority = this.findMajority(playerStats, (p) => p.spadesCount);

    // Assign points to each player
    for (const stats of playerStats) {
      const score: GameScore = {
        playerId: stats.playerId,
        cardsPoints: cardMajority.includes(stats.playerId) ? 3 : 0,
        spadesPoints: spadeMajority.includes(stats.playerId) ? 1 : 0,
        bigCasinoPoints: stats.hasBigCasino ? 2 : 0,
        littleCasinoPoints: stats.hasLittleCasino ? 1 : 0,
        acesPoints: stats.acesCount,
        totalPoints: 0,
      };

      score.totalPoints =
        score.cardsPoints +
        score.spadesPoints +
        score.bigCasinoPoints +
        score.littleCasinoPoints +
        score.acesPoints;

      scores.push(score);
    }

    return scores;
  }

  /**
   * Calculate individual player statistics
   */
  private static calculatePlayerStats(playerId: string, cards: Card[]): RoundResult {
    return {
      playerId,
      cardsCount: cards.length,
      spadesCount: cards.filter((c) => CardUtil.isSpade(c)).length,
      hasBigCasino: cards.some((c) => CardUtil.isBigCasino(c)),
      hasLittleCasino: cards.some((c) => CardUtil.isLittleCasino(c)),
      acesCount: cards.filter((c) => CardUtil.isAce(c)).length,
      points: 0, // Will be calculated
    };
  }

  /**
   * Find player(s) with majority for a given metric
   * Returns array to handle ties
   */
  private static findMajority(
    stats: RoundResult[],
    getValue: (stat: RoundResult) => number
  ): string[] {
    if (stats.length === 0) return [];

    const maxValue = Math.max(...stats.map(getValue));
    const winners = stats.filter((s) => getValue(s) === maxValue);

    // If there's a tie, nobody gets the points
    if (winners.length > 1 && maxValue > 0) {
      return [];
    }

    return winners.map((w) => w.playerId);
  }

  /**
   * Check if game is over based on scoring mode
   */
  static isGameOver(
    scores: { [playerId: string]: number },
    scoringMode: 'eleven_point' | 'seven_point'
  ): { isOver: boolean; winnerId?: string } {
    const targetScore = scoringMode === 'eleven_point' ? 11 : 7;

    const playerScores = Object.entries(scores);
    const highestScore = Math.max(...playerScores.map(([_, score]) => score));

    if (highestScore >= targetScore) {
      // Find winner (highest score)
      const winner = playerScores.find(([_, score]) => score === highestScore);
      return {
        isOver: true,
        winnerId: winner ? winner[0] : undefined,
      };
    }

    return { isOver: false };
  }

  /**
   * Calculate last capture bonus
   * Player who made the last capture gets all remaining table cards
   */
  static awardLastCapture(
    lastCapturingPlayerId: string,
    tableCards: Card[],
    capturePiles: { [playerId: string]: Card[] }
  ): void {
    if (tableCards.length > 0) {
      if (!capturePiles[lastCapturingPlayerId]) {
        capturePiles[lastCapturingPlayerId] = [];
      }
      capturePiles[lastCapturingPlayerId].push(...tableCards);
    }
  }

  /**
   * Format score summary for display
   */
  static formatScoreSummary(score: GameScore): string {
    const parts: string[] = [];

    if (score.cardsPoints > 0) parts.push(`Cards: ${score.cardsPoints}`);
    if (score.spadesPoints > 0) parts.push(`Spades: ${score.spadesPoints}`);
    if (score.bigCasinoPoints > 0) parts.push(`Big Casino: ${score.bigCasinoPoints}`);
    if (score.littleCasinoPoints > 0) parts.push(`Little Casino: ${score.littleCasinoPoints}`);
    if (score.acesPoints > 0) parts.push(`Aces: ${score.acesPoints}`);

    return parts.length > 0 ? parts.join(', ') : 'No points';
  }
}
