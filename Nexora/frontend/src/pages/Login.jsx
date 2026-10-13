import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import { Logo } from "../logo.jsx";
import { IsoArt } from "../illustrations.jsx";
import { go, useApp } from "../store.jsx";

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/;

/** Outlined input with a floating label. */
function Float({ id, label, type = "text", value, onChange, error, autoComplete, autoFocus, inputRef, maxLength }) {
  return (
    <div className={`fl ${error ? "has-error" : ""}`}>
      <input
        id={id}
        ref={inputRef}
        className="fl-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <label htmlFor={id} className="fl-label">{label}</label>
      {error && <p className="fl-error" id={`${id}-err`} role="alert"><Icon name="alert" size={14} /> {error}</p>}
    </div>
  );
}

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-split">
      <aside className="auth-panel" aria-hidden="true">
        <p className="eyebrow">Your potential, your next frontier</p>
        <h2>See your skills clearly. Plan your path.</h2>
        <p>Build one profile, see what is missing for your career, and follow a roadmap step by step.</p>
        <IsoArt />
      </aside>
      <div className="auth-card">
      <a href="#/" className="auth-logo" aria-label="Nexora home"><Logo size={40} /></a>
      <h1 className="auth-title">{title}</h1>
      {subtitle && <div className="auth-sub">{subtitle}</div>}
      {children}
      <div className="auth-foot">{footer}</div>
      </div>
    </div>
  );
}

function ShowPassword({ checked, onChange }) {
  return (
    <label className="auth-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Show password
    </label>
  );
}

