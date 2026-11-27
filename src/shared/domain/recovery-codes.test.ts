import { describe, expect, it } from "vitest";
import {
  CODE_GROUP_LENGTH,
  RECOVERY_CODE_COUNT,
  formatCode,
  generateRecoveryCodes,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";

describe("recovery codes", () => {
  it("formats random bytes into xxxx-xxxx from the unambiguous alphabet", () => {
    const code = formatCode(new Uint8Array(8).map((_, i) => i * 31 % 256));
    expect(code).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{4}-[23456789abcdefghjkmnpqrstuvwxyz]{4}$/);
    expect(code.length).toBe(CODE_GROUP_LENGTH * 2 + 1);
  });

  it("generates 8 unique codes", async () => {
    const codes = await generateRecoveryCodes(async (n) => crypto.getRandomValues(new Uint8Array(n)));
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("recognizes and normalizes user input", () => {
    expect(looksLikeRecoveryCode("ABCD-2345")).toBe(true);
    expect(looksLikeRecoveryCode("abcd2345")).toBe(true);
    expect(looksLikeRecoveryCode("abcd 2345")).toBe(true);
    expect(looksLikeRecoveryCode("o000-1111")).toBe(false); // ambiguous chars excluded
    expect(normalizeRecoveryCode("ABCD2345")).toBe("abcd-2345");
    expect(normalizeRecoveryCode("  abcd-2345 ")).toBe("abcd-2345");
  });
});
