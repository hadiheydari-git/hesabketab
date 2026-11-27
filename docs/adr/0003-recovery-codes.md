# ADR-0003: Password recovery without email via self-managed one-time codes

Date: 2026-11-27 · Status: accepted

## Context

The brief (§3.4) forbids collecting email or phone. Better Auth 1.7 has no
standalone "recovery codes for password reset" plugin for this flow (its
two-factor backup codes belong to an active 2FA setup, which we do not have).

## Decision

- Recovery codes are implemented in-house (`src/worker/modules/auth/routes.ts`):
  8 codes per user, alphabet without ambiguous characters, shown exactly
  once, stored only as sha-256 hashes (`recovery_code` table).
- `POST /api/auth/forgot-password` (public) accepts username + one code +
  the new password, is rate-limited through a D1 table (`rate_limit`, 10
  attempts/hour/username), and writes in one `db.batch()`: consume the code,
  replace the credential password (hashed with better-auth's own
  `hashPassword` from `better-auth/crypto`, so both stay algorithm-identical)
  and delete all sessions of that user.
- `POST /api/recovery-codes` (authenticated) regenerates the set.
- The UI states plainly that losing both password and codes means the
  account cannot be recovered.

## Consequences

- No email infrastructure, matching the brief.
- Better Auth remains the single source for password hashing and sessions.
- The D1 rate limiter survives isolate restarts (memory limiters do not).
