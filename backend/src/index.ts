import 'reflect-metadata';
import express, { Application } from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { logger } from './shared/utils/logger';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found-handler';
import { setupRoutes } from './routes';
import { DatabaseConnection } from './database/connection';
import { RedisClient } from './database/redis-client';

class Application {
  private app: Application;
  private server: http.Server;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
      },
    });
  }

  /**
   * Initialize application middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: config.cors.credentials,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (config.env !== 'test') {
      this.app.use(morgan('combined', { stream: logger.stream }));
    }

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  /**
   * Connect to databases
   */
  private async connectDatabases(): Promise<void> {
    try {
      // Connect to PostgreSQL
      await DatabaseConnection.connect();
      logger.info('PostgreSQL connected successfully');

      // Connect to Redis
      await RedisClient.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Database connection error:', error);
      throw error;
    }
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    setupRoutes(this.app, this.io);

    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Setup WebSocket handlers
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    try {
      // Connect to databases
      await this.connectDatabases();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup WebSocket
      this.setupWebSocket();

      // Start server
      this.server.listen(config.port, () => {
        logger.info(`Server running on port ${config.port} in ${config.env} mode`);
        logger.info(`WebSocket server ready`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);

      this.server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await DatabaseConnection.disconnect();
          await RedisClient.disconnect();
          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start application
const app = new Application();
app.start();

export default app;
