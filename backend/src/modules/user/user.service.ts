import { UserRepository, UpdateUserProfile, UserStats } from './user.repository';
import { AppError } from '../../shared/errors/app-error';

/**
 * User Service
 * Business logic for user management
 */
export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get user profile by ID
   */
  async getUserById(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Remove sensitive data
    return this.sanitizeUser(user);
  }

  /**
   * Get user profile by username
   */
  async getUserByUsername(username: string): Promise<any> {
    const user = await this.userRepository.findByUsername(username);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Remove sensitive data
    return this.sanitizeUser(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateUserProfile): Promise<any> {
    // Validate username if provided
    if (data.username) {
      this.validateUsername(data.username);

      // Check if username is already taken
      const existingUser = await this.userRepository.findByUsername(data.username);
      if (existingUser && existingUser.id !== userId) {
        throw new AppError('Username already taken', 400);
      }
    }

    // Validate phone number if provided
    if (data.phoneNumber) {
      this.validatePhoneNumber(data.phoneNumber);
    }

    // Validate language if provided
    if (data.preferredLanguage) {
      this.validateLanguage(data.preferredLanguage);
    }

    const updatedUser = await this.userRepository.updateProfile(userId, data);

    if (!updatedUser) {
      throw new AppError('Failed to update user profile', 500);
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const stats = await this.userRepository.getUserStats(userId);

    if (!stats) {
      throw new AppError('User statistics not found', 404);
    }

    return stats;
  }

  /**
   * Search users
   */
  async searchUsers(searchTerm: string, limit: number = 20): Promise<any[]> {
    if (searchTerm.length < 2) {
      throw new AppError('Search term must be at least 2 characters', 400);
    }

    return this.userRepository.searchUsers(searchTerm, limit);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(page: number = 1, pageSize: number = 100): Promise<{ users: any[]; total: number; page: number; pageSize: number }> {
    if (page < 1) {
      throw new AppError('Page must be greater than 0', 400);
    }

    if (pageSize < 1 || pageSize > 100) {
      throw new AppError('Page size must be between 1 and 100', 400);
    }

    const offset = (page - 1) * pageSize;
    const users = await this.userRepository.getLeaderboard(pageSize, offset);

    return {
      users,
      total: 0, // TODO: Get total count from database
      page,
      pageSize,
    };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.updateLastLogin(userId);
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    const deleted = await this.userRepository.deleteAccount(userId);

    if (!deleted) {
      throw new AppError('Failed to delete account', 500);
    }
  }

  /**
   * Remove sensitive user data
   */
  private sanitizeUser(user: any): any {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Validate username format
   */
  private validateUsername(username: string): void {
    if (username.length < 3 || username.length > 20) {
      throw new AppError('Username must be between 3 and 20 characters', 400);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new AppError('Username can only contain letters, numbers, hyphens, and underscores', 400);
    }
  }

  /**
   * Validate phone number format (basic validation)
   */
  private validatePhoneNumber(phoneNumber: string): void {
    if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      throw new AppError('Invalid phone number format', 400);
    }
  }

  /**
   * Validate language code
   */
  private validateLanguage(language: string): void {
    const supportedLanguages = ['en', 'zu', 'xh', 'af', 'st', 'tn'];
    if (!supportedLanguages.includes(language)) {
      throw new AppError('Unsupported language', 400);
    }
  }
}
