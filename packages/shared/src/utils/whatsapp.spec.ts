import {
  buildWhatsAppHref,
  getWhatsAppTarget,
  isValidPhonePK,
  normalizePhoneForWhatsApp,
  toStoredPhonePK,
} from './index';
import { whatsappNumberSchema } from '../schemas/business-owner';

describe('normalizePhoneForWhatsApp', () => {
  it.each([
    ['0300 1234567', '923001234567'],
    ['+92 300 1234567', '923001234567'],
    ['+92-300-1234567', '923001234567'],
    ['923001234567', '923001234567'],
    ['0092 300 1234567', '923001234567'],
    ['+44 20 7946 0958', '442079460958'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhoneForWhatsApp(input)).toBe(expected);
  });

  it.each([null, undefined, '', '   ', 'abc', '123'])(
    'returns null for %p',
    (input) => {
      expect(normalizePhoneForWhatsApp(input)).toBeNull();
    },
  );
});

describe('getWhatsAppTarget', () => {
  it('prefers whatsapp over phone', () => {
    expect(
      getWhatsAppTarget({ whatsapp: '+923001234567', phone: '+923211111111' }),
    ).toBe('923001234567');
  });
  it('falls back to phone', () => {
    expect(getWhatsAppTarget({ whatsapp: null, phone: '+923211111111' })).toBe(
      '923211111111',
    );
  });
  it('falls back to phone when whatsapp is unusable', () => {
    expect(getWhatsAppTarget({ whatsapp: 'n/a', phone: '+923211111111' })).toBe(
      '923211111111',
    );
  });
  it('returns null when neither exists', () => {
    expect(getWhatsAppTarget({ whatsapp: null, phone: null })).toBeNull();
    expect(getWhatsAppTarget({})).toBeNull();
  });
});

describe('PK validation + storage', () => {
  it('validates and stores in +92 form', () => {
    expect(isValidPhonePK('0300 1234567')).toBe(true);
    expect(isValidPhonePK('+44 20 7946 0958')).toBe(false);
    expect(toStoredPhonePK('0300-1234567')).toBe('+923001234567');
    expect(toStoredPhonePK('12345')).toBeNull();
  });
  it('whatsappNumberSchema normalizes and rejects', () => {
    expect(whatsappNumberSchema.parse(' 0300 1234567 ')).toBe('+923001234567');
    expect(whatsappNumberSchema.safeParse('nope').success).toBe(false);
  });
});

describe('buildWhatsAppHref', () => {
  it('encodes the prefilled message', () => {
    expect(buildWhatsAppHref('923001234567', 'Hi, a b?')).toBe(
      'https://wa.me/923001234567?text=Hi%2C%20a%20b%3F',
    );
  });
});
