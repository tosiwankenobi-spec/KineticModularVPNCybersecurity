import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, formatApiErrorDetail } from "../context/AuthContext";
import ParticleField from "../components/ParticleField";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Access granted. Welcome back.");
      navigate("/app/dashboard");
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-white flex">
      <div className="hidden lg:block w-1/2 relative border-r border-border noise">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <ParticleField density={60} />
        <div className="absolute bottom-12 left-12 right-12">
          <h2 className="font-heading font-light text-4xl tracking-tight mb-3">
            Secure access to your <span className="font-extrabold text-accent">command center</span>
          </h2>
          <p className="text-secondary">Authenticate to view threats, run scans, and control your defenses.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm fade-up">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <ShieldCheck className="text-accent" size={26} strokeWidth={1.5} />
            <span className="font-heading font-extrabold tracking-tight text-lg">SENTINEL</span>
          </Link>
          <h1 className="font-heading font-light text-3xl tracking-tight mb-2">Sign in</h1>
          <p className="text-muted text-sm mb-8 font-mono tracking-wide">Authenticate your identity</p>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Email</label>
              <input
                type="email"
                required
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-2 bg-transparent border-b-2 border-border focus:border-accent outline-none py-2 rounded-none text-white transition-colors"
                placeholder="you@domain.com"
              />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Password</label>
              <input
                type="password"
                required
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 bg-transparent border-b-2 border-border focus:border-accent outline-none py-2 rounded-none text-white transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && <div data-testid="login-error" className="text-threat text-sm font-mono bg-threat/10 border border-threat/30 px-3 py-2 rounded-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full group flex items-center justify-center gap-2 bg-accent text-black font-semibold py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
            >
              {loading ? "Authenticating..." : "Sign In"}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="text-muted text-sm mt-8">
            No account?{" "}
            <Link to="/register" data-testid="goto-register-link" className="text-accent hover:underline">
              Deploy protection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
