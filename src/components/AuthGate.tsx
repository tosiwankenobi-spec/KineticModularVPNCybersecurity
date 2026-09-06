import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-mono text-xs uppercase text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return <>{children}</>;
}

// Mirrors the Supabase project's password policy (8+ characters, upper +
// lower case, a digit, and a symbol) so a weak password gets a specific,
// friendly message here instead of Supabase's raw 422 error text.
function getPasswordError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";
  return null;
}

function AuthForm() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signInWithPassword(email, password);
        if (error) setError(error);
        else toast.success("Welcome back");
      } else {
        const passwordError = getPasswordError(password);
        if (passwordError) {
          setError(passwordError);
          return;
        }
        const { error, needsEmailConfirmation } = await signUpWithPassword(
          email,
          password,
          displayName || undefined,
        );
        if (error) {
          setError(error);
        } else if (needsEmailConfirmation) {
          // Supabase gives the same response whether this is a brand-new
          // signup awaiting confirmation or a repeat signup on an
          // already-registered address (no email is sent in the latter
          // case, by design, to avoid leaking which emails are registered)
          // — so the copy here has to stay honest about both possibilities.
          toast.success("If that's a new address, check your email to confirm your account");
          setMode("signin");
        } else {
          toast.success("Account created");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="relative size-5 rounded-sm bg-primary">
            <div className="absolute inset-1 rounded-[2px] bg-background" />
          </div>
          <span className="text-mono text-xs font-semibold uppercase">Kinetic</span>
        </div>

        <h1 className="text-lg font-semibold">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Access your protection console."
            : "Set up your modular defense console."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="auth-display-name"
                className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
              >
                Display name
              </label>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="Optional"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="auth-email"
              className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="••••••••"
            />
            {mode === "signup" && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                At least 8 characters, with uppercase, lowercase, a number, and a symbol.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="text-mono w-full rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
