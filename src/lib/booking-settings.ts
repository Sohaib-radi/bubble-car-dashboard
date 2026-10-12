import type { createClient } from '@/lib/supabase/client';

// Mirrors the 'booking' row of app_settings (supabase/migrations/20261009_settings_capacity.sql).
// The mobile app keeps the same defaults in src/lib/settings.ts — change both together.

export const PERIOD_KEYS = ['morning', 'afternoon', 'evening'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type Period = { key: PeriodKey; start: string; end: string; enabled: boolean };

export type BookingSettings = {
  max_per_day: number | null;
  show_capacity_to_customers: boolean;
  periods: Period[];
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  max_per_day: null,
  show_capacity_to_customers: false,
  periods: [
    { key: 'morning', start: '09:00', end: '12:00', enabled: true },
    { key: 'afternoon', start: '12:00', end: '17:00', enabled: true },
    { key: 'evening', start: '17:00', end: '00:00', enabled: true },
  ],
};

export function withDefaults(value: Partial<BookingSettings> | null | undefined): BookingSettings {
  const periods = PERIOD_KEYS.map(
    (key) =>
      value?.periods?.find((p) => p.key === key) ??
      DEFAULT_BOOKING_SETTINGS.periods.find((p) => p.key === key)!
  );
  return {
    max_per_day: value?.max_per_day ?? null,
    show_capacity_to_customers: value?.show_capacity_to_customers ?? false,
    periods,
  };
}

export async function fetchBookingSettings(
  supabase: ReturnType<typeof createClient>
): Promise<BookingSettings> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'booking').maybeSingle();
  return withDefaults(data?.value as Partial<BookingSettings> | undefined);
}

export function isPeriodKey(v: string | null | undefined): v is PeriodKey {
  return !!v && (PERIOD_KEYS as readonly string[]).includes(v);
}

// Icon names shared with the mobile app (Feather names there, Lucide here).
export const SERVICE_ICONS = [
  'droplet',
  'wind',
  'sun',
  'star',
  'shield',
  'zap',
  'feather',
  'award',
  'thermometer',
  'tool',
  'layers',
  'heart',
] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];

// Default icon when a pack has none set, by pack key.
export function defaultServiceIcon(packKey: string | null): ServiceIcon {
  switch (packKey) {
    case 'exterior':
      return 'droplet';
    case 'full':
      return 'star';
    case 'interior':
    case 'gaz':
      return 'wind';
    case 'engine':
      return 'thermometer';
    case 'wax':
    case 'polish':
      return 'sun';
    case 'accessories':
      return 'layers';
    default:
      return 'droplet';
  }
}
