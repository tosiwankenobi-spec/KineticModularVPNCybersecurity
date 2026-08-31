import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, formatApiErrorDetail } from "../context/AuthContext";
import ParticleField from "../components/ParticleField";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("Protection deployed. Welcome to SENTINEL.");
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
      <div className="flex-1 flex items-center justify-center px-6 order-2 lg:order-1">
        <div className="w-full max-w-sm fade-up">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <ShieldCheck className="text-accent" size={26} strokeWidth={1.5} />
            <span className="font-heading font-extrabold tracking-tight text-lg">SENTINEL</span>
          </Link>
          <h1 className="font-heading font-light text-3xl tracking-tight mb-2">Deploy protection</h1>
          <p className="text-muted text-sm mb-8 font-mono tracking-wide">Create your command center</p>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Name</label>
              <input
                required
                data-testid="register-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-2 bg-transparent border-b-2 border-border focus:border-accent outline-none py-2 rounded-none text-white transition-colors"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Email</label>
              <input
                type="email"
                required
                data-testid="register-email-input"
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
                minLength={6}
                data-testid="register-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 bg-transparent border-b-2 border-border focus:border-accent outline-none py-2 rounded-none text-white transition-colors"
                placeholder="Min. 6 characters"
              />
            </div>
            {error && <div data-testid="register-error" className="text-threat text-sm font-mono bg-threat/10 border border-threat/30 px-3 py-2 rounded-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="w-full group flex items-center justify-center gap-2 bg-accent text-black font-semibold py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
            >
              {loading ? "Deploying..." : "Create Account"}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="text-muted text-sm mt-8">
            Already protected?{" "}
            <Link to="/login" data-testid="goto-login-link" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block w-1/2 relative border-l border-border noise order-1 lg:order-2">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <ParticleField density={60} color="0, 229, 153" />
        <div className="absolute bottom-12 left-12 right-12">
          <h2 className="font-heading font-light text-4xl tracking-tight mb-3">
            Join the <span className="font-extrabold text-accent">defended</span>
          </h2>
          <p className="text-secondary">Instant malware scanning and threat monitoring, free forever.</p>
        </div>
      </div>
    </div>
  );
}
