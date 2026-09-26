import { apiClient, setAccessToken } from '@/lib/api-client';
import type { LoginInput, SignupInput, OtpResetInput, UpdateProfileInput } from '../schemas';

export interface UserProfile {
  id: string;
  email: string;
  role: 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export async function login(data: LoginInput): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAccessToken(res.accessToken);
  return res;
}

export async function signup(data: Omit<SignupInput, 'confirmPassword'>): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAccessToken(res.accessToken);
  return res;
}

export async function logout(): Promise<{ message: string }> {
  try {
    return await apiClient<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } finally {
    setAccessToken(null);
  }
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const res = await apiClient<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  setAccessToken(res.accessToken);
  return res;
}

export async function requestOtp(email: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtpReset(
  data: Omit<OtpResetInput, 'confirmPassword'>,
): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/auth/otp/verify-reset', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<UserProfile> {
  return apiClient<UserProfile>('/users/me');
}

export async function updateMe(data: UpdateProfileInput): Promise<UserProfile> {
  const payload: Record<string, string> = {};
  if (data.email?.trim()) payload.email = data.email.trim();
  if (data.password?.trim()) payload.password = data.password.trim();

  return apiClient<UserProfile>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
