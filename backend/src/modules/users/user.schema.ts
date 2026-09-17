import { z } from 'zod';

export const userRoleZodEnum = z.enum(['owner', 'admin', 'manager', 'agent', 'accountant', 'viewer', 'customer']);
export const userStatusZodEnum = z.enum(['active', 'inactive', 'invited', 'suspended']);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['admin', 'manager', 'agent', 'accountant', 'viewer', 'customer'], 'Invalid role. Choose from: admin, manager, agent, accountant, viewer, customer'),
  permissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: userRoleZodEnum.optional(),
  status: userStatusZodEnum.optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  permissions: z.array(z.string()).optional(),
});

export const generateCustomerSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GenerateCustomerInput = z.infer<typeof generateCustomerSchema>;
