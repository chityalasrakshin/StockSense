import { z } from 'zod';

export const RoleEnum = z.enum(['INVENTORY_MANAGER', 'WAREHOUSE_STAFF']);
export type UserRole = z.infer<typeof RoleEnum>;

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    role: RoleEnum.default('WAREHOUSE_STAFF'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const otpRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const otpResetSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    otp: z.string().length(6, 'Verification code must be 6 digits'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .optional()
    .or(z.literal('')),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpResetInput = z.infer<typeof otpResetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type OtpInput = { email: string; otp: string };
