// Money rules (brief §3.3): integer minor units with explicit currency,
// no floats, guard against values beyond Number.MAX_SAFE_INTEGER.
// IRR is stored in Rial; the display unit (Toman default) divides by 10
// for display and multiplies by 10 on input.

export const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER;

export type CurrencyCode = "IRR"; // Phase 2 adds more currencies.

export function isSafeAmount(value: number): boolean {
  return Number.isInteger(value) && Math.abs(value) <= MAX_SAFE_MONEY;
}

/** Validate a raw integer amount (already in minor units); Persian message when invalid. */
export function checkAmountMinor(value: number): string | null {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return "مبلغ باید یک عدد صحیح مثبت باشد.";
  }
  if (Math.abs(value) > MAX_SAFE_MONEY) {
    return "مبلغ از بیشینهٔ مجاز بزرگ‌تر است.";
  }
  return null;
}

/** Rial → Toman (display). */
export function rialToToman(rial: number): number {
  return rial / 10;
}

/** Toman → Rial (input). */
export function tomanToRial(toman: number): number {
  return toman * 10;
}

export type DisplayUnit = "toman" | "rial";

/** Convert a stored Rial amount to the chosen display unit (integer division for Toman is avoided: keep exact /10). */
export function toDisplayMinor(amountRial: number, unit: DisplayUnit): number {
  return unit === "toman" ? amountRial / 10 : amountRial;
}

/** Convert a user-entered amount in the given display unit to stored Rial. */
export function fromDisplayMinor(amount: number, unit: DisplayUnit): number {
  return unit === "toman" ? tomanToRial(amount) : amount;
}
