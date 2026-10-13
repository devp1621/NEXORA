import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { go, useApp } from "./store.jsx";

/** Quick-search palette. Opens with Ctrl/Cmd+K. Searches pages and careers only. */
export function Palette({ pages, onClose }) {
  const { careers, selectCareer, profile } = useApp();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const out = pages.map(([to, r]) => ({ key: `p${to}`, kind: "Page", label: r.title, icon: r.icon, run: () => go(to) }));
    const list = careers.status === "ready" && careers.data ? careers.data.careers : [];
    list.forEach((c) => out.push({
      key: `c${c.id}`, kind: "Career", label: c.title, hint: c.tagline, icon: "compass",
      run: () => { if (profile) { selectCareer(c.id); go("/dashboard"); } else { go("/careers"); } },
    }));
    const t = q.trim().toLowerCase();
    return t ? out.filter((i) => `${i.label} ${i.hint || ""} ${i.kind}`.toLowerCase().includes(t)) : out;
  }, [pages, careers, q, profile, selectCareer]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => { setIdx(0); }, [q]);

  const choose = (item) => { onClose(); item.run(); };
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && items[idx]) choose(items[idx]);
  };

  return (
    <div className="pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Quick search" onKeyDown={onKey}>
        <div className="pal-head">
          <strong>Quick search</strong>
          <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="Close search"><Icon name="x" size={16} /></button>
        </div>
        <input ref={inputRef} className="pal-input" placeholder="Search pages and careers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <ul className="pal-list" role="listbox">
          {items.length === 0 && <li className="pal-empty">Nothing matches "{q}".</li>}
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === idx}>
              <button type="button" className={`pal-item${i === idx ? " on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => choose(it)}>
                <Icon name={it.icon} size={16} />
                <span><small>{it.kind}</small>{it.label}{it.hint ? <em>{it.hint}</em> : null}</span>
                <Icon name="arrow" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <p className="pal-foot small muted">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
