import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDtoSchema,
  LoginDtoSchema,
  RefreshTokenDtoSchema,
  VerifyEmailDtoSchema,
  ForgotPasswordDtoSchema,
  ResetPasswordDtoSchema,
} from './dto/auth.dto';
import { ValidationError } from '../../shared/errors/app-error';
import { logger } from '../../shared/utils/logger';

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * POST /api/auth/register
   * Register a new user
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = RegisterDtoSchema.parse(req.body);

      // Get client IP
      const ipAddress = req.ip || req.socket.remoteAddress;

      // Register user
      const result = await this.authService.register(dto, ipAddress);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/login
   * Login user
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = LoginDtoSchema.parse(req.body);

      // Get client IP
      const ipAddress = req.ip || req.socket.remoteAddress;

      // Login user
      const result = await this.authService.login(dto, ipAddress);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = RefreshTokenDtoSchema.parse(req.body);

      // Refresh token
      const result = await this.authService.refreshToken(dto);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout
   * Logout user (revoke session)
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
      }

      await this.authService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/verify-email
   * Verify email address
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = VerifyEmailDtoSchema.parse(req.body);

      await this.authService.verifyEmail(dto.token);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = ForgotPasswordDtoSchema.parse(req.body);

      await this.authService.forgotPassword(dto);

      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const dto = ResetPasswordDtoSchema.parse(req.body);

      await this.authService.resetPassword(dto);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
