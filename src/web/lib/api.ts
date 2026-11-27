// Small JSON fetch helper with the API's error envelope
// { error: { code, message } } unwrapped into a typed error.
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string } })
    | { error?: { code: string; message: string } }
    | null;
  if (!res.ok) {
    const err = body && "error" in body && body.error ? body.error : null;
    throw new ApiError(
      err?.message ?? "خطای غیرمنتظره؛ دوباره تلاش کنید.",
      err?.code ?? "unknown",
      res.status,
    );
  }
  return body as T;
}

export const postJson = <T>(path: string, data: unknown): Promise<T> =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
