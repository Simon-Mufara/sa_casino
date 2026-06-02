import jwt from 'jsonwebtoken';
import { config } from '../../config';

/**
 * JWT Token Payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
}

/**
 * JWT Utilities for token generation and verification
 */
export class JwtUtil {
  /**
   * Generate an access token (short-lived)
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Generate a refresh token (long-lived)
   */
  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  /**
   * Verify an access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify a refresh token
   */
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Decode a token without verification (for debugging)
   */
  static decode(token: string): any {
    return jwt.decode(token);
  }
}
