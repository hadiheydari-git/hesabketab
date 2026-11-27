import { describe, expect, it } from "vitest";
import { checkUsername, placeholderEmail } from "./username";

describe("checkUsername", () => {
  it("accepts valid usernames and lowercases them", () => {
    expect(checkUsername("Hadi.Karimi_99")).toEqual({ ok: true, value: "hadi.karimi_99" });
    expect(checkUsername("  ali  ")).toEqual({ ok: true, value: "ali" });
  });

  it("rejects too short and too long", () => {
    expect(checkUsername("ab").ok).toBe(false);
    expect(checkUsername("a".repeat(33)).ok).toBe(false);
  });

  it("rejects non-latin characters and spaces", () => {
    expect(checkUsername("هدی").ok).toBe(false);
    expect(checkUsername("has space").ok).toBe(false);
    expect(checkUsername("bad-dash").ok).toBe(false); // dash not allowed
  });

  it("rejects empty and boundary lengths", () => {
    expect(checkUsername("").ok).toBe(false);
    expect(checkUsername("a".repeat(32)).ok).toBe(true);
  });

  it("placeholder email is non-routable", () => {
    expect(placeholderEmail("Hadi")).toBe("hadi@users.invalid");
  });
});
