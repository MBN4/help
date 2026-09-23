import type { DayOfWeek } from '@buisnez/database';

const WEEKDAY_TO_DOW: Record<string, DayOfWeek> = {
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
  Sunday: 'SUNDAY',
};

const DOW_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export interface KarachiNow {
  todayDow: DayOfWeek;
  yesterdayDow: DayOfWeek;
  nowTime: string;
}

/** "Now" as Asia/Karachi wall-clock time, regardless of the DB/process timezone. */
export function getKarachiNow(date: Date = new Date()): KarachiNow {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday =
    parts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const rawHour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour;

  const todayDow = WEEKDAY_TO_DOW[weekday] ?? 'MONDAY';
  const todayIndex = DOW_ORDER.indexOf(todayDow);
  const yesterdayDow = DOW_ORDER[(todayIndex + 6) % 7] ?? 'SUNDAY';

  return { todayDow, yesterdayDow, nowTime: `${hour}:${minute}` };
}
