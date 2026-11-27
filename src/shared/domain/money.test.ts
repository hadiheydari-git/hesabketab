import { describe, expect, it } from "vitest";
import {
  checkAmountMinor,
  fromDisplayMinor,
  isSafeAmount,
  rialToToman,
  toDisplayMinor,
  tomanToRial,
} from "./money";

describe("money", () => {
  it("converts between Rial (storage) and Toman (display)", () => {
    expect(rialToToman(1_250_000)).toBe(125_000);
    expect(tomanToRial(125_000)).toBe(1_250_000);
    expect(toDisplayMinor(12_345, "toman")).toBeCloseTo(1_234.5);
    expect(toDisplayMinor(12_345, "rial")).toBe(12_345);
    expect(fromDisplayMinor(1_234.5, "toman")).toBe(12_345);
    expect(fromDisplayMinor(12_345, "rial")).toBe(12_345);
  });

  it("rejects non-integers, negatives and unsafe magnitudes", () => {
    expect(checkAmountMinor(0)).toBe("مبلغ باید یک عدد صحیح مثبت باشد.");
    expect(checkAmountMinor(-5)).toContain("مثبت");
    expect(checkAmountMinor(1.5)).toContain("مثبت");
    expect(checkAmountMinor(Number.MAX_SAFE_INTEGER + 1)).toContain("بیشینه");
    expect(checkAmountMinor(1_000)).toBeNull();
  });

  it("isSafeAmount guards the safe-integer range", () => {
    expect(isSafeAmount(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isSafeAmount(2.5)).toBe(false);
  });
});
