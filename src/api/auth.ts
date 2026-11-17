import * as SecureStore from "expo-secure-store";

import { request, jsonInit, setToken } from "@/api/client";
import { deleteAllLocal } from "@/utils/annotations/storage";
import { isWeb } from "@/utils/platform";

const TOKEN_KEY = "session-token";

// SecureStore has no web implementation, so the browser keeps the token in localStorage.
const readToken = async () => (isWeb ? localStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY));
const writeToken = async (token: string) =>
  isWeb ? localStorage.setItem(TOKEN_KEY, token) : SecureStore.setItemAsync(TOKEN_KEY, token);
const clearToken = async () => (isWeb ? localStorage.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY));

export type User = { id: string; name: string; email: string };
export type Org = { id: string; name: string };
export type Me = { user: User; org: Org };

/** Reads the saved token into memory. @returns false when nobody is signed in. */
export async function loadToken(): Promise<boolean> {
  const saved = await readToken();
  setToken(saved);
  return saved !== null;
}

export async function getMe(): Promise<Me> {
  return (await request("/me")).json();
}

/** @throws ApiError 401 on a wrong email or password. */
export async function signIn(email: string, password: string): Promise<void> {
  const res = await request("/auth/sign-in", jsonInit("POST", { email, password }));
  const { token } = await res.json();
  await writeToken(token);
  setToken(token);
}

/** Drops a token the server rejected, so the next launch starts at sign-in instead of retrying it. */
export async function forgetToken(): Promise<void> {
  setToken(null);
  await clearToken();
}

/**
 * Ends the session. On a phone it also deletes every stored photo, because local files
 * aren't kept per user; the web stores none. A failed server call is ignored: the token is dropped regardless.
 */
export async function signOut(): Promise<void> {
  try {
    await request("/auth/sign-out", { method: "POST" });
  } catch {
    // Offline or already expired: the local token is dropped either way.
  }
  setToken(null);
  await clearToken();
  if (!isWeb) deleteAllLocal();
}
