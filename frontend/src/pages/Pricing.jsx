import React, { useEffect, useState } from "react";
import { Check, ScanLine, Shield, MessageSquareLock, Zap, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const FEATURES = {
  basic_monthly: ["Real-time malware scanning", "Threat quarantine", "Device health monitoring", "Email support"],
  pro_monthly: ["Everything in Basic", "VPN Shield (8 regions)", "AI Security Analyst", "Web & firewall shields", "Priority support"],
  enterprise_monthly: ["Everything in Pro", "Unlimited devices", "Advanced threat intelligence", "Dedicated analyst", "24/7 command support"],
};
const ICONS = { basic_monthly: Zap, pro_monthly: Sparkles, enterprise_monthly: Crown };

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loadingKey, setLoadingKey] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/payments/plans");
        setPlans(data);
      } catch {
        toast.error("Failed to load plans");
      }
    })();
  }, []);

  const checkout = async (lookup_key) => {
    setLoadingKey(lookup_key);
    try {
      const { data } = await api.post("/payments/checkout", { lookup_key, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch {
      toast.error("Checkout failed");
      setLoadingKey(null);
    }
  };

  const currentPlan = user?.plan || "free";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-10 text-center fade-up">
        <div className="font-mono text-xs tracking-[0.2em] text-accent uppercase mb-3">// Upgrade</div>
        <h1 className="font-heading font-light text-4xl md:text-5xl tracking-tight">
          Choose your <span className="font-extrabold">defense tier</span>
        </h1>
        <p className="text-secondary mt-3">Unlock VPN, AI analysis, and advanced protection. Cancel anytime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p, i) => {
          const Icon = ICONS[p.lookup_key] || Shield;
          const featured = p.lookup_key === "pro_monthly";
          const isCurrent = currentPlan === p.name.toLowerCase();
          return (
            <div
              key={p.lookup_key}
              data-testid={`plan-card-${p.lookup_key}`}
              className={`relative border rounded-sm p-8 flex flex-col fade-up ${featured ? "border-accent bg-surface" : "border-border bg-surface"}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {featured && <div className="absolute top-0 left-0 right-0 h-0.5 tracing-border" />}
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-black font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-sm">
                  Most Popular
                </div>
              )}
              <Icon className={featured ? "text-accent" : "text-secondary"} size={30} strokeWidth={1.5} />
              <h3 className="font-heading font-extrabold text-2xl mt-4">{p.name}</h3>
              <p className="text-muted text-sm mt-1">{p.tagline}</p>
              <div className="mt-6 mb-6">
                <span className="font-heading font-extrabold text-4xl">${p.price}</span>
                <span className="text-muted font-mono text-sm">/mo</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {(FEATURES[p.lookup_key] || []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-secondary">
                    <Check size={16} className="text-accent shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => checkout(p.lookup_key)}
                disabled={loadingKey === p.lookup_key || isCurrent}
                data-testid={`subscribe-btn-${p.lookup_key}`}
                className={`w-full py-3 rounded-sm font-semibold transition-transform disabled:opacity-60 ${
                  featured ? "bg-accent text-black hover:bg-[#00c985] hover:-translate-y-0.5" : "border border-border text-white hover:bg-white hover:text-black"
                }`}
              >
                {isCurrent ? "Current Plan" : loadingKey === p.lookup_key ? "Redirecting..." : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <p className="font-mono text-xs text-muted">Test mode · use card 4242 4242 4242 4242, any future expiry & CVC</p>
        <div className="flex items-center justify-center gap-6 mt-4 text-muted">
          <span className="flex items-center gap-1.5 text-xs"><ScanLine size={14} /> Antivirus</span>
          <span className="flex items-center gap-1.5 text-xs"><Shield size={14} /> VPN</span>
          <span className="flex items-center gap-1.5 text-xs"><MessageSquareLock size={14} /> AI Analyst</span>
        </div>
      </div>
    </div>
  );
}
