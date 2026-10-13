import { useEffect, useRef, useState } from "react";
import { api, toApiProfile } from "./api.js";
import { Icon } from "./icons.jsx";
import { useApp } from "./store.jsx";

const KEY_OPEN = "cc.v1.chatOpen";

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: chat still works for this session */
  }
}

export function useChatOpen() {
  const [open, setOpen] = useState(false); // always starts closed; it is a pop-up, not a panel
  const set = (v) => {
    setOpen(v);
    write(KEY_OPEN, v);
  };
  return [open, set];
}

export function ChatLauncher({ onOpen }) {
  return (
    <button className="chat-launcher" onClick={onOpen} aria-label="Open career assistant chat">
      <Icon name="chat" size={20} /> <span>Ask assistant</span>
    </button>
  );
}

const STARTERS = ["What should I learn first?", "What am I missing?", "How is my score calculated?", "Which career fits me best?"];

export function ChatPanel({ onClose }) {
  const { profile, careerId, analysis, health, loadDemo, chat: messages, setChat: setMessages } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(STARTERS);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = Boolean(profile && careerId);
  const aiOn = Boolean(health && health.data && health.data.aiConfigured);

  const send = async (raw) => {
    const message = (raw ?? text).trim();
    if (!message || busy || !ready) return;
    setText("");
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    try {
      const r = await api.chat(careerId, toApiProfile(profile), message, history.slice(-8));
      setMessages((m) => [...m, { role: "assistant", text: r.reply, source: r.source, note: r.source === "rule-based" ? (r.fallbackReason && r.fallbackReason !== "not_configured" ? r.note : null) : null }]);
      if (r.suggestions && r.suggestions.length) setSuggestions(r.suggestions);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", error: true, text: err.network ? err.message : `Sorry, that did not work: ${err.message}` }]);
    } finally {
      setBusy(false);
      inputRef.current && inputRef.current.focus();
    }
  };

  const career = analysis && analysis.data && analysis.data.selectedCareer ? analysis.data.selectedCareer.title : null;

  return (
    <aside className="chat" aria-label="Career assistant chat">
      <header className="chat-head">
        <div>
          <h2 className="chat-title"><Icon name="sparkles" size={16} /> Career assistant</h2>
          <p className="chat-sub">
            {aiOn ? "AI-assisted, using your calculated analysis" : "Rule-based (AI not configured). Answers use your calculated analysis"}
            {career ? ` · ${career}` : ""}
          </p>
        </div>
        <div className="row">
          {messages.length > 0 && (
            <button className="btn btn-quiet" onClick={() => { setMessages([]); setSuggestions(STARTERS); }} aria-label="Clear chat" title="Clear chat">
              <Icon name="trash" size={16} />
            </button>
          )}
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close chat"><Icon name="x" size={18} /></button>
        </div>
      </header>

      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Chat messages">
        {!ready && (
          <div className="chat-empty">
            <p>Create a profile (or load a sample one) and I can answer questions about your skill gaps, score and roadmap.</p>
            <div className="row wrap">
              <button className="btn btn-primary btn-sm" onClick={() => loadDemo("aarav")}>Try Demo Profile</button>
              <a className="btn btn-ghost btn-sm" href="#/profile">Build profile</a>
            </div>
          </div>
        )}
        {ready && messages.length === 0 && (
          <div className="chat-empty">
            <p>Hi{profile.name ? ` ${profile.name.split(" ")[0]}` : ""}! Ask me about your {career || "career"} analysis. I only use data calculated from your profile.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}${m.error ? " msg-error" : ""}`}>
            <div className="bubble">{m.text}</div>
            {m.role === "assistant" && !m.error && (
              <div className="msg-meta">{m.source === "ai" ? "AI-generated" : "Rule-based, not AI"}{m.note ? ` · ${m.note}` : ""}</div>
            )}
          </div>
        ))}
        {busy && <div className="msg msg-assistant"><div className="bubble typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}
      </div>

      {ready && (
        <div className="chat-suggest" aria-label="Suggested questions">
          {suggestions.slice(0, 4).map((s) => (
            <button key={s} className="chip-btn" disabled={busy} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="chat-input" className="sr-only">Ask the career assistant</label>
        <input
          id="chat-input"
          ref={inputRef}
          className="input"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder={ready ? "Ask about your gaps, score, roadmap…" : "Load a profile to start"}
          disabled={!ready || busy}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={!ready || busy || !text.trim()} aria-label="Send message">
          <Icon name="send" size={16} />
        </button>
      </form>
    </aside>
  );
}
