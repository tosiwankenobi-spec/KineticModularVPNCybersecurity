import React, { useEffect, useRef, useState } from "react";
import { Send, MessageSquareLock, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../lib/api";

const SUGGESTIONS = [
  "How do I know if my device is infected?",
  "What is a phishing attack?",
  "Explain what a VPN protects me from",
  "How do I create a strong password?",
];

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/assistant/history");
        setMessages(data);
        scrollToBottom();
      } catch { /* noop */ }
    })();
  }, []);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    scrollToBottom();
    try {
      const res = await fetch(`${API}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.delta) {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + payload.delta };
              return copy;
            });
            scrollToBottom();
          } else if (payload.error) {
            toast.error("AI error: " + payload.error);
          }
        }
      }
    } catch {
      toast.error("Failed to reach AI assistant");
      setMessages((m) => {
        const copy = [...m];
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) copy.pop();
        return copy;
      });
    } finally {
      setStreaming(false);
      scrollToBottom();
    }
  };

  const clear = async () => {
    try {
      await api.post("/assistant/clear");
      setMessages([]);
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="mb-6 flex items-center justify-between fade-up">
        <div>
          <h1 className="font-heading font-light text-3xl md:text-4xl tracking-tight">
            AI <span className="font-extrabold">Analyst</span>
          </h1>
          <p className="text-muted font-mono text-sm mt-1 tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Powered by Claude Sonnet 4.6
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} data-testid="clear-chat-btn" className="flex items-center gap-2 text-muted hover:text-threat transition-colors text-sm font-mono">
            <Trash2 size={16} /> Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto border border-border bg-surface rounded-sm p-5 mb-4" data-testid="chat-window">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageSquareLock size={44} className="text-accent mb-4" strokeWidth={1.5} />
            <h3 className="font-heading font-extrabold text-xl mb-2">Ask the SENTINEL analyst</h3>
            <p className="text-secondary text-sm max-w-md mb-8">Get tactical guidance on threats, malware, VPNs, and device hygiene.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} data-testid="suggestion-chip" className="text-left text-sm border border-border rounded-sm px-4 py-3 text-secondary hover:border-accent/40 hover:text-white transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.role}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-sm bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} className="text-accent" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-accent text-black font-medium" : "bg-bg border border-border text-secondary"}`}>
                  {m.content || (streaming && i === messages.length - 1 ? <span className="inline-block w-2 h-4 bg-accent animate-pulse" /> : "")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about threats, security, privacy..."
          data-testid="chat-input"
          className="flex-1 bg-surface border border-border focus:border-accent outline-none px-4 py-3 rounded-sm text-white transition-colors"
        />
        <button type="submit" disabled={streaming || !input.trim()} data-testid="chat-send-btn" className="bg-accent text-black w-12 h-12 flex items-center justify-center rounded-sm hover:bg-[#00c985] transition-colors disabled:opacity-50">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
