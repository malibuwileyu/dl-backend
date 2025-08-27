import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { NotFoundError } from '../middlewares/errorHandler';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * GET /users
   */
  listUsers = async (req: Request, res: Response) => {
    const { role, limit, offset } = req.query;
    
    const result = await this.userService.listByOrganization(
      req.user!.organizationId,
      {
        role: role as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );
    
    res.json(result);
  };

  /**
   * POST /users
   */
  createUser = async (req: Request, res: Response) => {
    const { email, password, role } = req.body;
    
    const user = await this.userService.create({
      email,
      password,
      organizationId: req.user!.organizationId,
      role
    });
    
    res.status(201).json(user);
  };

  /**
   * GET /users/:userId
   */
  getUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const user = await this.userService.findById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    res.json(user);
  };

  /**
   * PUT /users/:userId
   */
  updateUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const updateData = req.body;
    
    const user = await this.userService.update(userId, updateData);
    
    res.json(user);
  };

  /**
   * DELETE /users/:userId
   */
  deleteUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    await this.userService.delete(userId);
    
    res.status(204).send();
  };

  /**
   * POST /users/:userId/change-password
   */
  changePassword = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { oldPassword, newPassword } = req.body;
    
    await this.userService.changePassword(userId, oldPassword, newPassword);
    
    res.json({ message: 'Password changed successfully' });
  };

  /**
   * GET /users/:userId/devices
   */
  getUserDevices = async (_req: Request, res: Response) => {
    // TODO: Implement when device service is ready
    res.json({ devices: [] });
  };

  /**
   * GET /users/:userId/activity-summary
   */
  getActivitySummary = async (_req: Request, res: Response) => {
    // TODO: Implement when activity service is ready
    res.json({ 
      totalTime: 0,
      productiveTime: 0,
      distractingTime: 0,
      topApplications: [],
      topWebsites: []
    });
  };
}