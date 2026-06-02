import { z } from 'zod';

/**
 * Registration DTO Schema
 */
export const RegisterDtoSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  countryCode: z.string().length(2, 'Country code must be 2 characters').toUpperCase(),
  preferredLanguage: z.string().length(2, 'Language code must be 2 characters').default('en'),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

/**
 * Login DTO Schema
 */
export const LoginDtoSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

/**
 * Refresh Token DTO Schema
 */
export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

/**
 * Verify Email DTO Schema
 */
export const VerifyEmailDtoSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailDtoSchema>;

/**
 * Forgot Password DTO Schema
 */
export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

/**
 * Reset Password DTO Schema
 */
export const ResetPasswordDtoSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;
