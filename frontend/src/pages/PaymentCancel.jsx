import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto flex items-center justify-center" style={{ minHeight: "70vh" }}>
      <div className="border border-border bg-surface rounded-sm p-10 text-center w-full fade-up" data-testid="payment-cancel-card">
        <XCircle size={56} className="text-warning mx-auto mb-5" strokeWidth={1.5} />
        <h1 className="font-heading font-extrabold text-2xl mb-2">Checkout cancelled</h1>
        <p className="text-secondary text-sm mb-8">No charge was made. You can upgrade whenever you're ready.</p>
        <button onClick={() => navigate("/app/pricing")} data-testid="cancel-back-btn" className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-6 py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform">
          Back to Plans
        </button>
      </div>
    </div>
  );
}
