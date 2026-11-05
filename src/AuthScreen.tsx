import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { BrandMark } from "./Dashboard";
import { useSession } from "./lib/session";

const FIELD =
  "mt-1.5 h-10 w-full rounded-lg border border-white/[0.08] bg-stone-950 px-3 text-[14px] text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-amber-400/60";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

export function AuthScreen() {
  const { signIn, signUp, enterDemo } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else {
        const result = await signUp(email.trim(), password);
        if (result.needsConfirmation) setNotice("Check your inbox to confirm the address, then sign in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-stone-950 bg-[radial-gradient(55%_45%_at_30%_-12%,rgba(251,191,36,0.10),transparent_70%)] bg-no-repeat px-4 py-10 text-stone-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [-webkit-mask-image:linear-gradient(to_bottom,black,transparent_85%)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <main className="animate-rise relative w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[15px] font-medium tracking-tight text-stone-50">Lumen</span>
        </div>
        <h1 className="mt-8 font-display text-[40px] leading-[1.05] tracking-tight text-stone-50">
          {mode === "signin" ? "Welcome back" : "Create your workspace"}
        </h1>
        <p className="mt-2 text-[14px] text-stone-400">
          {mode === "signin"
            ? "Sign in to see your customers and revenue."
            : "Your customers are stored per account and visible only to you."}
        </p>

        <form
          onSubmit={submit}
          className="mt-7 space-y-4 rounded-xl border border-white/[0.08] bg-stone-900 p-5 shadow-2xl shadow-black/50"
        >
          <label className="block">
            <span className="text-[13px] text-stone-400">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.example"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-stone-400">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={FIELD}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[13px] text-rose-200">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-100">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${FOCUS} inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 text-[14px] font-semibold text-stone-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_0_0_1px_rgba(251,191,36,0.5),0_4px_14px_-4px_rgba(251,191,36,0.55)] transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-[13px]">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className={`${FOCUS} -mx-2 inline-flex h-9 items-center rounded px-2 text-stone-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-stone-50`}
          >
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
          <button
            type="button"
            onClick={enterDemo}
            className={`${FOCUS} -mx-2 inline-flex h-9 items-center rounded px-2 text-amber-300 transition-colors hover:text-amber-200`}
          >
            Explore the demo →
          </button>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-stone-500">
          The demo needs no account: sample data is kept in this browser only.
        </p>
      </main>
    </div>
  );
}
