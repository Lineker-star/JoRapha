/**
 * Cameroon phone numbers for patient OTP sign-in (Step 2.1): 9 national digits starting with 6 (mobile) or 2
 * (fixed), with or without +237 / 00237 / spaces / dots / dashes. Returns E.164 (+2376XXXXXXXX) or null.
 */
export function normalizeCameroonPhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, '');
  const national = compact.replace(/^(\+237|00237|237)/, '');
  return /^[26]\d{8}$/.test(national) ? `+237${national}` : null;
}
