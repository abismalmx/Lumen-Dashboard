import { useEffect, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import Dashboard from "./Dashboard";
import { LocalRepo, SupabaseRepo, type CustomerRepo } from "./lib/repo";
import { SessionProvider, useSession, type Session } from "./lib/session";
import { getClient } from "./lib/supabase";

function useRepo(session: Session | null | undefined): CustomerRepo | null {
  const [repo, setRepo] = useState<CustomerRepo | null>(null);
  useEffect(() => {
    setRepo(null);
    if (!session) return;
    if (session.mode === "demo") {
      setRepo(new LocalRepo("demo"));
      return;
    }
    let cancelled = false;
    getClient().then((db) => !cancelled && setRepo(new SupabaseRepo(db)));
    return () => {
      cancelled = true;
    };
  }, [session]);
  return repo;
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-stone-950 text-[13px] text-stone-400" role="status">
      Loading…
    </div>
  );
}

function Shell() {
  const { session, signOut } = useSession();
  const repo = useRepo(session);
  if (session === undefined) return <Splash />;
  if (session === null) return <AuthScreen />;
  if (!repo) return <Splash />;
  return <Dashboard key={session.userId} session={session} repo={repo} onSignOut={signOut} />;
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
