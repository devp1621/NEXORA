import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.jsx";

export const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
export const levelLabel = (v) => (LEVELS.find((l) => l.value === v) || { label: v || "" }).label;

const compactKey = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#]/g, "");

export function Card({ title, subtitle, action, children, className = "", as: Tag = "section", id }) {
  const headingId = useId();
  return (
    <Tag className={`card ${className}`} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2 id={headingId} className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function Badge({ tone = "neutral", children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export const PriorityBadge = ({ priority }) => (
  <Badge tone={priority === "High" ? "red" : priority === "Medium" ? "amber" : "neutral"}>{priority} priority</Badge>
);

export const StatusBadge = ({ status }) => {
  const map = { matched: ["green", "Matched"], in_progress: ["amber", "In progress"], missing: ["red", "Missing"] };
  const [tone, label] = map[status] || ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
};

export function Spinner({ label = "Loading" }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Banner({ tone = "info", title, children, action, icon }) {
  const role = tone === "error" || tone === "warning" ? "alert" : "status";
  return (
    <div className={`banner banner-${tone}`} role={role}>
      <Icon name={icon || (tone === "error" || tone === "warning" ? "alert" : tone === "success" ? "check" : "info")} />
      <div className="banner-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = "info", title, children, actions }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <h2>{title}</h2>
      <p>{children}</p>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow-label">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}

export function SampleBadge({ label }) {
  if (!label) return null;
  return (
    <Badge tone="cyan" title="This profile is fictional sample data created for the demo.">
      {label}
    </Badge>
  );
}

/** Circular progress, sculpted as a clay dish with a groove and a glossy arc. `value` is a real 0-100 percentage from the backend. */
export function ScoreRing({ value, size = 168, caption, ariaLabel }) {
  const uid = "sr" + useId().replace(/[^a-z0-9]/gi, "");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const stroke = Math.max(12, size / 12);
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const [from, to] = value >= 70 ? ["#7defc6", "#14a77c"] : value >= 40 ? ["#8f9bff", "#9a73ff"] : ["#ffd978", "#f2a900"];
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={ariaLabel || `${value} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}a`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={`${uid}c`} cx="0.3" cy="0.2" r="0.9">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#eceeff" />
          </radialGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#dcdffb" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 - 1} fill="none" stroke="rgba(98,108,214,.25)" strokeWidth="2" />
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 3} fill={`url(#${uid}c)`} style={{ filter: "drop-shadow(0 4px 6px rgba(58,68,168,.22))" }} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${uid}a)`} strokeWidth={stroke - 2} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-value">{Number.isInteger(value) ? value : value.toFixed(1)}<small>%</small></span>
        {caption && <span className="ring-caption">{caption}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label, tone = "indigo" }) {
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className={`bar-fill bar-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Stacked horizontal bars per category, built from real counts. A table below gives the text alternative. */
export function CategoryChart({ rows }) {
  return (
    <div>
      <ul className="catchart" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.category}>
            <span className="catchart-label">{r.category}</span>
            <span className="catchart-track">
              <span className="seg seg-matched" style={{ flex: r.matched }} />
              <span className="seg seg-progress" style={{ flex: r.inProgress }} />
              <span className="seg seg-missing" style={{ flex: r.missing }} />
            </span>
            <span className="catchart-count">{r.matched}/{r.total}</span>
          </li>
        ))}
      </ul>
      <div className="legend" aria-hidden="true">
        <span><i className="dot dot-matched" /> Matched</span>
        <span><i className="dot dot-progress" /> In progress</span>
        <span><i className="dot dot-missing" /> Missing</span>
      </div>
      <table className="sr-only">
        <caption>Required skills by category</caption>
        <thead><tr><th>Category</th><th>Matched</th><th>In progress</th><th>Missing</th><th>Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}><td>{r.category}</td><td>{r.matched}</td><td>{r.inProgress}</td><td>{r.missing}</td><td>{r.total}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Searchable multi-select / free-text chip input with ARIA combobox semantics.
 * items: [{ name, level? }]; with `withLevel` each chip has a proficiency select.
 */
export function ChipInput({ label, hint, items, onChange, suggestions = [], withLevel = false, placeholder, error, errorId, inputId }) {
  const autoId = useId();
  const id = inputId || autoId;
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  const taken = useMemo(() => new Set(items.map((i) => compactKey(i.name))), [items]);

  const options = useMemo(() => {
    const q = compactKey(query);
    const list = [];
    if (q) {
      for (const s of suggestions) {
        if (taken.has(compactKey(s.name))) continue;
        const hit = compactKey(s.name).includes(q) || (s.aliases || []).some((a) => compactKey(a).includes(q));
        if (hit) list.push({ name: s.name, via: compactKey(s.name).includes(q) ? null : (s.aliases || []).find((a) => compactKey(a).includes(q)) });
        if (list.length >= 7) break;
      }
      const typed = query.trim();
      if (typed && !taken.has(compactKey(typed)) && !list.some((o) => compactKey(o.name) === q)) {
        list.push({ name: typed, custom: true });
      }
    } else {
      for (const s of suggestions) {
        if (!taken.has(compactKey(s.name))) list.push({ name: s.name });
        if (list.length >= 7) break;
      }
    }
    return list;
  }, [query, suggestions, taken]);

  useEffect(() => setActive(0), [query]);

  const add = (name) => {
    const clean = name.trim();
    if (!clean) return;
    if (taken.has(compactKey(clean))) {
      setMessage(`${clean} is already added.`);
      return;
    }
    onChange([...items, withLevel ? { name: clean, level: "intermediate" } : { name: clean }]);
    setMessage(`${clean} added.`);
    setQuery("");
    inputRef.current && inputRef.current.focus();
  };

  const remove = (index) => {
    const gone = items[index].name;
    onChange(items.filter((_, i) => i !== index));
    setMessage(`${gone} removed.`);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && options[active]) add(options[active].name);
      else if (query.trim()) add(query);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && items.length) {
      remove(items.length - 1);
    }
  };

  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <div className={`chips ${error ? "has-error" : ""}`} onClick={() => inputRef.current && inputRef.current.focus()}>
        {items.map((item, i) => (
          <span className="chip" key={item.name}>
            <span className="chip-name">{item.name}</span>
            {withLevel && (
              <select
                className="chip-level"
                value={item.level}
                aria-label={`Proficiency for ${item.name}`}
                onChange={(e) => onChange(items.map((it, idx) => (idx === i ? { ...it, level: e.target.value } : it)))}
              >
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            )}
            <button type="button" className="chip-x" onClick={() => remove(i)} aria-label={`Remove ${item.name}`}>
              <Icon name="x" size={14} />
            </button>
          </span>
        ))}
        <div className="chip-input-wrap">
          <input
            ref={inputRef}
            id={id}
            className="chip-input"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
            aria-describedby={[hint ? `${id}-hint` : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            value={query}
            placeholder={items.length ? "" : placeholder}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />
          {open && options.length > 0 && (
            <ul className="suggest" role="listbox" id={listId}>
              {options.map((o, i) => (
                <li
                  key={`${o.name}-${i}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "active" : ""}
                  onMouseDown={(e) => { e.preventDefault(); add(o.name); }}
                  onMouseEnter={() => setActive(i)}
                >
                  {o.custom ? <>Add &ldquo;{o.name}&rdquo; as typed</> : <>{o.name}{o.via && <small> (matches &ldquo;{o.via}&rdquo;)</small>}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{message}</span>
    </div>
  );
}
