import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ScanPage from "./pages/ScanPage";
import VpnPage from "./pages/VpnPage";
import Assistant from "./pages/Assistant";
import Pricing from "./pages/Pricing";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import "./App.css";

function Loader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-border border-t-accent rounded-full spin-slow" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Loader />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/app/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/scan" element={<Protected><ScanPage /></Protected>} />
      <Route path="/app/vpn" element={<Protected><VpnPage /></Protected>} />
      <Route path="/app/assistant" element={<Protected><Assistant /></Protected>} />
      <Route path="/app/pricing" element={<Protected><Pricing /></Protected>} />
      <Route path="/payment/success" element={<Protected><PaymentSuccess /></Protected>} />
      <Route path="/payment/cancel" element={<Protected><PaymentCancel /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#121215", border: "1px solid #27272A", borderRadius: "2px", color: "#fff" } }} />
      </AuthProvider>
    </div>
  );
}
