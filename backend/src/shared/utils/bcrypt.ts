import bcrypt from 'bcrypt';

/**
 * Password hashing utilities using bcrypt
 */
export class BcryptUtil {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a plain text password
   */
  static async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hash
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
