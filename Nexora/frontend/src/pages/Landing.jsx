import { Logo } from "../logo.jsx";
import { useEffect, useState } from "react";
import { api, toApiProfile } from "../api.js";
import { Badge, ScoreRing, Spinner } from "../components.jsx";
import { DEMOS } from "../demo.js";
import { Icon } from "../icons.jsx";
import { go, useApp } from "../store.jsx";

export const FEATURES = [
  { icon: "user", title: "Career Profile", text: "One structured profile for education, skills with proficiency, projects, certifications, experience and achievements." },
  { icon: "target", title: "Skill Gap Analysis", text: "Compare your profile with a career's required skills. See what is matched, in progress or missing, and why each gap matters." },
  { icon: "route", title: "Personalized Roadmap", text: "Turn gaps into ordered tasks with activities, deliverables and effort estimates. Tick them off and your progress is saved." },
];

export const STEPS = [
  ["Profile", "Enter your skills, projects and experience, or load a sample student."],
  ["Analyze", "The backend normalizes your skills and compares them with the chosen career."],
  ["Identify gaps", "Every missing or beginner-level skill is explained and prioritized."],
  ["Recommend", "Next steps come from your actual gaps. Optional AI can elaborate on them."],
  ["Build a roadmap", "Work through four phases, from fundamentals to interview preparation."],
];

export function Preview() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    const demo = DEMOS.aarav;
    api.analyze(demo.careerId, toApiProfile(demo.profile))
      .then((data) => live && setState({ status: "ready", data }))
      .catch(() => live && setState({ status: "error" }));
    return () => { live = false; };
  }, []);

  return (
    <div className="preview" aria-label="Dashboard preview using sample data">
      <div className="preview-bar"><span /><span /><span /><Badge tone="cyan">Preview · sample data, calculated live by the backend</Badge></div>
      {state.status === "loading" && <div className="center-pad"><Spinner label="Loading preview" /></div>}
      {state.status === "error" && <p className="muted pad">Start the backend to see a live preview here.</p>}
      {state.status === "ready" && (() => {
        const d = state.data;
        const c = d.careerSkillCoverage;
        return (
          <div className="preview-body">
            <div className="preview-score">
              <ScoreRing value={c.percent} size={140} caption={`${c.matched} of ${c.total} skills`} ariaLabel={`Sample Career Skill Coverage ${c.percent} percent`} />
              <p className="small muted">Career Skill Coverage<br />{d.selectedCareer.title}</p>
            </div>
            <div className="preview-gaps">
              <h3 className="mini">Top priority gaps</h3>
              <ol className="plain">
                {d.priorityGaps.slice(0, 4).map((g) => (
                  <li key={g.skillId} className="row between"><span>{g.name}</span><Badge tone={g.priority === "High" ? "red" : "amber"}>{g.priority}</Badge></li>
                ))}
              </ol>
              <p className="small muted">{d.roadmap.totalItems} roadmap tasks · ~{d.roadmap.totalEstimatedHours}h (estimate)</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function Landing() {
  const app = useApp();
  const tryDemo = async () => {
    const r = await app.loadDemo("aarav");
    if (r.ok || !r.stale) go("/dashboard");
  };
  return (
    <div className="landing">
      <section className="hero">
        <Badge tone="indigo">IEEE Day Hackathon 2026 · Smart Student Career Profile</Badge>
        <h1 className="hero-title"><Logo size={56} /><span className="grad">Nexora</span></h1>
        <p className="tagline">Your Potential, Your Next Frontier</p>
        <p className="lede">
          Students collect skills, projects and certificates in scattered places, so it is hard to see how ready they are for a goal.
          Nexora brings them into one profile, compares it with a chosen career using a transparent formula, and turns every gap into a concrete roadmap task.
        </p>
        <div className="row wrap hero-actions">
          <a className="btn btn-primary btn-lg" href="#/profile">Build My Career Profile <Icon name="arrow" /></a>
          <button className="btn btn-ghost btn-lg" onClick={tryDemo}><Icon name="sparkles" /> Try Demo Profile</button>
          <a className="link" href="#/careers">Explore careers</a>
        </div>
        <p className="small muted">The demo loads a fictional student, clearly labelled as sample data.</p>
      </section>

      <Preview />

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="section-h">What it does</h2>
        <div className="grid-3">
          {FEATURES.map((f) => (
            <article className="card feature tilt" key={f.title}>
              <div className="feature-icon"><Icon name={f.icon} size={22} /></div>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h">
        <h2 id="how-h" className="section-h">How it works</h2>
        <ol className="flow">
          {STEPS.map(([t, d], i) => (
            <li key={t}><span className="flow-n">{i + 1}</span><strong>{t}</strong><span className="small muted">{d}</span></li>
          ))}
        </ol>
        <p className="small muted">Career Skill Coverage = matched required skills ÷ total required skills × 100. It describes skill overlap with an example dataset. It does not predict hiring outcomes.</p>
      </section>
    </div>
  );
}
