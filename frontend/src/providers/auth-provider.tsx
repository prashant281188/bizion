'use client';

// ============================================================
// Bizion — Auth Provider
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import api, { setAccessToken } from '@/lib/api';
import { API_ROUTES } from '@/lib/constants';
import type { AuthUser, LoginRequest, RegisterRequest } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (user: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Attempt to refresh token on mount (from httpOnly cookie)
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await api.post(API_ROUTES.AUTH.REFRESH);
      const { accessToken, user: userData } = data.data;
      setAccessToken(accessToken);
      setUser(userData);
      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshToken();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshToken]);

  // Login
  const login = useCallback(async (credentials: LoginRequest): Promise<any> => {
    const { data } = await api.post(API_ROUTES.AUTH.LOGIN, credentials);
    const { accessToken, user: userData } = data.data;
    setAccessToken(accessToken);
    setUser(userData);
    return userData;
  }, []);

  // Register
  const register = useCallback(async (registerData: RegisterRequest): Promise<void> => {
    // Generate a URL-friendly slug from the organization name
    const slug = registerData.organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const apiRegisterData = {
      orgName: registerData.organizationName,
      legalName: registerData.organizationLegalName || registerData.organizationName,
      slug: slug || `org-${Date.now()}`,
      email: registerData.email,
      password: registerData.password,
      firstName: registerData.firstName,
      lastName: registerData.lastName,
      phone: registerData.phone,
    };

    const { data } = await api.post(API_ROUTES.AUTH.REGISTER, apiRegisterData);
    const { accessToken, user: userData } = data.data;
    setAccessToken(accessToken);
    setUser(userData);
  }, []);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post(API_ROUTES.AUTH.LOGOUT);
    } catch {
      // Proceed with local logout even if API fails
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // Update user locally (after profile edit, etc.)
  const updateUser = useCallback((updates: Partial<AuthUser>): void => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  // Check if current user has a specific permission
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'owner' || user.role === 'admin') return true;
    if (!user.permissions || user.permissions.length === 0) return false;
    return user.permissions.includes('*') || user.permissions.includes(permission);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      hasPermission,
      login,
      register,
      logout,
      refreshToken,
      updateUser,
    }),
    [user, isAuthenticated, isLoading, hasPermission, login, register, logout, refreshToken, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