export default function Login() {
  const { auth, health, signIn, signUp, signOut, profile } = useApp();
  const [mode, setMode] = useState(() => (window.location.hash.includes("mode=signup") ? "signup" : "signin")); // signin | signup
  const [step, setStep] = useState("email"); // sign in: email -> password
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState(null);
  const pwRef = useRef(null);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); setGeneral(null); };

  useEffect(() => {
    document.title = "Sign in · Nexora";
  }, []);
  useEffect(() => {
    if (step === "password" && pwRef.current) pwRef.current.focus();
  }, [step]);

  const guestLink = <a href="#/home" className="auth-link">Continue as guest</a>;

  if (auth.status === "loading") return <Shell title="Just a moment" subtitle="Checking your session…" footer={null}><div className="auth-spin" aria-hidden="true" /></Shell>;

  if (auth.status === "user") {
    return (
      <Shell title={`Hi, ${auth.user.name.split(" ")[0]}`} subtitle={<span className="auth-chip"><span className="auth-avatar">{auth.user.name[0].toUpperCase()}</span>{auth.user.email}</span>} footer={null}>
        <p className="auth-note">Your profile, roadmap progress and chat are saved to your account.</p>
        <div className="auth-actions">
          <button className="auth-link auth-linkbtn" onClick={signOut}>Log out</button>
          <a className="auth-btn" href={profile ? "#/dashboard" : "#/profile"}>{profile ? "Open dashboard" : "Build profile"}</a>
        </div>
      </Shell>
    );
  }

  if (!auth.enabled) {
    const err = health.data && health.data.databaseError;
    return (
      <Shell title="Sign in" subtitle="to continue to Nexora" footer={guestLink}>
        <div className="auth-alert" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>{err ? "The database could not be reached" : "Accounts are not switched on yet"}</strong>
            <p>{err ? `Check that MongoDB is running and MONGODB_URI is correct, then restart the server. (${err})` : "This server has no database configured, so Nexora saves to this browser only."}</p>
          </div>
        </div>
        <ol className="auth-steps">
          <li>Install and start MongoDB (or create a free Atlas cluster).</li>
          <li>In <code>backend</code>, run <code>pip install -r requirements.txt</code>.</li>
          <li>Copy <code>.env.example</code> to <code>.env</code> and set <code>MONGODB_URI=mongodb://localhost:27017</code>.</li>
          <li>Restart the server and press Ctrl+F5. The sign-in form will appear here.</li>
        </ol>
      </Shell>
    );
  }

  const switchMode = (m) => { setMode(m); setStep("email"); setErrors({}); setGeneral(null); setShow(false); setForm((f) => ({ ...f, password: "", confirm: "" })); };

  const finish = async (promise) => {
    setBusy(true);
    const r = await promise;
    setBusy(false);
    if (r.ok) return go(r.hasProfile ? "/dashboard" : "/profile");
    const next = {};
    (r.error.details || []).forEach((d) => { next[d.field] = d.message; });
    if (r.error.code === "invalid_credentials") next.password = r.error.message;
    setErrors(next);
    if (!Object.keys(next).length) setGeneral(r.error.message);
  };

  const nextFromEmail = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(form.email.trim())) return setErrors({ email: form.email.trim() ? "Enter a valid email address." : "Enter an email address." });
    setErrors({});
    setStep("password");
  };

  const submitSignIn = (e) => {
    e.preventDefault();
    if (busy) return;
    if (!form.password) return setErrors({ password: "Enter your password." });
    finish(signIn(form.email, form.password));
  };

  const submitSignUp = (e) => {
    e.preventDefault();
    if (busy) return;
    const er = {};
    if (!form.name.trim()) er.name = "Enter your name.";
    if (!EMAIL_RE.test(form.email.trim())) er.email = "Enter a valid email address.";
    if (form.password.length < 8) er.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) er.confirm = "Those passwords didn't match. Try again.";
    setErrors(er);
    if (Object.keys(er).length) return;
    finish(signUp(form.name, form.email, form.password));
  };

  const generalBox = general && <div className="auth-alert" role="alert"><Icon name="alert" size={18} /><div><p>{general}</p></div></div>;

  if (mode === "signup") {
    return (
      <Shell title="Create your Nexora account" subtitle="Save your profile and progress on any device" footer={guestLink}>
        <form onSubmit={submitSignUp} noValidate className="auth-form">
          {generalBox}
          <Float id="a-name" label="Name" value={form.name} onChange={set("name")} error={errors.name} autoComplete="name" autoFocus maxLength={80} />
          <Float id="a-email" label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" />
          <div className="auth-two">
            <Float id="a-pass" label="Password" type={show ? "text" : "password"} value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" />
            <Float id="a-confirm" label="Confirm" type={show ? "text" : "password"} value={form.confirm} onChange={set("confirm")} error={errors.confirm} autoComplete="new-password" />
          </div>
          <p className="auth-hint">Use 8 or more characters.</p>
          <ShowPassword checked={show} onChange={setShow} />
          <div className="auth-actions">
            <button type="button" className="auth-link auth-linkbtn" onClick={() => switchMode("signin")}>Sign in instead</button>
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          </div>
        </form>
      </Shell>
    );
  }

  if (step === "email") {
    return (
      <Shell title="Sign in" subtitle="to continue to Nexora" footer={guestLink}>
        <form onSubmit={nextFromEmail} noValidate className="auth-form">
          <Float id="a-email" label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="username" autoFocus />
          <p className="auth-note">Not on this computer? You can still use Nexora as a guest, then sign in later to save your work.</p>
          <div className="auth-actions">
            <button type="button" className="auth-link auth-linkbtn" onClick={() => switchMode("signup")}>Create account</button>
            <button type="submit" className="auth-btn">Next</button>
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell
      title="Welcome"
      subtitle={
        <button type="button" className="auth-chip auth-chipbtn" onClick={() => { setStep("email"); setErrors({}); }} aria-label={`Signed in as ${form.email}. Use a different email`}>
          <span className="auth-avatar">{form.email.trim()[0].toUpperCase()}</span>{form.email.trim()}<Icon name="down" size={16} />
        </button>
      }
      footer={guestLink}
    >
      <form onSubmit={submitSignIn} noValidate className="auth-form">
        {generalBox}
        <Float id="a-pass" label="Enter your password" type={show ? "text" : "password"} value={form.password} onChange={set("password")} error={errors.password} autoComplete="current-password" inputRef={pwRef} />
        <ShowPassword checked={show} onChange={setShow} />
        <div className="auth-actions">
          <button type="button" className="auth-link auth-linkbtn" onClick={() => switchMode("signup")}>Create account</button>
          <button type="submit" className="auth-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </form>
    </Shell>
  );
}
