import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, ShieldAlert, ScanLine, Cpu, HardDrive, MemoryStick, BatteryFull,
  Globe, Flame, Eye, ChevronRight, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const SEV_COLORS = { critical: "#FF3366", high: "#FF3366", medium: "#FFB800", low: "#A1A1AA" };

function ScoreRing({ score }) {
  const color = score >= 80 ? "#00E599" : score >= 50 ? "#FFB800" : "#FF3366";
  const data = [{ name: "score", value: score, fill: color }];
  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <RadialBarChart width={200} height={200} cx="50%" cy="50%" innerRadius="78%" outerRadius="100%" barSize={14} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "#27272A" }} dataKey="value" cornerRadius={0} angleAxisId={0} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-extrabold text-5xl" style={{ color }} data-testid="security-score">{score}</span>
        <span className="font-mono text-xs tracking-[0.2em] text-muted uppercase mt-1">Security Score</span>
      </div>
    </div>
  );
}

function HealthBar({ icon: Icon, label, value, unit = "%" }) {
  const color = value > 80 ? "#FF3366" : value > 60 ? "#FFB800" : "#00E599";
  return (
    <div className="border border-border bg-surface rounded-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-secondary">
          <Icon size={16} strokeWidth={1.5} />
          <span className="text-xs font-mono tracking-wide uppercase">{label}</span>
        </div>
        <span className="font-mono font-bold text-sm" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="h-1 bg-border rounded-none overflow-hidden">
        <div className="h-full transition-[width] duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const res = await api.get("/dashboard/overview");
      setData(res.data);
    } catch {
      toast.error("Failed to load dashboard");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const toggle = async (key, value) => {
    setData((d) => ({ ...d, protection: { ...d.protection, [key]: value } }));
    try {
      await api.post("/protection/toggle", { key, value });
      load();
    } catch {
      toast.error("Toggle failed");
      load();
    }
  };

  const quarantine = async (id) => {
    try {
      await api.post(`/threats/${id}/quarantine`);
      toast.success("Threat quarantined");
      load();
    } catch {
      toast.error("Quarantine failed");
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="w-10 h-10 border-2 border-border border-t-accent rounded-full spin-slow" />
      </div>
    );
  }

  const protectedState = data.status === "protected";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8 fade-up">
        <h1 className="font-heading font-light text-3xl md:text-4xl tracking-tight">
          Welcome back, <span className="font-extrabold">{user?.name?.split(" ")[0] || "Operator"}</span>
        </h1>
        <p className="text-muted font-mono text-sm mt-1 tracking-wide">System overview · {new Date().toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score + status */}
        <div className="md:col-span-2 border border-border bg-surface rounded-sm p-6 flex flex-col md:flex-row items-center gap-6 fade-up relative overflow-hidden" data-testid="score-card">
          {protectedState && <div className="absolute top-0 left-0 right-0 h-0.5 tracing-border" />}
          <ScoreRing score={data.security_score} />
          <div className="flex-1">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider mb-4 ${protectedState ? "bg-accent/10 text-accent" : "bg-threat/10 text-threat"}`}>
              {protectedState ? <ShieldCheck size={16} /> : <ShieldAlert size={16} className="threat-shake" />}
              {data.status.replace("_", " ")}
            </div>
            <p className="text-secondary text-sm leading-relaxed mb-4">
              {protectedState
                ? "All systems nominal. Your device is fully defended against known threats."
                : "Action required. Threats detected or protection layers disabled."}
            </p>
            <button
              onClick={() => navigate("/app/scan")}
              data-testid="dashboard-scan-btn"
              className="group inline-flex items-center gap-2 bg-accent text-black font-semibold px-5 py-2.5 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform"
            >
              <ScanLine size={18} /> Run Scan
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Threat counters */}
        <div className="border border-border bg-surface rounded-sm p-6 fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 text-muted mb-4">
            <ShieldAlert size={16} strokeWidth={1.5} />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">Threats</span>
          </div>
          <div className="font-heading font-extrabold text-5xl text-threat" data-testid="active-threats-count">{data.threats.active}</div>
          <div className="text-muted text-sm mt-1">Active detections</div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between text-sm">
            <span className="text-secondary">Quarantined</span>
            <span className="font-mono text-accent">{data.threats.quarantined}</span>
          </div>
        </div>

        {/* Protection toggles */}
        <div className="border border-border bg-surface rounded-sm p-6 fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 text-muted mb-4">
            <Activity size={16} strokeWidth={1.5} />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">Shields</span>
          </div>
          {[
            { key: "realtime", label: "Real-time", icon: Eye },
            { key: "firewall", label: "Firewall", icon: Flame },
            { key: "webshield", label: "Web Shield", icon: Globe },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2 text-secondary text-sm">
                <s.icon size={15} strokeWidth={1.5} /> {s.label}
              </div>
              <button
                onClick={() => toggle(s.key, !data.protection[s.key])}
                data-testid={`toggle-${s.key}`}
                className={`w-10 h-5 rounded-full relative transition-colors ${data.protection[s.key] ? "bg-accent" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${data.protection[s.key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Device health */}
      <div className="mt-8 mb-4 flex items-center gap-3">
        <span className="font-mono text-xs tracking-[0.2em] text-accent uppercase">// Device Health</span>
        <div className="flex-1 h-px bg-border" />
        <span className="font-mono text-xs text-muted">{data.device_health.os} · up {data.device_health.uptime_hours}h</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-up">
        <HealthBar icon={Cpu} label="CPU Load" value={data.device_health.cpu} />
        <HealthBar icon={MemoryStick} label="Memory" value={data.device_health.memory} />
        <HealthBar icon={HardDrive} label="Disk" value={data.device_health.disk} />
        <HealthBar icon={BatteryFull} label="Battery" value={data.device_health.battery} />
      </div>

      {/* Active threats list */}
      <div className="mt-8 mb-4 flex items-center gap-3">
        <span className="font-mono text-xs tracking-[0.2em] text-threat uppercase">// Active Threats</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="border border-border bg-surface rounded-sm overflow-hidden fade-up" data-testid="threats-panel">
        {data.threats.list.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck size={40} className="text-accent mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-secondary">No active threats. Your device is clean.</p>
          </div>
        ) : (
          data.threats.list.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-surfaceHover transition-colors" data-testid={`threat-row-${t.id}`}>
              <div className="flex items-center gap-4 min-w-0">
                <span className="px-2 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider" style={{ background: `${SEV_COLORS[t.severity]}1a`, color: SEV_COLORS[t.severity] }}>
                  {t.severity}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-sm text-white truncate">{t.name}</div>
                  <div className="font-mono text-xs text-muted truncate">{t.path}</div>
                </div>
              </div>
              <button
                onClick={() => quarantine(t.id)}
                data-testid={`quarantine-btn-${t.id}`}
                className="shrink-0 ml-4 border border-threat/40 text-threat text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-sm hover:bg-threat hover:text-white transition-colors"
              >
                Quarantine
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
