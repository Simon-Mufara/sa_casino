import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtUtil, TokenPayload } from '../../shared/utils/jwt';
import { logger } from '../../shared/utils/logger';
import { GameState, Move } from '../game-engine/game-state.interface';
import { GameEngineService } from '../game-engine/game-engine.service';
import { UnauthorizedError } from '../../shared/errors/app-error';

/**
 * Match Room Interface
 */
interface MatchRoom {
  matchId: string;
  gameState: GameState;
  players: Map<string, { socketId: string; playerId: string; connected: boolean }>;
  spectators: Set<string>;
  createdAt: Date;
}

/**
 * WebSocket Gateway
 * Handles real-time communication for matches
 */
export class WebSocketGateway {
  private io: SocketIOServer;
  private rooms: Map<string, MatchRoom>;
  private socketToUser: Map<string, TokenPayload>;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.rooms = new Map();
    this.socketToUser = new Map();
    this.initialize();
  }

  /**
   * Initialize WebSocket handlers
   */
  private initialize(): void {
    this.io.use(this.authMiddleware.bind(this));

    this.io.on('connection', (socket: Socket) => {
      const user = this.socketToUser.get(socket.id);
      logger.info('Client connected', { socketId: socket.id, userId: user?.userId });

      // Match events
      socket.on('join_match', (data) => this.handleJoinMatch(socket, data));
      socket.on('leave_match', (data) => this.handleLeaveMatch(socket, data));
      socket.on('make_move', (data) => this.handleMakeMove(socket, data));
      socket.on('request_state', (data) => this.handleRequestState(socket, data));

      // Chat events
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));

      // Disconnect
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });

    logger.info('WebSocket gateway initialized');
  }

  /**
   * Authentication middleware for Socket.IO
   */
  private authMiddleware(socket: Socket, next: (err?: Error) => void): void {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = JwtUtil.verifyAccessToken(token);
      this.socketToUser.set(socket.id, payload);

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  }

  /**
   * Handle player joining a match
   */
  private handleJoinMatch(socket: Socket, data: { matchId: string }): void {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { matchId } = data;

    logger.info('Player joining match', {
      matchId,
      playerId: user.userId,
      socketId: socket.id,
    });

    // Join Socket.IO room
    socket.join(matchId);

    // Update room tracking
    let room = this.rooms.get(matchId);
    if (!room) {
      // Room doesn't exist yet - will be created when game starts
      logger.warn('Match room not found', { matchId });
      socket.emit('error', { message: 'Match not found' });
      return;
    }

    // Update player connection status
    const player = room.players.get(user.userId);
    if (player) {
      player.socketId = socket.id;
      player.connected = true;
    }

    // Send current game state to player
    socket.emit('game_state', room.gameState);

    // Notify other players
    socket.to(matchId).emit('player_joined', {
      playerId: user.userId,
      username: user.username,
    });

    logger.info('Player joined match', { matchId, playerId: user.userId });
  }

  /**
   * Handle player leaving a match
   */
  private handleLeaveMatch(socket: Socket, data: { matchId: string }): void {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { matchId } = data;

    logger.info('Player leaving match', { matchId, playerId: user.userId });

    socket.leave(matchId);

    const room = this.rooms.get(matchId);
    if (room) {
      const player = room.players.get(user.userId);
      if (player) {
        player.connected = false;
      }

      // Notify other players
      socket.to(matchId).emit('player_left', {
        playerId: user.userId,
        username: user.username,
      });
    }
  }

  /**
   * Handle player making a move
   */
  private handleMakeMove(socket: Socket, data: { matchId: string; move: Move }): void {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { matchId, move } = data;

    logger.info('Player making move', {
      matchId,
      playerId: user.userId,
      moveType: move.moveType,
    });

    const room = this.rooms.get(matchId);
    if (!room) {
      socket.emit('error', { message: 'Match not found' });
      return;
    }

    // Ensure move is from authenticated user
    if (move.playerId !== user.userId) {
      socket.emit('error', { message: 'Invalid move: not your turn' });
      return;
    }

    // Execute move
    const result = GameEngineService.executeMove(move, room.gameState);

    if (result.success && result.newState) {
      // Update room state
      room.gameState = result.newState;

      // Broadcast new state to all players
      this.io.to(matchId).emit('game_state', result.newState);

      // Broadcast move event
      this.io.to(matchId).emit('move_made', {
        playerId: user.userId,
        move,
        result,
      });

      logger.info('Move executed successfully', { matchId, playerId: user.userId });
    } else {
      // Send error to player
      socket.emit('move_error', {
        message: result.message || 'Invalid move',
      });

      logger.warn('Move failed', {
        matchId,
        playerId: user.userId,
        error: result.message,
      });
    }
  }

  /**
   * Handle player requesting current state
   */
  private handleRequestState(socket: Socket, data: { matchId: string }): void {
    const { matchId } = data;

    const room = this.rooms.get(matchId);
    if (room) {
      socket.emit('game_state', room.gameState);
    } else {
      socket.emit('error', { message: 'Match not found' });
    }
  }

  /**
   * Handle chat message
   */
  private handleSendMessage(socket: Socket, data: { matchId: string; message: string }): void {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { matchId, message } = data;

    logger.info('Chat message', { matchId, playerId: user.userId });

    // Broadcast message to match room
    this.io.to(matchId).emit('chat_message', {
      playerId: user.userId,
      username: user.username,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const user = this.socketToUser.get(socket.id);

    logger.info('Client disconnected', {
      socketId: socket.id,
      userId: user?.userId,
    });

    // Find all rooms this socket is in and mark player as disconnected
    for (const [matchId, room] of this.rooms.entries()) {
      if (user) {
        const player = room.players.get(user.userId);
        if (player && player.socketId === socket.id) {
          player.connected = false;

          // Notify other players
          socket.to(matchId).emit('player_disconnected', {
            playerId: user.userId,
            username: user.username,
          });
        }
      }
    }

    // Clean up
    this.socketToUser.delete(socket.id);
  }

  /**
   * Create a new match room
   */
  createRoom(matchId: string, gameState: GameState): void {
    const room: MatchRoom = {
      matchId,
      gameState,
      players: new Map(),
      spectators: new Set(),
      createdAt: new Date(),
    };

    // Initialize player tracking
    for (const player of gameState.config.players) {
      room.players.set(player.id, {
        socketId: '',
        playerId: player.id,
        connected: false,
      });
    }

    this.rooms.set(matchId, room);

    logger.info('Match room created', { matchId, playerCount: room.players.size });
  }

  /**
   * Remove a match room
   */
  removeRoom(matchId: string): void {
    this.rooms.delete(matchId);
    logger.info('Match room removed', { matchId });
  }

  /**
   * Get room by match ID
   */
  getRoom(matchId: string): MatchRoom | undefined {
    return this.rooms.get(matchId);
  }

  /**
   * Broadcast event to match room
   */
  broadcastToRoom(matchId: string, event: string, data: any): void {
    this.io.to(matchId).emit(event, data);
  }
}
