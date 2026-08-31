import React, { useEffect, useState } from "react";
import { Shield, ShieldCheck, Power, Wifi, ArrowDownUp, Server, MapPin } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import ParticleField from "../components/ParticleField";

function loadColor(load) {
  return load < 35 ? "#00E599" : load < 60 ? "#FFB800" : "#FF3366";
}

export default function VpnPage() {
  const [servers, setServers] = useState([]);
  const [status, setStatus] = useState({ connected: false });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/vpn/status");
      setStatus(data);
      if (data.connected && data.server) setSelected(data.server.id);
    } catch { /* noop */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/vpn/servers");
        setServers(data);
        setSelected(data[0]?.id);
      } catch { /* noop */ }
      loadStatus();
    })();
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, []);

  const connect = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.post("/vpn/connect", { server_id: selected });
      toast.success("Encrypted tunnel established");
      loadStatus();
    } catch {
      toast.error("Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post("/vpn/disconnect");
      toast.success("Tunnel closed");
      setStatus({ connected: false });
    } catch {
      toast.error("Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const fmtDur = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 fade-up">
        <h1 className="font-heading font-light text-3xl md:text-4xl tracking-tight">
          VPN <span className="font-extrabold">Shield</span>
        </h1>
        <p className="text-muted font-mono text-sm mt-1 tracking-wide">Encrypted tunneling across global regions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Connection status */}
        <div className="lg:col-span-1 border border-border bg-surface rounded-sm p-8 relative overflow-hidden fade-up" data-testid="vpn-status-card">
          <div className="absolute inset-0 opacity-40"><ParticleField density={30} color={status.connected ? "0, 229, 153" : "113, 113, 122"} /></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className={`w-28 h-28 rounded-full border-2 flex items-center justify-center mb-6 transition-colors ${status.connected ? "border-accent pulse-glow" : "border-border"}`}>
              {status.connected ? <ShieldCheck size={44} className="text-accent" strokeWidth={1.5} /> : <Shield size={44} className="text-muted" strokeWidth={1.5} />}
            </div>
            <div className={`font-mono text-xs tracking-[0.2em] uppercase mb-2 ${status.connected ? "text-accent" : "text-muted"}`} data-testid="vpn-connection-status">
              {status.connected ? "Protected" : "Unprotected"}
            </div>
            {status.connected ? (
              <>
                <div className="font-heading font-extrabold text-xl mb-1">{status.server?.city}</div>
                <div className="font-mono text-xs text-secondary mb-4">{status.ip}</div>
                <div className="font-mono text-2xl text-accent mb-6">{fmtDur(status.connected_seconds || 0)}</div>
                <div className="grid grid-cols-2 gap-3 w-full mb-6">
                  <div className="border border-border rounded-sm p-3">
                    <div className="font-mono text-xs text-muted uppercase mb-1">Down</div>
                    <div className="font-mono text-accent">{status.data_down_mb} MB</div>
                  </div>
                  <div className="border border-border rounded-sm p-3">
                    <div className="font-mono text-xs text-muted uppercase mb-1">Up</div>
                    <div className="font-mono text-accent">{status.data_up_mb} MB</div>
                  </div>
                </div>
                <button onClick={disconnect} disabled={busy} data-testid="vpn-disconnect-btn" className="w-full flex items-center justify-center gap-2 border border-threat/40 text-threat font-semibold py-3 rounded-sm hover:bg-threat hover:text-white transition-colors disabled:opacity-60">
                  <Power size={18} /> Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-secondary text-sm mb-6">Select a region and establish an encrypted tunnel to mask your traffic.</p>
                <button onClick={connect} disabled={busy || !selected} data-testid="vpn-connect-btn" className="w-full flex items-center justify-center gap-2 bg-accent text-black font-semibold py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform disabled:opacity-60">
                  <Power size={18} /> {busy ? "Connecting..." : "Connect"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Server list */}
        <div className="lg:col-span-2 border border-border bg-surface rounded-sm overflow-hidden fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Server size={14} className="text-accent" />
            <span className="font-mono text-xs tracking-[0.2em] text-muted uppercase">Available Servers</span>
          </div>
          {servers.map((s) => {
            const active = selected === s.id;
            const isConnected = status.connected && status.server?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                data-testid={`vpn-server-${s.id}`}
                className={`w-full flex items-center justify-between px-5 py-4 border-b border-border last:border-0 transition-colors text-left ${active ? "bg-accent/5 border-l-2 border-l-accent" : "hover:bg-surfaceHover border-l-2 border-l-transparent"}`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted w-8">{s.code}</span>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className={active ? "text-accent" : "text-muted"} />
                    <div>
                      <div className="text-sm text-white">{s.city}</div>
                      <div className="font-mono text-xs text-muted">{s.country}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <Wifi size={13} className="text-muted" />
                    <span className="font-mono text-xs text-secondary">{s.ping}ms</span>
                  </div>
                  <div className="flex items-center gap-1.5 w-20">
                    <ArrowDownUp size={13} className="text-muted" />
                    <div className="flex-1 h-1 bg-border overflow-hidden">
                      <div className="h-full" style={{ width: `${s.load}%`, background: loadColor(s.load) }} />
                    </div>
                  </div>
                  {isConnected && <span className="w-2 h-2 rounded-full bg-accent pulse-glow" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
