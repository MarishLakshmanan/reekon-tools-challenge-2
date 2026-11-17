import { fetch } from "expo/fetch";

/** The server answered with a non-2xx status. Network failures throw the fetch error instead. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(value: string | null) {
  token = value;
}

/** Called when the server rejects the session token, so the app can go back to sign-in. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** Headers for requests made outside `request`, such as image loads and downloads. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Full URL for a server path, on the address this app is configured to use. */
export function apiUrl(path: string) {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new Error("EXPO_PUBLIC_API_URL is not set");
  return `${base}${path}`;
}

export async function request(path: string, init?: Parameters<typeof fetch>[1]) {
  const res = await fetch(apiUrl(path), { ...init, headers: { ...authHeaders(), ...init?.headers } });
  // A failed sign-in is also a 401, but there is no session yet to lose.
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} failed with ${res.status}`);
  return res;
}

export function jsonInit(method: string, body: unknown) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
