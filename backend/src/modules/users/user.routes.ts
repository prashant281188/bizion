import { Router } from 'express';
import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createUserSchema, updateUserSchema, generateCustomerSchema } from './user.schema.js';

const router = Router();

// Retrieve system permissions definitions
router.get('/permissions-list', authenticate, userController.getPermissionsList);

// Retrieve all active users (accessible by manager and above)
router.get('/', authenticate, requireMinRole('manager'), userController.listUsers);

// Create a new user (requires admin role or above)
router.post('/create', authenticate, requireMinRole('admin'), validate({ body: createUserSchema }), userController.createUser);

// Generate a customer portal user
router.post('/customer', authenticate, requireMinRole('manager'), validate({ body: generateCustomerSchema }), userController.generateCustomer);

// Update own password
router.put('/me/password', authenticate, userController.updateMyPassword);

// Retrieve detailed user profile
router.get('/:id', authenticate, userController.getUser);

// Update user details (requires admin or self update checks inside controller)
router.put('/:id', authenticate, validate({ body: updateUserSchema }), userController.updateUser);

// Deactivate a user account (requires admin role or above)
router.delete('/:id', authenticate, requireMinRole('admin'), userController.deactivateUser);

export default router;
