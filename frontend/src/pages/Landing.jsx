import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ScanLine, Shield, MessageSquareLock, ArrowUpRight, Lock, Activity, Globe } from "lucide-react";
import ParticleField from "../components/ParticleField";

const HERO_BG =
  "https://images.unsplash.com/photo-1770486036751-e55247238964?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwzfHxhYnN0cmFjdCUyMGRhcmslMjBuZXR3b3JrJTIwbWVzaHxlbnwwfHx8fDE3ODgxODUzNjl8MA&ixlib=rb-4.1.0&q=85";
const NODES_BG =
  "https://images.unsplash.com/photo-1639322537228-f710d846310a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjBuZXR3b3JrJTIwbWVzaHxlbnwwfHx8fDE3ODgxODUzNjl8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-white relative overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-accent" size={26} strokeWidth={1.5} />
            <span className="font-heading font-extrabold tracking-tight text-lg">SENTINEL</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="landing-login-link" className="text-sm text-secondary hover:text-white transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link
              to="/register"
              data-testid="landing-register-btn"
              className="text-sm font-semibold bg-accent text-black px-5 py-2 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform"
            >
              Get Protected
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16 noise">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
        <div className="absolute inset-0 z-10">
          <ParticleField density={70} />
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-24">
          <div className="md:col-span-8 fade-up">
            <div className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 rounded-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-accent pulse-glow" />
              <span className="font-mono text-xs tracking-[0.2em] text-secondary uppercase">Real-time threat defense online</span>
            </div>
            <h1 className="font-heading font-light text-5xl md:text-7xl leading-[1.02] tracking-tight mb-6">
              Your device.
              <br />
              <span className="font-extrabold">Locked down.</span>
              <br />
              <span className="text-accent font-extrabold">Untouchable.</span>
            </h1>
            <p className="text-secondary text-lg max-w-xl leading-relaxed mb-10">
              SENTINEL fuses military-grade malware scanning, encrypted VPN tunneling, and an
              AI security analyst into one command center. Detect, quarantine, and neutralize
              threats before they land.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                data-testid="hero-cta-btn"
                className="group inline-flex items-center gap-2 bg-accent text-black font-semibold px-7 py-3.5 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform"
              >
                Start Free Scan
                <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 border border-border text-white px-7 py-3.5 rounded-sm hover:bg-white hover:text-black transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
          <div className="md:col-span-4 fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="border border-border bg-surface rounded-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 tracing-border" />
              <div className="font-mono text-xs text-muted tracking-[0.2em] uppercase mb-4">Live Metrics</div>
              {[
                { label: "Threats blocked today", value: "1,284,902", icon: Lock },
                { label: "Active VPN nodes", value: "3,200+", icon: Globe },
                { label: "Avg. scan time", value: "12.4s", icon: Activity },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <s.icon size={18} className="text-accent" strokeWidth={1.5} />
                    <span className="text-sm text-secondary">{s.label}</span>
                  </div>
                  <span className="font-mono font-bold text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-32 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="font-mono text-xs tracking-[0.2em] text-accent uppercase mb-4">// Capabilities</div>
            <h2 className="font-heading font-light text-4xl md:text-5xl tracking-tight">
              Three layers of <span className="font-extrabold">total defense</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: ScanLine, title: "Antivirus Engine", desc: "Deep-signature malware scanning across memory, files, and startup vectors. Quarantine threats in one tap.", img: NODES_BG },
              { icon: Shield, title: "VPN Shield", desc: "Route traffic through encrypted tunnels across 8 global regions. Mask your IP, block trackers, stay invisible." },
              { icon: MessageSquareLock, title: "AI Analyst", desc: "Chat with SENTINEL AI to decode threats, audit your security posture, and get tactical remediation steps." },
            ].map((f, i) => (
              <div key={f.title} className="group border border-border bg-surface rounded-sm p-8 hover:border-accent/40 transition-colors relative overflow-hidden fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                {f.img && <img src={f.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" />}
                <div className="relative z-10">
                  <f.icon className="text-accent mb-6" size={32} strokeWidth={1.5} />
                  <h3 className="font-heading font-extrabold text-xl mb-3">{f.title}</h3>
                  <p className="text-secondary leading-relaxed text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 border-t border-border noise">
        <div className="absolute inset-0 grid-bg-fine opacity-40" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-heading font-light text-4xl md:text-6xl tracking-tight mb-6">
            Deploy your <span className="font-extrabold text-accent">command center</span>
          </h2>
          <p className="text-secondary text-lg mb-10">Free to start. Upgrade for VPN and advanced defense anytime.</p>
          <Link
            to="/register"
            data-testid="footer-cta-btn"
            className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-8 py-4 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform"
          >
            Get Protected Now
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-muted text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" strokeWidth={1.5} />
            <span className="font-mono tracking-wider">SENTINEL © 2026</span>
          </div>
          <span className="font-mono text-xs">Encrypted · Private · Relentless</span>
        </div>
      </footer>
    </div>
  );
}
