import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const authController = new AuthController();

/**
 * Authentication Routes
 * Base path: /api/auth
 */

// Register a new user
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Refresh access token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authController.logout);

// Verify email
router.post('/verify-email', authController.verifyEmail);

// Request password reset
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

export default router;
