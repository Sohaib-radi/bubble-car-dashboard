// Mirrors src/lib/phoneAuth.ts in the mobile app — Supabase Auth identities
// are email-based, so login here also derives the same synthetic email from
// the phone number a manager types in.
export function phoneToSyntheticEmail(phone: string): string {
  const digits = normalizePhone(phone).replace(/[^0-9]/g, '');
  return `p_${digits}@phone.blackbubblewash.app`;
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.trim().replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+20')) return cleaned;
  if (cleaned.startsWith('20') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+2${cleaned}`;
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}
