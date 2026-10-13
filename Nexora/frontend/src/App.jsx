import Welcome from "./pages/Welcome.jsx";
import Login from "./pages/Login.jsx";
import { Logo } from "./logo.jsx";
import { ChatPanel, ChatLauncher, useChatOpen } from "./chat.jsx";
import { useEffect, useRef, useState } from "react";
import { Banner, EmptyState } from "./components.jsx";
import { DEMOS } from "./demo.js";
import { Icon } from "./icons.jsx";
import About from "./pages/About.jsx";
import Careers from "./pages/Careers.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Gaps from "./pages/Gaps.jsx";
import Landing from "./pages/Landing.jsx";
import Profile from "./pages/Profile.jsx";
import Roadmap from "./pages/Roadmap.jsx";
import { Palette } from "./palette.jsx";
import { Backdrop, useGlobalTilt } from "./scene.jsx";
import { AppProvider, go, useApp } from "./store.jsx";

const ROUTES = {
  "/": { title: "Welcome", icon: "home", page: Welcome, hidden: true, bare: true, wrap: "intro-page" },
  "/home": { title: "Home", icon: "home", page: Landing },
  "/profile": { title: "Profile", icon: "user", page: Profile },
  "/careers": { title: "Careers", icon: "compass", page: Careers },
  "/dashboard": { title: "Dashboard", icon: "chart", page: Dashboard },
  "/gaps": { title: "Skill gaps", icon: "target", page: Gaps },
  "/roadmap": { title: "Roadmap", icon: "route", page: Roadmap },
  "/about": { title: "About", icon: "info", page: About },
  "/login": { title: "Account", icon: "user", page: Login, hidden: true, bare: true },
};

