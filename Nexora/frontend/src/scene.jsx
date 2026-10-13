import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo.jsx";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------
   Backdrop: clay orbs floating behind the whole app. They drift on
   their own and shift a little with the pointer (parallax).
   ------------------------------------------------------------------ */
const ORBS = [
  // colour, size, left, top, parallax depth, blur, opacity, float seconds
  ["indigo", 380, "-15%", "68%", 26, 3, 0.8, 22],
  ["coral", 230, "86%", "4%", -38, 0, 1, 18],
  ["mint", 170, "72%", "76%", 46, 1, 0.95, 20],
  ["butter", 120, "47%", "-5%", -22, 2, 0.9, 16],
  ["pink", 270, "-7%", "-12%", 18, 2, 0.8, 24],
  ["sky", 150, "94%", "46%", -30, 1, 0.95, 19],
  ["violet", 96, "30%", "90%", 40, 0, 0.9, 17],
];

export function Backdrop() {
  const ref = useRef(null);
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="scene-bg" ref={ref} aria-hidden="true">
      {ORBS.map(([c, s, x, y, d, b, o, t], i) => (
        <span key={i} className={`orb o-${c}`} style={{ "--s": `${s}px`, "--x": x, "--y": y, "--d": d, "--b": `${b}px`, "--o": o, "--t": `${t}s`, "--dl": `${-i * 2.3}s` }}>
          <i />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   Global 3D tilt: any element with class "tilt" leans toward the pointer.
   ------------------------------------------------------------------ */
export function useGlobalTilt() {
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia("(hover: hover)").matches) return undefined;
    let current = null;
    const clear = (el) => {
      if (!el) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.classList.remove("is-tilting");
    };
    const onMove = (e) => {
      const t = e.target && e.target.closest ? e.target.closest(".tilt") : null;
      if (current && current !== t) clear(current);
      current = t;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      t.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
      t.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
      t.classList.add("is-tilting");
    };
    const onLeave = () => { clear(current); current = null; };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); };
  }, []);
}

/* ------------------------------------------------------------------
   Intro: ~5.9 seconds. Plays once per page load, can be skipped.
   0.0s  orbs fly in           2.1s  letters pop up one by one
   0.3s  clay mark is born     3.2s  tagline slides in
   1.2s  skill planets orbit   4.9s  iris closes, page appears (5.9s)
   ------------------------------------------------------------------ */
let introPlayed = false;
export const shouldPlayIntro = () => !introPlayed && !reducedMotion();

const PHASES = [[0, "Warming up the clay"], [1400, "Shaping your profile"], [2800, "Polishing the glass"], [4200, "Ready when you are"]];
const INTRO_ORBS = [
  ["indigo", 300, "-6%", "62%", "-200px", "200px", "0s"],
  ["coral", 200, "82%", "-4%", "160px", "-220px", "0.15s"],
  ["mint", 150, "76%", "70%", "200px", "160px", "0.3s"],
  ["butter", 110, "10%", "8%", "-160px", "-120px", "0.45s"],
  ["pink", 190, "-4%", "-10%", "-120px", "-200px", "0.2s"],
  ["sky", 130, "90%", "40%", "220px", "0px", "0.35s"],
  ["violet", 90, "56%", "90%", "0px", "200px", "0.5s"],
];
const WORD = "Nexora".split("");

function Planet({ cls, ph, children }) {
  return (
    <span className="planet-x" style={{ "--ph": ph }}>
      <span className="planet-y" style={{ "--ph": ph }}>
        <span className={`planet o-${cls}`}>{children}</span>
      </span>
    </span>
  );
}

