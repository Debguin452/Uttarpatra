import { signal } from "@preact/signals";
import { auth } from "./firebase";

const BASE: string = import.meta.env.VITE_API_URL ?? "";

export type Fatal = "account_blocked" | null;
export const fatal = signal<Fatal>(null);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown>,
  ) {
    super(code);
  }
}

type Options = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  const hasBody = options.body !== undefined;
  if (hasBody) headers["content-type"] = "application/json";

  if (options.auth !== false) {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", {});
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof data.error === "string" ? data.error : "unknown";
    if (code === "account_blocked") fatal.value = code;
    throw new ApiError(response.status, code, data);
  }
  return data as T;
}
