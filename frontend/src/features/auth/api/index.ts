import { apiClient } from '@/lib/api-client';
import type { LoginInput, OtpInput } from '../schemas';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF';
  };
}

export async function login(data: LoginInput): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function requestOtp(email: string): Promise<{ success: boolean; message: string }> {
  return apiClient('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtpReset(
  data: OtpInput & { newPassword: string },
): Promise<{ success: boolean }> {
  return apiClient('/auth/otp/verify-reset', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
