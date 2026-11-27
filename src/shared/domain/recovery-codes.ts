// One-time recovery codes (brief §3.4): 8 codes generated at
// registration, shown once, stored only as sha-256 hashes. Pure helpers
// only — hashing lives in the worker (Web Crypto) and is covered by
// integration tests; this module defines the alphabet, format and
// validation so client and server stay in sync.
export const RECOVERY_CODE_COUNT = 8;
export const CODE_GROUP_LENGTH = 4;
export const CODE_GROUP_COUNT = 2;

// Unambiguous alphabet: no 0/O, 1/I/L.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export type RecoveryCode = string; // "abcd-2345"

/** Generate one code in the form xxxx-xxxx from the given random bytes. */
export function formatCode(random: Uint8Array): RecoveryCode {
  const n = CODE_GROUP_LENGTH * CODE_GROUP_COUNT;
  if (random.length < n) throw new Error("not enough random bytes");
  let out = "";
  for (let i = 0; i < n; i += 1) {
    if (i > 0 && i % CODE_GROUP_LENGTH === 0) out += "-";
    out += ALPHABET[random[i]! % ALPHABET.length];
  }
  return out;
}

/** Loose client-side check before sending to the server (dash optional). */
export function looksLikeRecoveryCode(value: string): boolean {
  const v = normalizeRecoveryCode(value);
  return /^[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$/.test(v);
}

/** Normalize user input: lowercase, strip spaces, allow missing dash. */
export function normalizeRecoveryCode(value: string): string {
  const v = value.trim().toLowerCase().replace(/[\s–—]/g, "");
  return v.includes("-") ? v : `${v.slice(0, CODE_GROUP_LENGTH)}-${v.slice(CODE_GROUP_LENGTH)}`;
}

/** Generate `count` fresh codes from an async random source (Web Crypto in worker, tests can stub). */
export async function generateRecoveryCodes(
  randomBytes: (n: number) => Promise<Uint8Array>,
  count: number = RECOVERY_CODE_COUNT,
): Promise<RecoveryCode[]> {
  const codes: RecoveryCode[] = [];
  const seen = new Set<string>();
  while (codes.length < count) {
    const code = formatCode(await randomBytes(CODE_GROUP_LENGTH * CODE_GROUP_COUNT));
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}
