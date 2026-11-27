// Username rules (brief §3.4): 3–32 chars, Latin letters, digits,
// underscore and dot; unique case-insensitively; stored lowercase;
// shown LTR. Shared by client forms and the worker.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
const USERNAME_RE = /^[a-z0-9._]+$/;

export type UsernameCheck = { ok: true; value: string } | { ok: false; error: string };

/** Normalize (trim + lowercase) and validate a username; returns a Persian error message when invalid. */
export function checkUsername(raw: string): UsernameCheck {
  const value = raw.trim().toLowerCase();
  if (value.length < USERNAME_MIN) {
    return { ok: false, error: `نام کاربری باید دست‌کم ${USERNAME_MIN} نویسه باشد.` };
  }
  if (value.length > USERNAME_MAX) {
    return { ok: false, error: `نام کاربری باید حداکثر ${USERNAME_MAX} نویسه باشد.` };
  }
  if (!USERNAME_RE.test(value)) {
    return {
      ok: false,
      error: "نام کاربری فقط می‌تواند شامل حروف انگلیسی، رقم، نقطه و خط زیر باشد.",
    };
  }
  return { ok: true, value };
}

/** Placeholder email used internally by Better Auth (never shown or collected). */
export function placeholderEmail(username: string): string {
  return `${checkUsername(username).ok ? username.trim().toLowerCase() : "user"}@users.invalid`;
}
