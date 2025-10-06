import { z } from 'zod';

export const registrationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password_hash: z.string().min(6),
  user_type: z.enum(['buyer', 'seller']),
  phone: z.string().nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
});
