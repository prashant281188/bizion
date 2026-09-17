import api from '../api';
import { API_ROUTES } from '../constants';

export interface User {
  id: string;
  orgId: string;
  contactId?: string | null;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'accountant' | 'viewer' | 'customer';
  permissions?: string[];
  status: 'active' | 'inactive' | 'invited' | 'suspended';
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
}

export interface PermissionModule {
  module: string;
  label: string;
  permissions: PermissionDefinition[];
}

export interface PermissionsListResponse {
  modules: PermissionModule[];
  roleDefaults: Record<string, string[]>;
}

export const userService = {
  /**
   * Retrieves a list of all users in the organization
   */
  async listUsers(searchQuery?: string, type?: 'operational' | 'portal'): Promise<User[]> {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (type) params.type = type;
    
    const response = await api.get(API_ROUTES.USERS.BASE, { params });
    return response.data.data;
  },

  /**
   * Retrieves available permissions list
   */
  async getPermissionsList(): Promise<PermissionsListResponse> {
    const response = await api.get(API_ROUTES.USERS.PERMISSIONS);
    return response.data.data;
  },

  /**
   * Creates a new user in the organization
   */
  async createUser(data: { email: string; firstName: string; lastName?: string; role: string; permissions?: string[] }): Promise<User & { tempPassword?: string }> {
    const response = await api.post(API_ROUTES.USERS.CREATE, data);
    return response.data.data;
  },

  /**
   * Updates an existing user's role or details
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await api.put(API_ROUTES.USERS.BY_ID(userId), data);
    return response.data.data;
  },

  /**
   * Resets a user's password directly (Admin action)
   */
  async resetPassword(userId: string, password: string): Promise<void> {
    await api.put(API_ROUTES.USERS.BY_ID(userId), { password });
  },

  /**
   * Deactivates a user from the organization
   */
  async deactivateUser(userId: string): Promise<void> {
    await api.delete(API_ROUTES.USERS.BY_ID(userId));
  },
};
