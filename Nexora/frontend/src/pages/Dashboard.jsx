import { buildReport, downloadText } from "../report.js";
import { IsoArt } from "../illustrations.jsx";
import { Badge, Banner, Card, CategoryChart, EmptyState, PageHeader, PriorityBadge, SampleBadge, ScoreRing, Spinner, levelLabel } from "../components.jsx";
import { Icon } from "../icons.jsx";
import { go, sampleLabel, useApp } from "../store.jsx";

/** Shared guard used by Dashboard, Gaps and Roadmap so each page handles every state the same way. */
export function useAnalysisGate() {
  const app = useApp();
  const { profile, analysis } = app;
  if (!profile) {
    return {
      app,
      view: (
        <EmptyState icon="user" title="No profile yet"
          actions={<>
            <a className="btn btn-primary" href="#/profile">Build My Career Profile</a>
            <button className="btn btn-ghost" onClick={() => app.loadDemo("aarav")}>Try Demo Profile</button>
          </>}>
          Create a profile, or load a clearly labelled sample student, to see a real analysis.
        </EmptyState>
      ),
    };
  }
  if (analysis.status === "error") {
    const err = analysis.error;
    return {
      app,
      view: (
        <div className="stack">
          <Banner tone="error" title="The analysis could not be completed"
            action={<button className="btn btn-ghost" onClick={app.retry}><Icon name="refresh" /> Try again</button>}>
            {err ? err.message : "Unknown error."}
            {err && err.details && err.details.length > 0 && (
              <ul className="plain">{err.details.map((d, i) => <li key={i}>{d.field}: {d.message}</li>)}</ul>
            )}
          </Banner>
          {err && err.network && (
            <p className="muted">Start the backend with <code>uvicorn app.main:app --port 8000</code> from the <code>backend</code> folder, then try again. See the README.</p>
          )}
          <a className="btn btn-ghost fit" href="#/profile">Edit profile</a>
        </div>
      ),
    };
  }
  if (!analysis.data) {
    return { app, view: <div className="center-pad"><Spinner label="Analyzing your profile" /><p className="muted">Analyzing your profile…</p></div> };
  }
  return { app, data: analysis.data, loading: analysis.status === "loading", view: null };
}

