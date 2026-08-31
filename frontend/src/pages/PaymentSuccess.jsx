import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const MAX_POLLS = 8;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [state, setState] = useState("checking"); // checking | paid | failed | timeout
  const pollsRef = useRef(0);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setState("failed");
      return;
    }
    let timer;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setState("paid");
          refresh();
          return;
        }
        if (["expired", "failed"].includes(data.payment_status)) {
          setState("failed");
          return;
        }
      } catch { /* keep polling */ }
      pollsRef.current += 1;
      if (pollsRef.current >= MAX_POLLS) {
        setState("timeout");
        return;
      }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [params, refresh]);

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto flex items-center justify-center" style={{ minHeight: "70vh" }}>
      <div className="border border-border bg-surface rounded-sm p-10 text-center w-full fade-up relative overflow-hidden" data-testid="payment-success-card">
        {state === "checking" && (
          <>
            <div className="absolute top-0 left-0 right-0 h-0.5 tracing-border" />
            <Loader2 size={48} className="text-accent spin-slow mx-auto mb-5" strokeWidth={1.5} />
            <h1 className="font-heading font-extrabold text-2xl mb-2">Confirming payment</h1>
            <p className="text-secondary text-sm">Securely verifying your transaction...</p>
          </>
        )}
        {state === "paid" && (
          <>
            <CheckCircle2 size={56} className="text-accent mx-auto mb-5" strokeWidth={1.5} />
            <h1 className="font-heading font-extrabold text-2xl mb-2">Protection upgraded</h1>
            <p className="text-secondary text-sm mb-8">Your new defense tier is now active. Welcome to the elite.</p>
            <button onClick={() => navigate("/app/dashboard")} data-testid="success-dashboard-btn" className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-6 py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform">
              Go to Dashboard <ArrowRight size={18} />
            </button>
          </>
        )}
        {(state === "failed" || state === "timeout") && (
          <>
            <XCircle size={56} className="text-threat mx-auto mb-5" strokeWidth={1.5} />
            <h1 className="font-heading font-extrabold text-2xl mb-2">{state === "timeout" ? "Still processing" : "Payment issue"}</h1>
            <p className="text-secondary text-sm mb-8">
              {state === "timeout" ? "Your payment is taking longer than expected. Check your dashboard shortly." : "We couldn't confirm your payment. Please try again."}
            </p>
            <button onClick={() => navigate("/app/pricing")} data-testid="success-retry-btn" className="border border-border px-6 py-3 rounded-sm hover:bg-white hover:text-black transition-colors">
              Back to Plans
            </button>
          </>
        )}
      </div>
    </div>
  );
}
