import { z } from 'zod';

export const registrationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  user_type: z.enum(['buyer', 'seller']),
  phone: z.string().optional(),
  company_name: z.string().optional(),
});
