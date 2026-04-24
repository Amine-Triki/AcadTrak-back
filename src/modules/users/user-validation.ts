import { z } from 'zod';

// Password must contain at least one lowercase letter, one uppercase letter, and one digit
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain at least one lowercase letter [a-z]"
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter [A-Z]"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one digit [0-9]"
  );

export const registerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  userName: z.string().min(3, "Username must be at least 3 characters"),
  country: z.string().min(2, "Country must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters").optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters").optional(),
  userName: z.string().min(3, "Username must be at least 3 characters").optional(),
  country: z.string().min(2, "Country must be at least 2 characters").optional(),
  bio: z.string().max(1000, "Bio is too long").optional(),
  avatar: z.url("Avatar must be a valid URL").optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required",
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
