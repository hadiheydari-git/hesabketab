# ADR-0001: Public URL on workers.dev (no custom domain for now)

Date: 2026-11-27 · Status: accepted

## Context

The brief's `CUSTOM_DOMAIN` input is the bare name `hesabketab`. A Workers custom route or custom domain requires a fully-qualified domain that exists as a zone in the Cloudflare account (for example `hesabketab.com`). A bare name cannot be routed, and the Zone/Workers Routes permission was intentionally not granted in the token scope. The user was asked and chose the `workers.dev` URL.

## Decision

Deploy to `<worker-name>.workers.dev` and skip all zone/route configuration. `wrangler.jsonc` contains no `routes` and no `workers_dev: false`; the workers.dev subdomain is enabled (created via the API if the account has none).

## Consequences

- The app is reachable at the workers.dev URL immediately after the first deploy; no DNS work is needed.
- Note for Iranian users: `workers.dev` is commonly filtered inside Iran; a custom domain on an Iranian-accessible host would improve availability. This is a known limitation, not a blocker for development.
- Revisit when the user provides a full domain that is a zone in this Cloudflare account: add `routes` (or a custom domain) to `wrangler.jsonc`, ensure the token has Zone/Workers Routes: Edit, redeploy.

# ADR-0002: Worker name and app title constant

Date: 2026-11-27 · Status: accepted

## Context

The product's working title is «دخل‌وخرج» (the brief: kept in one config constant so it can change). Worker names must be lowercase ASCII (`[a-z0-9-]`), so the Persian title cannot be the Worker name. The repository is named `hesabketab`.

## Decision

- Worker name: `dakholvakharj` (transliteration of the working title), per the brief's "Worker name from the product name".
- The user-facing title lives in exactly one place: `APP_TITLE` in `src/shared/constants.ts` with value «دخل‌وخرج». Changing the product name later means changing this constant (and optionally the worker name via a new deployment).
- Repository name stays `hesabketab`; it is not user-facing.
