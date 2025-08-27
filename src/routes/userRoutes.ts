import { Router } from 'express';
import Joi from 'joi';
import { UserController } from '../controllers/userController';
import { validate } from '../middlewares/validate';
import { authenticate, authorize, authorizeUser } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const userController = new UserController();

// Validation schemas
const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    role: Joi.string().valid('student', 'teacher', 'admin').required(),
    gradeLevel: Joi.number().min(1).max(12).when('role', {
      is: 'student',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    settings: Joi.object().optional()
  })
};

const updateUserSchema = {
  body: Joi.object({
    email: Joi.string().email().optional(),
    role: Joi.string().valid('student', 'teacher', 'admin').optional(),
    gradeLevel: Joi.number().min(1).max(12).optional(),
    settings: Joi.object().optional()
  }).min(1)
};

const changePasswordSchema = {
  body: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
  })
};

const listUsersSchema = {
  query: Joi.object({
    role: Joi.string().valid('student', 'teacher', 'admin').optional(),
    gradeLevel: Joi.number().min(1).max(12).optional(),
    limit: Joi.number().min(1).max(100).default(50),
    offset: Joi.number().min(0).default(0)
  })
};

// All routes require authentication
router.use(authenticate);

// List users (teachers and admins only)
router.get('/',
  authorize('teacher', 'admin'),
  validate(listUsersSchema),
  asyncHandler(userController.listUsers)
);

// Create user (admins only)
router.post('/',
  authorize('admin'),
  validate(createUserSchema),
  asyncHandler(userController.createUser)
);

// Get user by ID
router.get('/:userId',
  authorizeUser('userId'),
  asyncHandler(userController.getUser)
);

// Update user
router.put('/:userId',
  authorizeUser('userId'),
  validate(updateUserSchema),
  asyncHandler(userController.updateUser)
);

// Delete user (admins only)
router.delete('/:userId',
  authorize('admin'),
  asyncHandler(userController.deleteUser)
);

// Change password (users can change their own)
router.post('/:userId/change-password',
  authorizeUser('userId'),
  validate(changePasswordSchema),
  asyncHandler(userController.changePassword)
);

// Get user's devices
router.get('/:userId/devices',
  authorizeUser('userId'),
  asyncHandler(userController.getUserDevices)
);

// Get user's activity summary
router.get('/:userId/activity-summary',
  authorizeUser('userId'),
  asyncHandler(userController.getActivitySummary)
);


export default router;