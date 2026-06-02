import { AuthRepository, User, AuthSession } from './auth.repository';
import { BcryptUtil } from '../../shared/utils/bcrypt';
import { JwtUtil, TokenPayload } from '../../shared/utils/jwt';
import { RedisClient } from '../../database/redis-client';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error';
import { logger } from '../../shared/utils/logger';
import crypto from 'crypto';

/**
 * Authentication Response
 */
export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
    avatarUrl?: string;
    isPremium: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication Service
 * Handles all authentication-related business logic
 */
export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  /**
   * Register a new user
   */
  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthResponse> {
    logger.info('Registering new user', { email: dto.email, username: dto.username });

    // Check if email already exists
    const existingEmail = await this.authRepository.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await this.authRepository.findByUsername(dto.username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    // Hash password
    const passwordHash = await BcryptUtil.hash(dto.password);

    // Create user
    const user = await this.authRepository.createUser({
      username: dto.username,
      email: dto.email,
      passwordHash,
      countryCode: dto.countryCode,
      preferredLanguage: dto.preferredLanguage || 'en',
    });

    logger.info('User registered successfully', { userId: user.id });

    // Generate email verification token
    const verificationToken = this.generateVerificationToken();
    await this.storeVerificationToken(user.id, verificationToken, 'email');

    // TODO: Send verification email
    logger.info('Email verification token generated', { userId: user.id });

    // Generate tokens and create session
    const tokens = await this.createUserSession(user, ipAddress);

    // Initialize user stats
    await this.initializeUserStats(user.id);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponse> {
    logger.info('User login attempt', { emailOrUsername: dto.emailOrUsername });

    // Find user by email or username
    let user = await this.authRepository.findByEmail(dto.emailOrUsername);
    if (!user) {
      user = await this.authRepository.findByUsername(dto.emailOrUsername);
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      throw new UnauthorizedError(`Account is ${user.accountStatus}`);
    }

    // Verify password
    const isPasswordValid = await BcryptUtil.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    logger.info('User logged in successfully', { userId: user.id });

    // Generate tokens and create session
    const tokens = await this.createUserSession(user, ipAddress);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    logger.info('Refreshing access token');

    // Verify refresh token
    let payload: TokenPayload;
    try {
      payload = JwtUtil.verifyRefreshToken(dto.refreshToken);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if session exists and is valid
    const session = await this.authRepository.findSessionByToken(dto.refreshToken);
    if (!session || session.revoked) {
      throw new UnauthorizedError('Session expired or revoked');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // Get user
    const user = await this.authRepository.findById(payload.userId);
    if (!user || user.accountStatus !== 'active') {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate new tokens
    const newAccessToken = JwtUtil.generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const newRefreshToken = JwtUtil.generateRefreshToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Revoke old session and create new one
    await this.authRepository.revokeSession(session.id);
    await this.authRepository.createSession({
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt: this.getRefreshTokenExpiry(),
    });

    logger.info('Access token refreshed', { userId: user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout user (revoke session)
   */
  async logout(refreshToken: string): Promise<void> {
    logger.info('User logout');

    const session = await this.authRepository.findSessionByToken(refreshToken);
    if (session) {
      await this.authRepository.revokeSession(session.id);
      logger.info('Session revoked', { sessionId: session.id });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    logger.info('Verifying email');

    const userId = await this.getVerificationTokenUserId(token, 'email');
    if (!userId) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.authRepository.verifyEmail(userId);
    await this.deleteVerificationToken(token, 'email');

    logger.info('Email verified', { userId });
  }

  /**
   * Request password reset
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    logger.info('Password reset requested', { email: dto.email });

    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      // Don't reveal if email exists
      logger.warn('Password reset requested for non-existent email', { email: dto.email });
      return;
    }

    // Generate reset token
    const resetToken = this.generateVerificationToken();
    await this.storeVerificationToken(user.id, resetToken, 'password_reset');

    // TODO: Send password reset email
    logger.info('Password reset token generated', { userId: user.id });
  }

  /**
   * Reset password
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    logger.info('Resetting password');

    const userId = await this.getVerificationTokenUserId(dto.token, 'password_reset');
    if (!userId) {
      throw new ValidationError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await BcryptUtil.hash(dto.newPassword);

    // Update password
    await this.authRepository.updatePassword(userId, passwordHash);

    // Delete reset token
    await this.deleteVerificationToken(dto.token, 'password_reset');

    // Revoke all sessions for security
    await this.authRepository.revokeAllUserSessions(userId);

    logger.info('Password reset successfully', { userId });
  }

  /**
   * Create user session with tokens
   */
  private async createUserSession(
    user: User,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = JwtUtil.generateAccessToken(tokenPayload);
    const refreshToken = JwtUtil.generateRefreshToken(tokenPayload);

    // Store refresh token in database
    await this.authRepository.createSession({
      userId: user.id,
      refreshToken,
      ipAddress,
      expiresAt: this.getRefreshTokenExpiry(),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Initialize user stats entry
   */
  private async initializeUserStats(userId: string): Promise<void> {
    // This would be in a separate UserStatsRepository
    // For now, we'll just log
    logger.info('User stats initialized', { userId });
  }

  /**
   * Generate verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store verification token in Redis
   */
  private async storeVerificationToken(
    userId: string,
    token: string,
    type: 'email' | 'password_reset'
  ): Promise<void> {
    const key = `verification:${type}:${token}`;
    const expirySeconds = type === 'email' ? 86400 : 3600; // 24h for email, 1h for password
    await RedisClient.set(key, userId, expirySeconds);
  }

  /**
   * Get user ID from verification token
   */
  private async getVerificationTokenUserId(
    token: string,
    type: 'email' | 'password_reset'
  ): Promise<string | null> {
    const key = `verification:${type}:${token}`;
    return await RedisClient.get(key);
  }

  /**
   * Delete verification token
   */
  private async deleteVerificationToken(
    token: string,
    type: 'email' | 'password_reset'
  ): Promise<void> {
    const key = `verification:${type}:${token}`;
    await RedisClient.del(key);
  }

  /**
   * Get refresh token expiry date
   */
  private getRefreshTokenExpiry(): Date {
    const days = 7; // 7 days
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Sanitize user object (remove sensitive data)
   */
  private sanitizeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      isPremium: user.isPremium,
    };
  }
}
