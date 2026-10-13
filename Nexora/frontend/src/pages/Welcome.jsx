import { useEffect, useMemo, useState } from "react";
import { GapsArt, ProfileArt, RoadmapArt } from "../illustrations.jsx";
import { Hero3D, Intro, shouldPlayIntro } from "../scene.jsx";
import { Icon } from "../icons.jsx";
import { Logo } from "../logo.jsx";
import { useApp } from "../store.jsx";

const STEPS = [
  ["Build your profile", "Add skills with a level, projects, certificates and experience."],
  ["Pick a career", "Choose a path. Nexora compares your profile with its required skills."],
  ["See the gaps", "Every skill is matched, in progress or missing, with the reason it matters."],
  ["Get next steps", "Recommendations come from your actual gaps, not a generic list."],
  ["Follow the roadmap", "Four phases, from fundamentals to interview preparation. Tick tasks off as you go."],
];

const WHO = [
  ["compass", "Exploring", "Not sure which path fits? Compare your skills with career paths in web, data, security and more, and see where you stand today."],
  ["layers", "Building", "Turn courses and side projects into a clear list of skills to learn next and projects to build."],
  ["briefcase", "Preparing", "Find the gaps that remain before internships and interviews, then follow a roadmap to close them."],
];

const CAREER_ICON = { fullstack: "layers", frontend: "layout", backend: "server", datascientist: "chart", dataanalyst: "table", cybersecurity: "shield", devops: "cloud", mobile: "phone", qa: "bug" };

const FEATURES = [
  ["user", "Profile builder", "Skills with levels, projects, certificates, experience and achievements in one place."],
  ["target", "Gap analysis", "Each required skill shows as matched, in progress or missing, with the reason it matters."],
  ["sparkles", "Recommendations", "Courses, projects and certificates chosen from your own gaps, not a generic list."],
  ["route", "Roadmap tracker", "Four phases of tasks with effort estimates. Tick them off and your progress is saved."],
  ["chat", "Ask the assistant", "A side chat that explains your score, your gaps and what to learn first. Every reply is labelled."],
  ["lock", "Your account, your data", "Sign in to keep your profile and progress on any device, or stay a guest with no sign-up."],
];

const NOT_CLAIMED = [
  "The score shows skill overlap with an example skill list. It does not predict whether you will be hired.",
  "Career skill lists are illustrative and editable. They are not official industry standards.",
  "Proficiency depth is reported separately and never changes the coverage score.",
];

const FAQ = [
  ["Do I need an account?", "No. Continue as a guest and everything works. Guest work is saved in this browser only. With an account, your profile, roadmap progress and chat history are saved to your account and follow you to any device."],
  ["Is my data private?", "Passwords are stored as one-way hashes and are never kept in plain text. A guest profile is sent to the Nexora server to calculate your analysis, and is not stored there."],
  ["How are my skills matched to a career?", "Names are cleaned up first, so ReactJS and React count as the same skill. A required skill counts as matched when you list it at intermediate or advanced level. Beginner level shows as in progress."],
  ["Does the score predict whether I will get a job?", "No. Career Skill Coverage only measures how many of a career's listed skills you have. Hiring depends on much more than a skill list."],
  ["Where do the career skill lists come from?", "They are example datasets written for this project, and you can edit them. They are not official industry standards."],
  ["Does Nexora use AI?", "The analysis is plain rules you can check by hand. The chat assistant also answers from rules, unless the site owner connects an AI model. Every chat reply says whether it is rule-based or AI-generated."],
];

