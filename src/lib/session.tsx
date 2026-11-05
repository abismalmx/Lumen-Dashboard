import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cloudEnabled, getClient } from "./supabase";

export type Session = {
  /** "cloud": a real account backed by Supabase. "demo": data stays in this browser. */
  mode: "cloud" | "demo";
  userId: string;
  email: string;
  name: string;
};

type SignUpResult = { needsConfirmation: boolean };

type SessionApi = {
  /** `undefined` while the stored session is being restored. */
  session: Session | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
};

const DEMO_FLAG = "lumen:demo-session";
const DEMO: Session = { mode: "demo", userId: "demo", email: "guest@lumen.example", name: "Guest" };

const nameFrom = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ") || "Account";

const Context = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(() => {
    if (!cloudEnabled) return DEMO; // nothing to sign in to: open straight into the demo
    return undefined;
  });

  useEffect(() => {
    if (!cloudEnabled) return;
    let unsubscribe = () => {};
    let cancelled = false;
    getClient().then(async (db) => {
      const { data } = await db.auth.getSession();
      if (cancelled) return;
      const user = data.session?.user;
      if (user) setSession({ mode: "cloud", userId: user.id, email: user.email ?? "", name: nameFrom(user.email ?? "") });
      else setSession(window.localStorage.getItem(DEMO_FLAG) ? DEMO : null);
      const { data: sub } = db.auth.onAuthStateChange((_event, next) => {
        const u = next?.user;
        if (u) setSession({ mode: "cloud", userId: u.id, email: u.email ?? "", name: nameFrom(u.email ?? "") });
        else setSession((current) => (current?.mode === "cloud" ? null : current));
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const db = await getClient();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    window.localStorage.removeItem(DEMO_FLAG);
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const db = await getClient();
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    window.localStorage.removeItem(DEMO_FLAG);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(DEMO_FLAG);
    if (cloudEnabled) {
      const db = await getClient();
      await db.auth.signOut();
      setSession(null);
    }
  }, []);

  const enterDemo = useCallback(() => {
    window.localStorage.setItem(DEMO_FLAG, "1");
    setSession(DEMO);
  }, []);

  const api = useMemo(() => ({ session, signIn, signUp, signOut, enterDemo }), [session, signIn, signUp, signOut, enterDemo]);
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
