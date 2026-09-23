import { z } from 'zod';

export const priceTierSchema = z.enum(['ONE', 'TWO', 'THREE', 'FOUR']);

export type PriceTier = z.infer<typeof priceTierSchema>;
