import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/authService';
import { logger } from '../config/logger';
import { AlertService } from '../services/alertService';

export function setupSocketHandlers(io: Server) {
  // Set the socket server in AlertService
  AlertService.setSocketServer(io);
  
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const { userId, organizationId } = socket.handshake.query;
      
      // Log what we're receiving
      logger.info('[WebSocket Auth] Handshake:', {
        auth: socket.handshake.auth,
        headers: socket.handshake.headers,
        query: socket.handshake.query
      });
      
      // Check if auth comes from query params (StudentTimeTracker)
      if (userId && typeof userId === 'string') {
        (socket as any).user = { 
          userId, 
          role: 'student', 
          organizationId: organizationId || '1' 
        };
        
        // Join rooms immediately
        socket.join(`org:${organizationId || '1'}`);
        socket.join(`user:${userId}`);
        
        logger.info(`[WebSocket] Authenticated user ${userId} from query params`);
        
        // Emit student connected event
        io.to(`org:${organizationId || '1'}`).emit('student:connected', userId);
        
        return next();
      }
      
      // Allow connection without token for now (admin dashboard)
      if (!token) {
        (socket as any).user = { userId: 'anonymous', role: 'admin', organizationId: 'default' };
        return next();
      }
      
      // Verify token
      try {
        const payload = AuthService.verifyToken(token);
        
        // Attach user info to socket
        (socket as any).user = payload;
        
        // Join organization room
        socket.join(`org:${payload.organizationId}`);
        
        // Join user-specific room
        socket.join(`user:${payload.userId}`);
        
        logger.info(`[WebSocket] Authenticated user ${payload.userId}`);
        next();
      } catch (tokenError) {
        logger.error('[WebSocket Auth] Token verification failed:', tokenError);
        // For now, allow connection with anonymous user
        (socket as any).user = { userId: 'anonymous', role: 'admin', organizationId: 'default' };
        next();
      }
    } catch (error) {
      logger.error('[WebSocket Auth] Connection error:', error);
      // Allow connection anyway
      (socket as any).user = { userId: 'anonymous', role: 'admin', organizationId: 'default' };
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`User ${user.userId} connected via WebSocket`);
    
    // Send test message on connection
    socket.emit('test', { message: 'Welcome! WebSocket connection established', timestamp: new Date() });
    
    // Send existing alerts on connection
    const { getRecentAlerts } = require('../routes/alertRoutes');
    const recentAlerts = getRecentAlerts();
    socket.emit('alerts:initial', recentAlerts);
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      socket.emit('ping');
    }, 25000); // Ping every 25 seconds
    
    // Log all incoming events for debugging
    socket.onAny((event, ...args) => {
      logger.info(`[WebSocket] Received event: ${event}`, { args });
    });
    
    // Handle authentication event from StudentTimeTracker
    socket.on('auth', async (authData) => {
      try {
        logger.info('[WebSocket] Auth event received:', authData);
        
        if (authData.token) {
          try {
            const payload = AuthService.verifyToken(authData.token);
            (socket as any).user = payload;
            
            // Join rooms
            socket.join(`org:${payload.organizationId}`);
            socket.join(`user:${payload.userId}`);
            
            logger.info(`[WebSocket] User ${payload.userId} authenticated via auth event`);
            socket.emit('auth:success', { userId: payload.userId });
            
            // Notify admins that student is connected
            if (payload.role === 'student') {
              io.to(`org:${payload.organizationId}`).emit('student:connected', payload.userId);
            }
          } catch (error) {
            logger.error('[WebSocket] Auth event token verification failed:', error);
            socket.emit('auth:error', { message: 'Invalid token' });
          }
        } else if (authData.userId) {
          // Direct userId auth (for StudentTimeTracker)
          (socket as any).user = {
            userId: authData.userId,
            role: 'student',
            organizationId: authData.organizationId || '1'
          };
          
          socket.join(`org:${authData.organizationId || '1'}`);
          socket.join(`user:${authData.userId}`);
          
          logger.info(`[WebSocket] User ${authData.userId} authenticated directly`);
          socket.emit('auth:success', { userId: authData.userId });
          
          // Notify admins that student is connected
          io.to(`org:${authData.organizationId || '1'}`).emit('student:connected', authData.userId);
        }
      } catch (error) {
        logger.error('[WebSocket] Auth event error:', error);
        socket.emit('auth:error', { message: 'Authentication failed' });
      }
    });

    // Handle real-time activity from macOS app
    socket.on('activity:realtime', async (activity) => {
      try {
        const userId = user.userId;
        logger.info(`[Realtime] Activity from ${userId}: ${activity.app_name}`);
        
        // Import services
        const { ProductivityService } = require('../services/productivityService');
        const { getPool } = require('../config/database');
        const { activeStudentService } = require('../services/activeStudentService');
        
        // Categorize activity
        const productivity = await ProductivityService.categorizeActivity(
          activity.app_name,
          activity.url,
          activity.window_title,
          userId
        );
        
        // Mark student as active
        activeStudentService.markStudentActive(userId, activity.app_name, productivity.category);

        // Check for alerts
        const activityWithUser = {
          ...activity,
          userId,
          deviceId: socket.id
        };
        
        await AlertService.checkForAlerts([activityWithUser]);

        // Broadcast to all connected clients
        io.emit('activity:update', {
          userId,
          activity: {
            ...activity,
            category: productivity.category,
            productivity_score: productivity.category === 'productive' ? 0.8 : 
                               productivity.category === 'distracting' ? 0.2 : 0.5
          }
        });

        // Store in database
        const pool = getPool();
        const startTime = new Date(activity.start_time || new Date());
        const endTime = new Date(startTime.getTime() + ((activity.duration || 1) * 1000));
        
        await pool.query(`
          INSERT INTO activities (
            user_id, device_id, start_time, end_time, 
            app_name, window_title, url, 
            duration, is_idle, subject_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `, [
          userId,
          socket.id,
          startTime,
          endTime,
          activity.app_name,
          activity.window_title || null,
          activity.url || null,
          Math.round((endTime.getTime() - startTime.getTime()) / 1000), // duration in seconds
          activity.is_idle || false,
          null // subject_id - will be handled separately
        ]);

      } catch (error) {
        logger.error('Error processing real-time activity:', error);
        socket.emit('error', { message: 'Failed to process activity' });
      }
    });

    // Handle activity updates (legacy)
    socket.on('activity:update', async (data) => {
      // TODO: Process and broadcast activity updates
      logger.debug('Activity update received:', data);
    });

    // Handle real-time alerts subscription
    socket.on('alerts:subscribe', async (filters) => {
      // TODO: Subscribe to filtered alerts
      logger.debug('Alert subscription:', filters);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
      logger.info(`User ${user.userId} disconnected from WebSocket`);
      
      // Notify admins that student is disconnected
      if (user.role === 'student' && user.userId !== 'anonymous') {
        io.to(`org:${user.organizationId}`).emit('student:disconnected', user.userId);
      }
    });
  });

  // Utility functions for broadcasting
  return {
    // Broadcast to organization
    broadcastToOrganization(organizationId: string, event: string, data: any) {
      io.to(`org:${organizationId}`).emit(event, data);
    },

    // Send to specific user
    sendToUser(userId: string, event: string, data: any) {
      io.to(`user:${userId}`).emit(event, data);
    },

    // Broadcast alert
    broadcastAlert(organizationId: string, alert: any) {
      io.to(`org:${organizationId}`).emit('alert:new', alert);
    }
  };
}