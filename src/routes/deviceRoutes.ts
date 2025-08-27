import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const router = Router();

// Device registration is public (doesn't require auth)
router.post('/register', (req, res) => {
  const { name, type, osVersion } = req.body;
  
  // Generate device ID
  const deviceId = uuidv4();
  
  // Generate tokens
  const jwtSecret = process.env.JWT_SECRET || 'secret';
  
  const accessTokenOptions: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
    issuer: 'student-tracker',
    audience: 'student-tracker-api'
  };
  
  const accessToken = jwt.sign(
    { deviceId, type: 'device' },
    jwtSecret,
    accessTokenOptions
  );
  
  const refreshTokenOptions: jwt.SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
    issuer: 'student-tracker',
    audience: 'student-tracker-api'
  };
  
  const refreshToken = jwt.sign(
    { deviceId, type: 'device' },
    jwtSecret,
    refreshTokenOptions
  );
  
  // In a real app, save device to database here
  
  res.json({
    device: {
      id: deviceId,
      name,
      type,
      osVersion,
      registeredAt: new Date()
    },
    accessToken,
    refreshToken
  });
});

// Other routes require authentication
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ devices: [] });
});

export default router;