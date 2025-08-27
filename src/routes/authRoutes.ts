import { Router } from 'express';
import Joi from 'joi';
import { AuthController } from '../controllers/authController';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const authController = new AuthController();

// Validation schemas
const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    deviceId: Joi.string().optional()
  })
};

const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
};

const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      }),
    organizationId: Joi.string().uuid().required(),
    role: Joi.string().valid('student', 'teacher').required(),
    gradeLevel: Joi.number().min(1).max(12).when('role', {
      is: 'student',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// Routes
router.post('/login', 
  validate(loginSchema), 
  asyncHandler(authController.login)
);

router.post('/refresh', 
  validate(refreshSchema), 
  asyncHandler(authController.refreshToken)
);

router.post('/logout', 
  authenticate, 
  asyncHandler(authController.logout)
);

router.post('/register',
  validate(registerSchema),
  asyncHandler(authController.register)
);

router.get('/me',
  authenticate,
  asyncHandler(authController.getCurrentUser)
);

export default router;