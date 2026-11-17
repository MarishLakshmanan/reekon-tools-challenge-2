import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as auth from "@/api/auth";
import type { Me } from "@/api/auth";
import { setToken, setUnauthorizedHandler } from "@/api/client";

type Session = {
  /** True until the saved token has been checked. */
  loading: boolean;
  me: Me | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // The server rejected our token (expired, or the session was ended elsewhere).
    setUnauthorizedHandler(() => {
      setToken(null);
      setMe(null);
    });
    auth
      .loadToken()
      .then((found) => (found ? auth.getMe() : null))
      .then(setMe)
      .catch(() => setMe(null)) // offline or rejected: show sign-in
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await auth.signIn(email, password);
    setMe(await auth.getMe());
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setMe(null);
  }, []);

  const value = useMemo(() => ({ loading, me, signIn, signOut }), [loading, me, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
