import { z } from 'zod';

export const dayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
