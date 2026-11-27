// Security headers on every Worker response (brief §3.4): CSP without
// external origins (fonts and styles are self-hosted/bundled), framing
// and referrer lockdown. SPA needs 'unsafe-inline' for style because the
// design system ships inline CSS custom properties on some components.
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function securityHeaders(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    await next();
    c.header("content-security-policy", CSP);
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("x-frame-options", "DENY");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  };
}
