import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ScanLine, Shield, MessageSquareLock, CreditCard, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/app/scan", label: "Malware Scan", icon: ScanLine, testid: "nav-scan" },
  { to: "/app/vpn", label: "VPN Shield", icon: Shield, testid: "nav-vpn" },
  { to: "/app/assistant", label: "AI Assistant", icon: MessageSquareLock, testid: "nav-assistant" },
  { to: "/app/pricing", label: "Plans", icon: CreditCard, testid: "nav-pricing" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-bg text-white flex">
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`hidden md:flex flex-col border-r border-border bg-surface transition-[width] duration-300 ${
          expanded ? "w-64" : "w-16"
        } fixed h-screen z-30`}
      >
        <div className="h-16 flex items-center px-4 border-b border-border gap-3 overflow-hidden">
          <ShieldCheck className="text-accent shrink-0" strokeWidth={1.5} size={26} />
          {expanded && <span className="font-heading font-extrabold tracking-tight text-lg whitespace-nowrap">SENTINEL</span>}
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-4 px-5 py-3 mx-2 rounded-sm transition-colors overflow-hidden whitespace-nowrap ${
                  isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent"
                    : "text-secondary hover:bg-surfaceHover hover:text-white border-l-2 border-transparent"
                }`
              }
            >
              <item.icon size={20} strokeWidth={1.5} className="shrink-0" />
              {expanded && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="flex items-center gap-4 px-5 py-4 m-2 rounded-sm text-secondary hover:text-threat hover:bg-threat/10 transition-colors overflow-hidden whitespace-nowrap"
        >
          <LogOut size={20} strokeWidth={1.5} className="shrink-0" />
          {expanded && <span className="text-sm">Sign Out</span>}
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-black/80 backdrop-blur-2xl border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-accent" size={22} strokeWidth={1.5} />
          <span className="font-heading font-extrabold tracking-tight">SENTINEL</span>
        </div>
        <button onClick={handleLogout} data-testid="logout-btn-mobile" className="text-secondary">
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-black/90 backdrop-blur-2xl border-t border-border flex items-center justify-around px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`${item.testid}-mobile`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 ${isActive ? "text-accent" : "text-muted"}`
            }
          >
            <item.icon size={20} strokeWidth={1.5} />
            <span className="text-[10px]">{item.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main */}
      <main className="flex-1 md:ml-16 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="h-16 hidden md:flex items-center justify-between px-8 border-b border-border sticky top-0 bg-black/70 backdrop-blur-2xl z-20">
          <div className="font-mono text-xs tracking-[0.2em] text-muted uppercase">Security Command Center</div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-secondary" data-testid="user-plan-badge">
              PLAN: <span className="text-accent">{(user?.plan || "free").toUpperCase()}</span>
            </span>
            <div className="w-8 h-8 rounded-sm bg-accent/10 border border-accent/30 flex items-center justify-center font-heading font-extrabold text-accent text-sm">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