function useRoute() {
  const read = () => (window.location.hash.replace(/^#/, "") || "/").split("?")[0];
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => setPath(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

function Brand() {
  return (
    <a href="#/home" className="brand" aria-label="Nexora home">
      <Logo size={32} />
      <span>Nex<b>ora</b></span>
    </a>
  );
}

function ServiceStatus() {
  const { health } = useApp();
  if (health.status === "loading") return <p className="status small muted">Checking server…</p>;
  if (health.status === "down") return <p className="status small"><i className="dot dot-missing" /> Server offline</p>;
  return (
    <p className="status small muted">
      <i className="dot dot-matched" /> Server connected<br />
      <i className={`dot ${health.data.aiConfigured ? "dot-matched" : "dot-idle"}`} /> AI {health.data.aiConfigured ? "configured" : "not configured (rule-based mode)"}
    </p>
  );
}

function AccountBox({ onNavigate }) {
  const { auth, sync, signOut } = useApp();
  if (auth.status === "loading") return null;
  if (auth.status !== "user") {
    return (
      <div className="account-box">
        <p className="small muted">
          {sync === "expired"
            ? "Your session expired. Sign in again to keep saving."
            : auth.enabled
              ? "Guest mode: saved on this browser only."
              : "Guest mode: saved on this browser only. Accounts need a database."}
        </p>
        <a className="btn btn-ghost btn-block" href="#/login" onClick={onNavigate}><Icon name="user" /> Sign in / Sign up</a>
      </div>
    );
  }
  const label = { saving: "Saving…", saved: "Saved to your account", error: "Could not save. Retrying on next change", expired: "Session expired", idle: "" }[sync];
  return (
    <div className="account-box">
      <a className="account-name" href="#/login" onClick={onNavigate}><span className="avatar">{(auth.user.name || "?").trim()[0].toUpperCase()}</span> {auth.user.name}</a>
      <p className="small muted" aria-live="polite"><i className={`dot ${sync === "error" ? "dot-missing" : sync === "saving" ? "dot-idle" : "dot-matched"}`} /> {label}</p>
      <button className="btn btn-quiet" onClick={signOut}>Log out</button>
    </div>
  );
}

const NAV_GROUPS = [
  ["Start", ["/home", "/profile"]],
  ["Analyze", ["/dashboard", "/gaps", "/careers"]],
  ["Grow", ["/roadmap"]],
  ["More", ["/about"]],
];

function Nav({ path, onNavigate }) {
  return (
    <nav aria-label="Main">
      {NAV_GROUPS.map(([label, ids]) => (
        <div key={label} className="nav-group">
          <p className="nav-label">{label}</p>
          <ul className="nav">
            {ids.map((to) => (
              <li key={to}>
                <a href={`#${to}`} aria-current={path === to ? "page" : undefined} className={path === to ? "on" : ""} onClick={onNavigate}>
                  <Icon name={ROUTES[to].icon} /> {ROUTES[to].title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DemoPicker({ onDone }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (key) => {
    setBusy(true);
    const r = await app.loadDemo(key);
    setBusy(false);
    if (r.ok || !r.stale) go("/dashboard");
    onDone && onDone();
  };
  return (
    <div className="demo-picker">
      <p className="small muted">Try Demo Profile (fictional sample data)</p>
      {Object.values(DEMOS).map((d) => (
        <button key={d.key} className="btn btn-ghost btn-block" disabled={busy} onClick={() => run(d.key)}>
          <Icon name="sparkles" /> {d.label.split(":")[0]}
        </button>
      ))}
    </div>
  );
}

function Shell() {
  useGlobalTilt();
  const path = useRoute();
  const route = ROUTES[path];
  const { careers, storageOk } = useApp();
  const [menu, setMenu] = useState(false);
  const [chatOpen, setChatOpen] = useChatOpen();
  const [palette, setPalette] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    document.title = `${route ? route.title : "Not found"} · Nexora`;
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [path]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Page = route ? route.page : null;
  const pagesForSearch = Object.entries(ROUTES).filter(([, r]) => !r.hidden);

  // Full-screen pages (sign in / sign up) render without the sidebar and chat.
  if (route && route.bare) {
    return (
      <main id="main-content" ref={mainRef} tabIndex={-1} className={route.wrap || "auth-page"}>
        <Page />
      </main>
    );
  }

  return (
    <div className={`shell${chatOpen ? " chat-open" : ""}`}>
      <a className="skip" href="#main-content" onClick={(e) => { e.preventDefault(); mainRef.current && mainRef.current.focus(); }}>Skip to content</a>
      <header className="topbar">
        <Brand />
        <button className="btn btn-ghost" onClick={() => setPalette(true)} aria-label="Search pages and careers"><Icon name="compass" /></button>
        <button className="btn btn-ghost" aria-expanded={menu} aria-controls="side" onClick={() => setMenu((m) => !m)} aria-label="Toggle navigation menu">
          <Icon name={menu ? "x" : "menu"} />
        </button>
      </header>
      <aside id="side" className={`side ${menu ? "open" : ""}`}>
        <div className="side-brand"><Brand /></div>
        <Nav path={path} onNavigate={() => setMenu(false)} />
        <div className="side-foot">
          <AccountBox onNavigate={() => setMenu(false)} />
          <DemoPicker onDone={() => setMenu(false)} />
          <ServiceStatus />
        </div>
      </aside>
      <div className="workcol">
      <header className="dtop">
        <nav className="crumbs" aria-label="Breadcrumb"><span>Nexora</span><Icon name="arrow" size={12} /><strong>{route ? route.title : "Not found"}</strong></nav>
        <button type="button" className="dsearch" onClick={() => setPalette(true)} aria-label="Search pages and careers">
          <Icon name="compass" size={16} /> <span>Search Nexora…</span> <kbd>Ctrl K</kbd>
        </button>
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1} className="main">
        {!storageOk && <Banner tone="warning" title="Browser storage is unavailable">Your profile and progress will not survive a page refresh.</Banner>}
        {Page ? <Page /> : (
          <EmptyState icon="alert" title="Page not found" actions={<a className="btn btn-primary" href="#/home">Go to home</a>}>
            There is nothing at <code>{path}</code>.
          </EmptyState>
        )}
        {path !== "/" && path !== "/home" && careers.status === "error" && path !== "/careers" && (
          <p className="small muted">Career data could not be loaded from the server.</p>
        )}
      </main>
      </div>
      {palette && <Palette pages={pagesForSearch} onClose={() => setPalette(false)} />}
      {chatOpen ? <ChatPanel onClose={() => setChatOpen(false)} /> : <ChatLauncher onOpen={() => setChatOpen(true)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Backdrop />
      <Shell />
    </AppProvider>
  );
}