export function CareerSwitch() {
  const { careers, careerId, selectCareer, analysis } = useApp();
  if (!careers.data) return null;
  return (
    <div className="switch">
      <label htmlFor="career-switch" className="label">Target career</label>
      <select id="career-switch" className="input" value={careerId || ""} onChange={(e) => selectCareer(e.target.value)} disabled={analysis.status === "loading"}>
        {careers.data.careers.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    </div>
  );
}

export function OfflineNotice() {
  const { analysis, retry } = useApp();
  if (!analysis.offline) return null;
  return (
    <Banner tone="warning" title="Showing your last saved results"
      action={<button className="btn btn-ghost" onClick={retry}><Icon name="refresh" /> Reconnect</button>}>
      The server could not be reached, so these numbers were calculated earlier and are not up to date.
    </Banner>
  );
}

function SkillList({ skills, empty }) {
  if (!skills.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="tags">
      {skills.map((s) => (
        <li key={s.skillId} className="tag">
          {s.name}
          {s.userLevel && <small>{levelLabel(s.userLevel)}</small>}
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const gate = useAnalysisGate();
  if (gate.view) return <div className="stack"><PageHeader title="Career dashboard" />{gate.view}</div>;
  const { app, data, loading } = gate;
  const { profile, recs } = app;
  const label = sampleLabel(profile);
  const career = data.selectedCareer;

  if (data.status === "insufficient_data") {
    return (
      <div className="stack">
        <PageHeader title="Career dashboard" subtitle={`${profile.name} · ${career.title}`}><CareerSwitch /></PageHeader>
        <Banner tone="warning" title="Not enough information to calculate a score">
          <ul className="plain">{data.analysisNotes.map((n, i) => <li key={i}>{n.message}</li>)}</ul>
        </Banner>
        <a className="btn btn-primary fit" href="#/profile">Add skills to my profile</a>
      </div>
    );
  }

  const cov = data.careerSkillCoverage;
  const summary = data.profileSummary;
  const ring = `Career Skill Coverage ${cov.percent} percent. ${cov.matched} of ${cov.total} required skills matched.`;
  const shownRecs = recs.status === "ready" ? recs.data : data.recommendations;
  const recSource = recs.status === "ready" ? recs.data.source : data.recommendations.source;

  return (
    <div className="stack">
      <PageHeader eyebrow="Your career, mapped" title={`Hi, ${profile.name.split(" ")[0]}.`} subtitle={`${profile.degree}, ${profile.branch} · ${profile.year}`}>
        <SampleBadge label={label} />
        <CareerSwitch />
        <button type="button" className="btn btn-ghost no-print" onClick={() => downloadText(`nexora-report-${career.id}.md`, buildReport(profile, data))}>Download report</button>
        <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>Print / save as PDF</button>
      </PageHeader>
      <OfflineNotice />
      {loading && <p className="muted small" role="status"><Spinner label="Updating" /> Updating analysis…</p>}

      <section className="banner" aria-label="Summary">
        <div className="banner-copy">
          <p className="eyebrow-label light">Compared with {career.title}</p>
          <h2>{cov.matched} of {cov.total} required skills matched.</h2>
          <p>{cov.missing + cov.inProgress > 0 ? `${cov.missing + cov.inProgress} skills left to close. Start with the priority gaps below.` : "You match every skill on this list. Keep building projects to show it."}</p>
          <div className="row wrap">
            <a className="btn banner-btn" href="#/gaps">See my gaps</a>
            <a className="btn banner-btn ghost" href="#/roadmap">Open roadmap <Icon name="arrow" size={14} /></a>
          </div>
        </div>
        <div className="banner-art"><IsoArt /></div>
      </section>

      <div className="tiles">
        {[["chart", `${cov.percent}%`, "Career Skill Coverage"], ["check", cov.matched, "Skills matched"], ["target", cov.missing, "Skills missing"], ["layers", summary.careerRelevantProjectCount, "Projects using required skills"]].map(([ic, v, l]) => (
          <div key={l} className="tile tilt"><span className="tile-icon"><Icon name={ic} size={18} /></span><strong>{v}</strong><span>{l}</span></div>
        ))}
      </div>

      <div className="grid-dash">
        <Card className="score-card" title="Career Skill Coverage" subtitle={`Compared with the illustrative ${career.title} skill list`}>
          <div className="score-wrap">
            <ScoreRing value={cov.percent} ariaLabel={ring} caption={`${cov.matched} of ${cov.total} skills`} />
            <div className="score-facts">
              <ul className="count-list">
                <li><span className="dot dot-matched" /> <strong>{cov.matched}</strong> matched</li>
                <li><span className="dot dot-progress" /> <strong>{cov.inProgress}</strong> in progress</li>
                <li><span className="dot dot-missing" /> <strong>{cov.missing}</strong> missing</li>
              </ul>
              <p className="small muted">{data.scoring.formula}</p>
            </div>
          </div>
          <details className="how">
            <summary>How is this calculated?</summary>
            <p>{data.scoring.matchRule}</p>
            <p>{data.scoring.depthDescription}</p>
            <p><strong>{data.scoring.disclaimer}</strong></p>
          </details>
        </Card>

        <Card title="Proficiency depth" subtitle="A separate measure, not part of the score">
          <div className="depth">
            <span className="depth-value">{data.proficiencyDepth.percent}<small>%</small></span>
            <p className="small muted">Credit for how strongly you rate each listed required skill (beginner 1/3, intermediate 2/3, advanced 1), averaged over all {cov.total} required skills.</p>
          </div>
        </Card>

        <Card title="Evidence on your profile">
          <dl className="stats">
            <div><dt>Projects</dt><dd>{summary.projectCount}</dd></div>
            <div><dt>Using required skills</dt><dd>{summary.careerRelevantProjectCount}</dd></div>
            <div><dt>Certifications</dt><dd>{summary.certificationCount}</dd></div>
            <div><dt>Experience</dt><dd>{summary.experienceCount}</dd></div>
            <div><dt>Achievements</dt><dd>{summary.achievementCount}</dd></div>
          </dl>
        </Card>
      </div>

      <div className="grid-2 align-start">
        <Card title="Skills by category" subtitle="Required skills grouped by area">
          <CategoryChart rows={data.categoryBreakdown} />
        </Card>
        <Card title="Strengths">
          {data.strengths.length ? (
            <ul className="strengths">
              {data.strengths.map((s) => (
                <li key={s.title}><Icon name="check" className="ok" /><div><strong>{s.title}</strong><p className="small muted">{s.detail}</p></div></li>
              ))}
            </ul>
          ) : <p className="muted">No strengths identified yet. Add skills at intermediate level or higher, projects, or experience.</p>}
        </Card>
      </div>

      <div className="grid-3 align-start">
        <Card title="Matched skills" subtitle={`${data.matchedSkills.length} of ${cov.total}`}>
          <SkillList skills={data.matchedSkills} empty="No required skills matched yet." />
        </Card>
        <Card title="In progress" subtitle="Listed at beginner level">
          <SkillList skills={data.inProgressSkills} empty="Nothing at beginner level." />
        </Card>
        <Card title="Missing skills" subtitle={`${data.missingSkills.length} not on your profile`}>
          <SkillList skills={data.missingSkills} empty="No missing skills. Nice." />
        </Card>
      </div>

      <div className="grid-2 align-start">
        <Card title="Priority improvement areas" action={<a className="link" href="#/gaps">All gaps <Icon name="arrow" size={14} /></a>}>
          {data.priorityGaps.length ? (
            <ol className="priority-list">
              {data.priorityGaps.map((g) => (
                <li key={g.skillId}>
                  <div className="row between wrap"><strong>{g.name}</strong><span className="row"><PriorityBadge priority={g.priority} /></span></div>
                  <p className="small muted">{g.why}</p>
                </li>
              ))}
            </ol>
          ) : <p className="muted">No gaps against this career's skill list.</p>}
        </Card>

        <Card title="Projects and experience">
          {summary.projectCount === 0 && summary.experienceCount === 0 && <p className="muted">No projects or experience added yet.</p>}
          {summary.projectCount > 0 && (
            <>
              <h3 className="mini">Projects ({summary.projectCount})</h3>
              <ul className="plain">
                {summary.projectTitles.map((t) => {
                  const rel = summary.careerRelevantProjects.find((p) => p.title === t);
                  return <li key={t}>{t} {rel ? <small className="muted">uses {rel.skills.join(", ")}</small> : <small className="muted">no required skills listed</small>}</li>;
                })}
              </ul>
            </>
          )}
          {summary.experienceCount > 0 && (
            <>
              <h3 className="mini">Experience</h3>
              <ul className="plain">{summary.experience.map((x, i) => <li key={i}>{x.role}{x.organization && ` · ${x.organization}`}</li>)}</ul>
            </>
          )}
          {summary.certificationCount > 0 && (
            <>
              <h3 className="mini">Certifications</h3>
              <ul className="plain">{summary.certifications.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
        </Card>
      </div>

      <Card
        title="Recommended next steps"
        subtitle={recSource === "ai" ? "Generated by an AI model and validated against your calculated gaps" : "Generated by deterministic rules from your calculated gaps (not AI)"}
        action={
          <button className="btn btn-ghost" onClick={app.requestAI} disabled={recs.status === "loading" || data.status !== "ok"}>
            {recs.status === "loading" ? <><Spinner label="Requesting" /> Asking…</> : <><Icon name="sparkles" /> Get AI-enhanced recommendations</>}
          </button>
        }
      >
        {recs.status === "error" && <Banner tone="warning" title="Could not request AI recommendations">{recs.error.message} The rule-based recommendations below are still valid.</Banner>}
        {recs.status === "ready" && (
          <Banner tone={recs.data.source === "ai" ? "success" : "info"} title={recs.data.source === "ai" ? "AI recommendations" : "Rule-based recommendations"}>{recs.data.message}</Banner>
        )}
        <ol className="recs">
          {shownRecs.items.map((r) => (
            <li key={r.id}>
              <div className="row between wrap">
                <strong>{r.title}</strong>
                <span className="row">{r.priority && <PriorityBadge priority={r.priority} />}{r.estimatedHours ? <Badge tone="neutral">~{r.estimatedHours}h estimate</Badge> : null}</span>
              </div>
              <p className="small">{r.why}</p>
              <p className="small muted"><strong>Next step:</strong> {r.nextStep}</p>
            </li>
          ))}
        </ol>
        {!shownRecs.items.length && <p className="muted">No recommendations needed right now.</p>}
      </Card>

      {data.analysisNotes.length > 0 && (
        <Card title="Analysis notes">
          <ul className="notes">
            {data.analysisNotes.map((n, i) => (
              <li key={i} className={`note-${n.level}`}><Icon name={n.level === "success" ? "check" : "info"} size={16} /> {n.message}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="row wrap">
        <a className="btn btn-primary" href="#/gaps">Open skill gap analyzer <Icon name="arrow" /></a>
        <a className="btn btn-ghost" href="#/roadmap">View my roadmap</a>
        <button className="btn btn-quiet" onClick={() => go("/profile")}>Edit profile</button>
      </div>
    </div>
  );
}
