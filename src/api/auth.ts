import * as SecureStore from "expo-secure-store";

import { request, jsonInit, setToken } from "@/api/client";
import { deleteAllLocal } from "@/utils/annotations/storage";

const TOKEN_KEY = "session-token";

export type User = { id: string; name: string; email: string };
export type Org = { id: string; name: string };
export type Me = { user: User; org: Org };

/** Reads the saved token into memory. @returns false when nobody is signed in. */
export async function loadToken(): Promise<boolean> {
  const saved = await SecureStore.getItemAsync(TOKEN_KEY);
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
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  setToken(token);
}

/**
 * Ends the session and deletes every photo stored on this phone, because local files
 * aren't kept per user. A failed server call is ignored: the token is dropped regardless.
 */
export async function signOut(): Promise<void> {
  try {
    await request("/auth/sign-out", { method: "POST" });
  } catch {}
  setToken(null);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  deleteAllLocal();
}