export default function Welcome() {
  const { auth, careers, profile } = useApp();
  const [intro, setIntro] = useState(shouldPlayIntro);
  const ready = !intro;
  const signedIn = auth.status === "user";
  const continueHref = profile ? "#/dashboard" : "#/profile";
  const careerList = careers.status === "ready" && careers.data ? careers.data.careers : null;

  const stats = useMemo(() => {
    if (!careerList) return null;
    const ids = new Set();
    careerList.forEach((k) => k.requirements.forEach((r) => ids.add(r.skillId)));
    const projects = careerList.reduce((n, k) => n + k.projects.length, 0);
    return [[String(careerList.length), "career paths"], [String(ids.size), "technical skills tracked"], [String(projects), "suggested projects"], ["5", "steps from profile to roadmap"]];
  }, [careerList]);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".w .reveal"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => { io.disconnect(); document.documentElement.classList.remove("js-reveal"); };
  }, [careerList]);

  useEffect(() => {
    document.title = "Nexora: see which skills stand between you and your career";
  }, []);

  const jump = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const ctas = signedIn ? (
    <a className="btn btn-primary btn-lg" href={continueHref}>Continue to Nexora <Icon name="arrow" /></a>
  ) : (
    <>
      <a className="btn btn-primary btn-lg" href="#/login?mode=signup">Create account</a>
      <a className="btn btn-ghost btn-lg" href="#/login">Sign in</a>
    </>
  );

  return (
    <div className={`w${ready ? " ready" : ""}`}>
      {intro && <Intro onDone={() => setIntro(false)} />}
      <header className="w-nav glass">
        <div className="w-wrap w-nav-in">
          <a href="#/" className="brand" aria-label="Nexora"><Logo size={34} /><span>Nex<b>ora</b></span></a>
          <nav className="w-links" aria-label="Sections">
            <a href="#features" onClick={jump("features")}>Features</a>
            <a href="#how" onClick={jump("how")}>How it works</a>
            <a href="#careers" onClick={jump("careers")}>Careers</a>
            <a href="#faq" onClick={jump("faq")}>FAQ</a>
          </nav>
          <div className="row">
            {signedIn ? (
              <a className="btn btn-primary" href={continueHref}>Continue to Nexora</a>
            ) : (
              <>
                <a className="btn btn-quiet" href="#/login">Sign in</a>
                <a className="btn btn-primary" href="#/login?mode=signup">Get started</a>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="w-wrap w-hero">
        <div className="w-hero-copy">
          <p className="w-pill glass-chip rise" style={{ "--r": 0 }}><Icon name="flag" size={14} /> Built for the IEEE Day Hackathon 2026</p>
          <h1 className="w-h1 rise" style={{ "--r": 1 }}>See exactly which skills stand between you and your career.</h1>
          <p className="w-lede rise" style={{ "--r": 2 }}>
            Nexora puts your skills, projects and certificates in one profile, compares it with the career you pick, and turns every gap into a task you can tick off.
          </p>
          <div className="row wrap w-cta rise" style={{ "--r": 3 }}>{ctas}</div>
          {!signedIn && <p className="small muted w-guest rise" style={{ "--r": 4 }}>Just looking? <a href="#/home">Continue as guest</a>. No account needed.</p>}
        </div>
        <div className="w-hero-art"><Hero3D /></div>
      </section>

      {stats && (
        <section className="w-wrap w-stats glass reveal" aria-label="Nexora at a glance">
          {stats.map(([n, l]) => <div key={l}><strong>{n}</strong><span>{l}</span></div>)}
        </section>
      )}

      <section id="features" className="w-sec">
        <div className="w-wrap">
          <h2 className="w-h2">Everything you need to plan your next step</h2>

          <div className="w-row">
            <div className="w-copy">
              <h3>One profile for everything you have done</h3>
              <p>Education, skills with a proficiency level, projects, certificates, experience and achievements, all in one place. Edit it any time and your analysis updates.</p>
              <a className="link" href="#/profile">Build your profile</a>
            </div>
            <div className="w-visual"><ProfileArt /></div>
          </div>

          <div className="w-row flip">
            <div className="w-copy">
              <h3>Gaps explained, not just counted</h3>
              <p>For every missing or beginner-level skill you get the reason it matters for the career, a priority, what to study and a practical exercise to prove it.</p>
              <a className="link" href="#/careers">See what each career asks for</a>
            </div>
            <div className="w-visual"><GapsArt /></div>
          </div>

          <div className="w-row">
            <div className="w-copy">
              <h3>A roadmap that follows your gaps</h3>
              <p>Gaps become ordered tasks with an activity, a deliverable and an effort estimate. Tick them off and your progress is saved to your browser or your account.</p>
              <a className="link" href="#/home">Take a look inside</a>
            </div>
            <div className="w-visual"><RoadmapArt /></div>
          </div>

          <h3 className="w-h3">And everything around it</h3>
          <div className="w-feats">
            {FEATURES.map(([icon, t, d]) => (
              <div key={t} className="w-feat reveal tilt">
                <span className="w-who-icon"><Icon name={icon} size={20} /></span>
                <h4>{t}</h4>
                <p className="small muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="w-sec w-alt">
        <div className="w-wrap">
          <h2 className="w-h2">How it works</h2>
          <ol className="w-steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="w-step-n">{i + 1}</span><strong>{t}</strong><p className="small muted">{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="w-sec">
        <div className="w-wrap">
          <h2 className="w-h2">Wherever you are in your degree</h2>
          <div className="w-who">
            {WHO.map(([icon, t, d]) => (
              <div key={t} className="reveal tilt">
                <span className="w-who-icon"><Icon name={icon} size={20} /></span>
                <h3>{t}</h3>
                <p className="muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="careers" className="w-sec w-alt">
        <div className="w-wrap">
          <h2 className="w-h2">{careerList ? `${careerList.length} career paths` : "Career paths"} to compare against</h2>
          <p className="w-sub">Each path lists the skills it asks for, with the reason, a learning topic and an exercise for every one.</p>
          {careerList && (
            <div className="w-careers">
              {careerList.map((k) => (
                <article key={k.id} className="w-career reveal tilt">
                  <span className="w-who-icon"><Icon name={CAREER_ICON[k.id] || "compass"} size={20} /></span>
                  <h3>{k.title}</h3>
                  <p className="small muted">{k.tagline}</p>
                  <ul className="w-skillrow">
                    {k.requirements.slice(0, 5).map((r) => <li key={r.skillId}>{r.name}</li>)}
                    {k.requirements.length > 5 && <li className="more">+{k.requirements.length - 5} more</li>}
                  </ul>
                  <p className="small muted">{k.totalRequiredSkills} required skills, {k.projects.length} suggested projects</p>
                </article>
              ))}
            </div>
          )}
          <a className="link" href="#/careers">Explore the careers</a>
        </div>
      </section>

      <section id="score" className="w-sec">
        <div className="w-wrap w-score">
          <div>
            <h2 className="w-h2">A score you can check by hand</h2>
            <p className="w-sub">Career Skill Coverage counts the required skills you list at intermediate level or above. Nothing is hidden or weighted.</p>
            <ul className="w-notes">
              {NOT_CLAIMED.map((n) => <li key={n}><Icon name="check" size={16} /> {n}</li>)}
            </ul>
          </div>
          <div className="w-formula" aria-label="Score formula with a worked example">
            <p className="small muted">Career Skill Coverage =</p>
            <p className="w-frac"><span className="w-fr"><span>matched required skills</span><span>total required skills</span></span><b>× 100</b></p>
            <p className="w-example">
              <span className="small muted">Worked example with illustrative numbers:</span><br />
              A student who matches 5 of 10 required skills: 5 ÷ 10 × 100 = <strong>50%</strong>
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="w-sec w-alt">
        <div className="w-wrap w-faq">
          <div>
            <h2 className="w-h2">Questions you might have</h2>
            <p className="w-sub">Short answers about accounts, privacy and how the score works.</p>
          </div>
          <div>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p className="muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="w-wrap w-final reveal">
        <div>
          <h2 className="w-h2">Start with your own profile</h2>
          <p className="w-sub">It takes a few minutes, and you can change anything later.</p>
        </div>
        <div className="row wrap">
          {ctas}
          {!signedIn && <a className="link" href="#/home">Continue as guest</a>}
        </div>
      </section>

      <footer className="w-foot glass">
        <div className="w-wrap w-foot-in">
          <div>
            <a href="#/" className="brand" aria-label="Nexora"><Logo size={30} /><span>Nex<b>ora</b></span></a>
            <p className="small muted">Your Potential, Your Next Frontier</p>
          </div>
          <div>
            <p className="w-foot-h">Explore</p>
            <a href="#/careers">Careers</a>
            <a href="#/about">About and impact</a>
            <a href="#/home">Home</a>
          </div>
          <div>
            <p className="w-foot-h">Account</p>
            <a href="#/login">Sign in</a>
            <a href="#/login?mode=signup">Create account</a>
            <a href="#/home">Continue as guest</a>
          </div>
          <p className="small muted w-foot-note">Built for the IEEE Day Hackathon 2026, Problem Statement 2: Smart Student Career Profile.</p>
        </div>
      </footer>
    </div>
  );
}
