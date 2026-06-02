import { SocialRepository, FriendRequest } from './social.repository';
import { AppError } from '../../shared/errors/app-error';

/**
 * Social Service
 * Business logic for social features (friends)
 */
export class SocialService {
  private socialRepository: SocialRepository;

  constructor() {
    this.socialRepository = new SocialRepository();
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    // Can't send request to yourself
    if (senderId === receiverId) {
      throw new AppError('Cannot send friend request to yourself', 400);
    }

    // Check if already friends
    const areFriends = await this.socialRepository.areFriends(senderId, receiverId);
    if (areFriends) {
      throw new AppError('Already friends with this user', 400);
    }

    // Check if request already exists (either way)
    const existingRequest = await this.socialRepository.findPendingRequest(senderId, receiverId);
    if (existingRequest) {
      throw new AppError('Friend request already sent', 400);
    }

    // Check if reverse request exists (they sent us a request)
    const reverseRequest = await this.socialRepository.findPendingRequest(receiverId, senderId);
    if (reverseRequest) {
      // Auto-accept if they already sent us a request
      await this.acceptFriendRequest(senderId, reverseRequest.id);
      return reverseRequest;
    }

    return this.socialRepository.sendFriendRequest(senderId, receiverId);
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.socialRepository.getFriendRequest(requestId);

    if (!request) {
      throw new AppError('Friend request not found', 404);
    }

    // Only receiver can accept
    if (request.receiverId !== userId) {
      throw new AppError('You cannot accept this friend request', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('Friend request is not pending', 400);
    }

    // Update request status
    await this.socialRepository.acceptFriendRequest(requestId);

    // Create friendship
    await this.socialRepository.createFriendship(request.senderId, request.receiverId);
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.socialRepository.getFriendRequest(requestId);

    if (!request) {
      throw new AppError('Friend request not found', 404);
    }

    // Only receiver can reject
    if (request.receiverId !== userId) {
      throw new AppError('You cannot reject this friend request', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('Friend request is not pending', 400);
    }

    await this.socialRepository.rejectFriendRequest(requestId);
  }

  /**
   * Cancel sent friend request
   */
  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.socialRepository.getFriendRequest(requestId);

    if (!request) {
      throw new AppError('Friend request not found', 404);
    }

    // Only sender can cancel
    if (request.senderId !== userId) {
      throw new AppError('You cannot cancel this friend request', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('Friend request is not pending', 400);
    }

    await this.socialRepository.rejectFriendRequest(requestId);
  }

  /**
   * Remove friend
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    const areFriends = await this.socialRepository.areFriends(userId, friendId);

    if (!areFriends) {
      throw new AppError('You are not friends with this user', 400);
    }

    await this.socialRepository.removeFriendship(userId, friendId);
  }

  /**
   * Get user's friends list
   */
  async getFriends(userId: string): Promise<any[]> {
    return this.socialRepository.getFriends(userId);
  }

  /**
   * Get pending friend requests (received)
   */
  async getPendingRequests(userId: string): Promise<any[]> {
    const requests = await this.socialRepository.getPendingRequests(userId);

    // TODO: Enhance with sender user details
    return requests.map(req => ({
      id: req.id,
      senderId: req.senderId,
      status: req.status,
      createdAt: req.createdAt,
    }));
  }

  /**
   * Get sent friend requests
   */
  async getSentRequests(userId: string): Promise<any[]> {
    const requests = await this.socialRepository.getSentRequests(userId);

    // TODO: Enhance with receiver user details
    return requests.map(req => ({
      id: req.id,
      receiverId: req.receiverId,
      status: req.status,
      createdAt: req.createdAt,
    }));
  }

  /**
   * Get friend count
   */
  async getFriendCount(userId: string): Promise<number> {
    return this.socialRepository.getFriendCount(userId);
  }

  /**
   * Check if users are friends
   */
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    return this.socialRepository.areFriends(userId, friendId);
  }
}
