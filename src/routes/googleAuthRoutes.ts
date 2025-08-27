import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';
import { UserService } from '../services/userService';
import { getPool } from '../config/database';

const router = Router();
// Web client for web app logins
const webClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
// iOS/macOS client for native app logins
const iosClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || '433143778568-oh3fgg8c16f7bff85unc7ogf9aq3ll2u.apps.googleusercontent.com',
  process.env.GOOGLE_CLIENT_SECRET,
  'com.googleusercontent.apps.433143778568-oh3fgg8c16f7bff85unc7ogf9aq3ll2u:/oauth2redirect'
);
const userService = new UserService();

// Google OAuth login endpoint
router.post('/google', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { credential, clientId } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }

    // Verify the Google token
    const ticket = await webClient.verifyIdToken({
      idToken: credential,
      audience: clientId || process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { email, name, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ error: 'No email in Google account' });
    }

    // Check if user exists
    let user = await userService.findByEmail(email);

    if (!user) {
      // Create new user with Google account
      const result = await getPool().query(
        `INSERT INTO users (email, name, role, google_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [email, name || email.split('@')[0], 'student', googleId]
      );
      user = result.rows[0];
    } else {
      // Update Google ID and picture if not set
      if (!user.google_id) {
        const result = await getPool().query(
          `UPDATE users SET google_id = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [googleId, user.id]
        );
        user = result.rows[0];
      }
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        userId: String(user.id), 
        email: user.email,
        role: user.role,
        organizationId: user.organization_id ? String(user.organization_id) : ''
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { 
        expiresIn: '24h',
        audience: 'student-tracker-api',
        issuer: 'student-tracker'
      }
    );

    const refreshToken = jwt.sign(
      { userId: String(user.id) },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
      { expiresIn: '30d' }
    );

    logger.info(`Google login successful for ${email}`);

    return res.json({
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role,
        profilePicture: null,
        organizationId: user.organization_id ? String(user.organization_id) : null,
        gradeLevel: null
      },
      accessToken,
      refreshToken,
      expiresIn: 86400 // 24 hours in seconds
    });

  } catch (error) {
    logger.error('Google auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// Exchange authorization code for tokens (for native apps)
router.post('/google/exchange', async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log('[GoogleAuth] Exchange request received');
    const { code } = req.body;
    console.log('[GoogleAuth] Authorization code:', code?.substring(0, 20) + '...');

    if (!code) {
      console.log('[GoogleAuth] No authorization code provided');
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    console.log('[GoogleAuth] Attempting to exchange code for tokens...');
    // Exchange code for tokens using iOS client
    const { tokens } = await iosClient.getToken(code);

    if (!tokens.id_token) {
      return res.status(401).json({ error: 'No ID token received' });
    }

    // Verify the ID token
    const ticket = await iosClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID || '433143778568-oh3fgg8c16f7bff85unc7ogf9aq3ll2u.apps.googleusercontent.com'
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Process same as above
    const { email, name, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ error: 'No email in Google account' });
    }

    // Check if user exists
    let user = await userService.findByEmail(email);

    if (!user) {
      // Create new user with Google account
      const result = await getPool().query(
        `INSERT INTO users (email, name, role, google_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [email, name || email.split('@')[0], 'student', googleId]
      );
      user = result.rows[0];
    } else {
      // Update Google ID and picture if not set
      if (!user.google_id) {
        const result = await getPool().query(
          `UPDATE users SET google_id = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [googleId, user.id]
        );
        user = result.rows[0];
      }
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        userId: String(user.id), 
        email: user.email,
        role: user.role,
        organizationId: user.organization_id ? String(user.organization_id) : ''
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { 
        expiresIn: '24h',
        audience: 'student-tracker-api',
        issuer: 'student-tracker'
      }
    );

    const refreshToken = jwt.sign(
      { userId: String(user.id) },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
      { expiresIn: '30d' }
    );

    logger.info(`Google login successful for ${email} (native app)`);

    return res.json({
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role,
        profilePicture: null,
        organizationId: user.organization_id ? String(user.organization_id) : null,
        gradeLevel: null
      },
      accessToken,
      refreshToken,
      expiresIn: 86400 // 24 hours in seconds
    });

  } catch (error) {
    console.error('[GoogleAuth] Exchange error:', error);
    logger.error('Google auth exchange error:', error);
    
    // Return more specific error info for debugging
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

export default router;