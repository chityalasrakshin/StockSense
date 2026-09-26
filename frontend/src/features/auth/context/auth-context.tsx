'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserProfile,
  AuthResponse,
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  getMe as apiGetMe,
  updateMe as apiUpdateMe,
} from '../api';
import type { LoginInput, SignupInput, UpdateProfileInput } from '../schemas';

interface AuthContextType {
  user: UserProfile | null;
  role: 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<AuthResponse>;
  signup: (data: SignupInput) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileInput) => Promise<UserProfile>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    try {
      // Bootstrap from httpOnly refreshToken cookie if present
      await apiRefreshToken();
      const me = await apiGetMe();
      setUser(me);
    } catch {
      // Unauthenticated session
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async (data: LoginInput): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const response = await apiLogin(data);
      setUser(response.user);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (data: SignupInput): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const { confirmPassword: _c, ...rest } = data;
      const response = await apiSignup(rest);
      setUser(response.user);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiLogout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const updateProfile = useCallback(
    async (data: UpdateProfileInput): Promise<UserProfile> => {
      const updated = await apiUpdateMe(data);
      setUser(updated);
      return updated;
    },
    [],
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
