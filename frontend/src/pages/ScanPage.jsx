import React, { useEffect, useRef, useState } from "react";
import { ScanLine, ShieldCheck, ShieldAlert, Loader2, FileSearch, History } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const SEV_COLORS = { critical: "#FF3366", high: "#FF3366", medium: "#FFB800", low: "#A1A1AA" };

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [currentFile, setCurrentFile] = useState("");
  const [filesScanned, setFilesScanned] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/scan/history/list");
      setHistory(data);
    } catch { /* noop */ }
  };

  useEffect(() => {
    loadHistory();
    return () => clearInterval(pollRef.current);
  }, []);

  const startScan = async () => {
    setResult(null);
    setProgress(0);
    setScanning(true);
    try {
      const { data } = await api.post("/scan/start");
      const scanId = data.scan_id;
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/scan/${scanId}`);
          const s = res.data;
          setProgress(s.progress);
          setStage(s.current_stage || "");
          setCurrentFile(s.current_file || "");
          setFilesScanned(s.files_scanned || 0);
          setTotalFiles(s.total_files || 0);
          if (s.status === "completed") {
            clearInterval(pollRef.current);
            setScanning(false);
            setResult(s);
            loadHistory();
            if (s.threats_found > 0) toast.error(`${s.threats_found} threat(s) detected`);
            else toast.success("Scan complete. No threats found.");
          }
        } catch {
          clearInterval(pollRef.current);
          setScanning(false);
        }
      }, 700);
    } catch {
      setScanning(false);
      toast.error("Failed to start scan");
    }
  };

  const quarantine = async (id) => {
    try {
      await api.post(`/threats/${id}/quarantine`);
      toast.success("Threat quarantined");
      setResult((r) => ({ ...r, threats: r.threats.map((t) => (t.id === id ? { ...t, status: "quarantined" } : t)) }));
    } catch {
      toast.error("Quarantine failed");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8 fade-up">
        <h1 className="font-heading font-light text-3xl md:text-4xl tracking-tight">
          Malware <span className="font-extrabold">Scan</span>
        </h1>
        <p className="text-muted font-mono text-sm mt-1 tracking-wide">Deep signature analysis engine</p>
      </div>

      {/* Scan console */}
      <div className="border border-border bg-surface rounded-sm p-8 relative overflow-hidden fade-up" data-testid="scan-console">
        {scanning && <div className="absolute top-0 left-0 right-0 h-0.5 tracing-border" />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="flex flex-col items-center">
            <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center relative ${scanning ? "border-accent pulse-glow" : result ? (result.threats_found > 0 ? "border-threat" : "border-accent") : "border-border"}`}>
              {scanning ? (
                <>
                  <Loader2 size={48} className="text-accent spin-slow" strokeWidth={1.5} />
                  <span className="absolute -bottom-1 font-mono text-xs text-accent bg-surface px-2">{Math.round(progress)}%</span>
                </>
              ) : result ? (
                result.threats_found > 0 ? <ShieldAlert size={48} className="text-threat" strokeWidth={1.5} /> : <ShieldCheck size={48} className="text-accent" strokeWidth={1.5} />
              ) : (
                <ScanLine size={48} className="text-secondary" strokeWidth={1.5} />
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            {scanning ? (
              <>
                <div className="font-mono text-xs tracking-[0.2em] text-accent uppercase mb-2">{stage}</div>
                <div className="h-1 bg-border rounded-none overflow-hidden mb-3">
                  <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="font-mono text-xs text-muted truncate flex items-center gap-2">
                  <FileSearch size={12} /> {currentFile}
                </div>
                <div className="font-mono text-xs text-secondary mt-2">
                  {filesScanned.toLocaleString()} / {totalFiles.toLocaleString()} files
                </div>
              </>
            ) : result ? (
              <>
                <h3 className="font-heading font-extrabold text-2xl mb-2">
                  {result.threats_found > 0 ? (
                    <span className="text-threat">{result.threats_found} threat(s) found</span>
                  ) : (
                    <span className="text-accent">Device is clean</span>
                  )}
                </h3>
                <p className="text-secondary text-sm mb-4">Scanned {result.total_files.toLocaleString()} files.</p>
                <button onClick={startScan} data-testid="rescan-btn" className="border border-border px-5 py-2.5 rounded-sm text-white hover:bg-white hover:text-black transition-colors text-sm">
                  Scan Again
                </button>
              </>
            ) : (
              <>
                <h3 className="font-heading font-extrabold text-2xl mb-2">Ready to scan</h3>
                <p className="text-secondary text-sm mb-5">Run a full-system deep scan to detect malware, spyware and unwanted programs.</p>
                <button onClick={startScan} data-testid="start-scan-btn" className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-6 py-3 rounded-sm hover:bg-[#00c985] hover:-translate-y-0.5 transition-transform">
                  <ScanLine size={18} /> Start Full Scan
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results threats */}
      {result && result.threats && result.threats.length > 0 && (
        <div className="mt-6 border border-threat/30 bg-surface rounded-sm overflow-hidden fade-up" data-testid="scan-results">
          <div className="px-5 py-3 border-b border-border font-mono text-xs tracking-[0.2em] text-threat uppercase">Detected Threats</div>
          {result.threats.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
              <div className="flex items-center gap-4 min-w-0">
                <span className="px-2 py-1 rounded-sm font-mono text-[10px] uppercase" style={{ background: `${SEV_COLORS[t.severity]}1a`, color: SEV_COLORS[t.severity] }}>{t.severity}</span>
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">{t.name}</div>
                  <div className="font-mono text-xs text-muted truncate">{t.path}</div>
                </div>
              </div>
              {t.status === "quarantined" ? (
                <span className="font-mono text-xs text-accent uppercase tracking-wider ml-4">Quarantined</span>
              ) : (
                <button onClick={() => quarantine(t.id)} data-testid={`scan-quarantine-${t.id}`} className="shrink-0 ml-4 border border-threat/40 text-threat text-xs font-mono uppercase px-3 py-1.5 rounded-sm hover:bg-threat hover:text-white transition-colors">
                  Quarantine
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <div className="mt-8 mb-4 flex items-center gap-3">
            <History size={14} className="text-muted" />
            <span className="font-mono text-xs tracking-[0.2em] text-muted uppercase">Scan History</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="border border-border bg-surface rounded-sm overflow-hidden fade-up">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 text-sm">
                <span className="font-mono text-secondary">{new Date(h.completed_at).toLocaleString()}</span>
                <span className="font-mono text-muted">{h.total_files.toLocaleString()} files</span>
                <span className={`font-mono ${h.threats_found > 0 ? "text-threat" : "text-accent"}`}>{h.threats_found} threats</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