export function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState(PHASES[0][1]);
  const timers = useRef([]);

  const finish = (delay = 0) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLeaving(true);
    timers.current.push(setTimeout(() => { introPlayed = true; onDone(); }, delay + 950));
  };

  useEffect(() => {
    document.documentElement.classList.add("intro-lock");
    PHASES.slice(1).forEach(([ms, label]) => timers.current.push(setTimeout(() => setPhase(label), ms)));
    timers.current.push(setTimeout(() => finish(), 4900));
    return () => { timers.current.forEach(clearTimeout); document.documentElement.classList.remove("intro-lock"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`intro${leaving ? " leaving" : ""}`} role="status" aria-label="Loading Nexora">
      <div className="intro-orbs" aria-hidden="true">
        {INTRO_ORBS.map(([c, s, x, y, fx, fy, fd], i) => (
          <span key={i} className={`orb o-${c}`} style={{ "--s": `${s}px`, "--x": x, "--y": y, "--d": 0, "--fx": fx, "--fy": fy, "--fd": fd, "--t": `${14 + i}s`, "--dl": `${-i * 1.7}s` }}><i /></span>
        ))}
      </div>
      <div className="intro-stage">
        <div className="intro-hero" aria-hidden="true">
          <span className="intro-shadow" />
          <span className="intro-track" />
          <Planet cls="sky" ph="0s">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>
          </Planet>
          <Planet cls="mint" ph="-1.333s">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M5 20V12M12 20V5M19 20v-5" /></svg>
          </Planet>
          <Planet cls="coral" ph="-2.666s">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          </Planet>
          <div className="intro-logo">
            <div className="intro-spin"><Logo size={150} /></div>
          </div>
        </div>
        <div className="intro-word" aria-hidden="true">
          {WORD.map((ch, i) => <span key={i} style={{ "--i": i }}>{ch}</span>)}
        </div>
        <p className="intro-tag glass-chip">Your Potential, Your Next Frontier</p>
        <div className="intro-load" aria-hidden="true">
          <div className="bar"><div className="bar-fill bar-cyan" /></div>
          <span className="intro-status">{phase}</span>
        </div>
      </div>
      <button type="button" className="btn btn-ghost intro-skip" onClick={() => finish()}>Skip intro</button>
    </div>
  );
}

/* ------------------------------------------------------------------
   Hero3D: a pointer-reactive clay world. Steps climb toward a flag,
   a glass score card floats in front, skill pills orbit around it.
   ------------------------------------------------------------------ */
function Layers({ n, step = 3 }) {
  return Array.from({ length: n }, (_, k) => <i key={k} style={{ transform: `translateZ(${-(k + 1) * step}px)` }} />);
}

function Slab({ w, h, depth = 30, tone }) {
  return (
    <div className={`slab slab-${tone}`} style={{ "--w": `${w}px`, "--h": `${h}px` }}>
      <Layers n={Math.round(depth / 3)} />
      <b />
    </div>
  );
}

function Obj({ x, y, z = 0, i = 0, t, dl, bob, r0, r1, children }) {
  return (
    <div className="h3d-o" style={{ "--x": x, "--y": y, "--z": `${z}px` }}>
      <div className="h3d-enter" style={{ "--i": i }}>
        <div className="h3d-bob" style={{ "--t": t, "--dl": dl, "--bob": bob, "--r0": r0, "--r1": r1 }}>{children}</div>
      </div>
    </div>
  );
}

export function Hero3D() {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  };
  const steps = [[70, 70, "c1"], [70, 110, "c2"], [70, 150, "c4"], [70, 190, "c5"], [70, 230, "c3"]];
  return (
    <div className="h3d" ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} aria-label="Interactive 3D illustration of a student's skill score, steps toward a goal and skill tags" role="img">
      <div className="h3d-tilt">
        <div className="h3d-sway">
          <div className="h3d-floor" />

          {/* the five steps */}
          {steps.map(([w, h, tone], k) => (
            <Obj key={k} x={`${170 + k * 74}px`} y={`${520 - h}px`} z={-70 + k * 4} i={k} t={`${7 + k}s`} dl={`${-k * 1.1}s`} bob="-8px" r0="0deg" r1="0deg">
              <Slab w={w} h={h} depth={36} tone={tone} />
            </Obj>
          ))}

          {/* flag on the top step */}
          <Obj x="474px" y="178px" z={-50} i={5} t="6s" bob="-6px" r0="0deg" r1="0deg">
            <div className="clay-flag" />
          </Obj>

          {/* big indigo ball behind the card */}
          <Obj x="64px" y="-84px" z={-150} i={1} t="9s" bob="-18px" r0="0deg" r1="0deg">
            <div className="clay-ball o-indigo" style={{ "--s": "210px" }} />
          </Obj>

          {/* coral donut */}
          <Obj x="296px" y="140px" z={120} i={6} t="8s" dl="-2s" bob="-22px" r0="-8deg" r1="10deg">
            <svg width="170" height="170" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <linearGradient id="dn-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd9cf" /><stop offset="0.5" stopColor="#ff9d8c" /><stop offset="1" stopColor="#e9705f" /></linearGradient>
                <filter id="dn-s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="9" floodColor="#b43c2d" floodOpacity="0.4" /></filter>
                <filter id="dn-b"><feGaussianBlur stdDeviation="2.2" /></filter>
              </defs>
              <circle cx="100" cy="100" r="60" fill="none" stroke="url(#dn-g)" strokeWidth="46" filter="url(#dn-s)" />
              <circle cx="100" cy="100" r="40" fill="none" stroke="#b43c2d" strokeOpacity="0.28" strokeWidth="5" filter="url(#dn-b)" />
              <circle cx="100" cy="100" r="62" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="9" strokeLinecap="round" strokeDasharray="70 320" transform="rotate(188 100 100)" filter="url(#dn-b)" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#b43c2d" strokeOpacity="0.22" strokeWidth="5" strokeDasharray="120 400" transform="rotate(20 100 100)" filter="url(#dn-b)" />
            </svg>
          </Obj>

          {/* the glass score card */}
          <Obj x="14px" y="78px" z={80} i={2} t="8s" bob="-12px" r0="-1deg" r1="1deg">
            <div className="h3d-card">
              <header>
                <div className="h3d-ring">
                  <svg viewBox="0 0 92 92" aria-hidden="true">
                    <defs><linearGradient id="hr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8f9bff" /><stop offset="1" stopColor="#9a73ff" /></linearGradient></defs>
                    <circle cx="46" cy="46" r="40" fill="none" stroke="#dfe2fb" strokeWidth="9" />
                    <circle className="arc" cx="46" cy="46" r="40" fill="none" stroke="url(#hr-g)" strokeWidth="9" strokeLinecap="round" transform="rotate(-90 46 46)" style={{ filter: "drop-shadow(0 3px 3px rgba(67,80,217,.4))" }} />
                  </svg>
                  <strong>78%</strong>
                </div>
                <div>
                  <p className="k">Skill coverage</p>
                  <p className="v">Full-Stack Developer</p>
                </div>
              </header>
              <ul className="h3d-rows">
                <li style={{ "--i": 0 }}>React<div className="bar"><div className="bar-fill" style={{ "--v": "92%", background: "linear-gradient(90deg,#55e0b4,#14a77c)" }} /></div></li>
                <li style={{ "--i": 1 }}>Node.js<div className="bar"><div className="bar-fill" style={{ "--v": "64%", background: "linear-gradient(90deg,#ffd978,#f2a900)" }} /></div></li>
                <li style={{ "--i": 2 }}>Docker<div className="bar"><div className="bar-fill" style={{ "--v": "28%", background: "linear-gradient(90deg,#ff94a2,#e0475b)" }} /></div></li>
              </ul>
              <p className="tag-live"><i /> Sample numbers, for illustration</p>
            </div>
          </Obj>

          {/* the clay N */}
          <Obj x="6px" y="388px" z={160} i={7} t="7s" dl="-1s" bob="-16px" r0="-6deg" r1="5deg">
            <Logo size={104} />
          </Obj>

          {/* skill pills */}
          <Obj x="350px" y="40px" z={110} i={8} t="6s" bob="-10px" r0="-3deg" r1="3deg"><span className="clay-pill" style={{ "--pc": "#5b6af5" }}><i /> React</span></Obj>
          <Obj x="14px" y="14px" z={60} i={9} t="7s" dl="-1.5s" bob="-12px" r0="3deg" r1="-3deg"><span className="clay-pill" style={{ "--pc": "#14a77c" }}><i /> Python</span></Obj>
          <Obj x="96px" y="492px" z={150} i={10} t="6.5s" dl="-3s" bob="-10px" r0="2deg" r1="-2deg"><span className="clay-pill" style={{ "--pc": "#ff8a7a" }}><i /> SQL</span></Obj>

          {/* small spheres */}
          <Obj x="476px" y="104px" z={40} i={11} t="5s" dl="-0.5s" bob="-20px" r0="0deg" r1="0deg"><div className="clay-ball o-butter" style={{ "--s": "58px" }} /></Obj>
          <Obj x="-44px" y="262px" z={-30} i={12} t="6s" dl="-2.5s" bob="-16px" r0="0deg" r1="0deg"><div className="clay-ball o-mint" style={{ "--s": "46px" }} /></Obj>
          <Obj x="292px" y="-8px" z={30} i={13} t="7s" dl="-4s" bob="-14px" r0="0deg" r1="0deg"><div className="clay-ball o-pink" style={{ "--s": "40px" }} /></Obj>
        </div>
      </div>
    </div>
  );
}
