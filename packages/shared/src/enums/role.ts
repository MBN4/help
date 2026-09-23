import { z } from 'zod';

export const roleSchema = z.enum(['CUSTOMER', 'BUSINESS_OWNER', 'ADMIN']);

export type Role = z.infer<typeof roleSchema>;
