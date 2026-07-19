import { z } from 'zod';

const maxBcryptBytes = 72;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(320)
  .email('Enter a valid email address')
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .refine(
    (password) => Buffer.byteLength(password, 'utf8') <= maxBcryptBytes,
    'Password is too long',
  );

export const playerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(20),
});

export const playersSchema = z.array(playerSchema).min(2).max(50);
