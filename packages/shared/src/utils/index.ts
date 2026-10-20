import type { BusinessHoursEntry } from '../schemas/business';
import type { DayOfWeek } from '../enums';

const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const KARACHI_TIME_ZONE = 'Asia/Karachi';

/** Formats integer paisa as a PKR display string, e.g. `125000` -> `"Rs 1,250"`. */
export function formatPKR(amountInPaisa: number): string {
  const rupees = amountInPaisa / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(rupees);
  return `Rs ${formatted}`;
}

/** Formats a stored `+92XXXXXXXXXX` number for display, e.g. `"+92 300 1234567"`. */
export function formatPhonePK(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }
  const match = /^\+92(\d{3})(\d{7})$/.exec(phone);
  if (!match) {
    return phone;
  }
  return `+92 ${match[1]} ${match[2]}`;
}

/** Builds a `tel:` href from a stored `+92XXXXXXXXXX` number. */
export function toTelHref(phone: string | null | undefined): string | null {
  return phone ? `tel:${phone}` : null;
}

/**
 * Normalizes a Pakistani (or already-international) phone number to the digit-only format `wa.me`
 * expects, e.g. `"0300 1234567"` and `"+92 300 1234567"` both -> `"923001234567"`. Returns null when the
 * input has no digits or is not a plausible international number (8-15 digits).
 */
export function normalizePhoneForWhatsApp(
  phone: string | null | undefined,
): string | null {
  if (!phone) {
    return null;
  }
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!hasPlus && digits.startsWith('0')) {
    digits = `92${digits.slice(1)}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Strict Pakistan mobile/landline check on user input: normalizes to `92` + 10 digits. */
export function isValidPhonePK(phone: string): boolean {
  return /^92\d{10}$/.test(normalizePhoneForWhatsApp(phone) ?? '');
}

/** Converts a PK number in any common input format to the stored `+92XXXXXXXXXX` form, or null if invalid. */
export function toStoredPhonePK(phone: string): string | null {
  const digits = normalizePhoneForWhatsApp(phone);
  return digits && /^92\d{10}$/.test(digits) ? `+${digits}` : null;
}

/**
 * Picks the number to contact a business on WhatsApp: its dedicated `whatsapp` number when set, else
 * its `phone`. Returns the `wa.me` digit string, or null when neither yields a usable number.
 */
export function getWhatsAppTarget(business: {
  whatsapp?: string | null;
  phone?: string | null;
}): string | null {
  return (
    normalizePhoneForWhatsApp(business.whatsapp) ??
    normalizePhoneForWhatsApp(business.phone)
  );
}

/** Builds `https://wa.me/<digits>?text=<message>`. */
export function buildWhatsAppHref(digits: string, message: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function karachiPartsAt(date: Date): { dayOfWeek: DayOfWeek; time: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KARACHI_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const weekday =
    parts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return {
    dayOfWeek: weekday.toUpperCase() as DayOfWeek,
    time: `${hour}:${minute}`,
  };
}

function previousDay(day: DayOfWeek): DayOfWeek {
  const index = DAY_ORDER.indexOf(day);
  return (
    DAY_ORDER[(index + DAY_ORDER.length - 1) % DAY_ORDER.length] ?? 'SUNDAY'
  );
}

/**
 * Display-only "open now" check mirroring the API's Asia/Karachi + overnight-window logic
 * (see docs/09-search-discovery.md). Never the source of truth — search results and badges
 * must use the server-computed value from the API payload.
 */
export function isOpenNow(
  hours: BusinessHoursEntry[],
  at: Date = new Date(),
): boolean {
  const { dayOfWeek: todayDow, time: nowTime } = karachiPartsAt(at);
  const yesterdayDow = previousDay(todayDow);

  const today = hours.find((entry) => entry.dayOfWeek === todayDow);
  if (today && !today.isClosed && today.opensAt && today.closesAt) {
    if (today.opensAt <= today.closesAt) {
      if (today.opensAt <= nowTime && nowTime <= today.closesAt) {
        return true;
      }
    } else if (nowTime >= today.opensAt) {
      return true;
    }
  }

  const yesterday = hours.find((entry) => entry.dayOfWeek === yesterdayDow);
  if (
    yesterday &&
    !yesterday.isClosed &&
    yesterday.opensAt &&
    yesterday.closesAt &&
    yesterday.opensAt > yesterday.closesAt &&
    nowTime <= yesterday.closesAt
  ) {
    return true;
  }

  return false;
}
