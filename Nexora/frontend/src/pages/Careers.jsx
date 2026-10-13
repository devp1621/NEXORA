import { useEffect, useMemo, useState } from "react";
import { api, toApiProfile } from "../api.js";
import { Badge, Banner, Card, EmptyState, PageHeader, ProgressBar, Spinner } from "../components.jsx";
import { Icon } from "../icons.jsx";
import { go, useApp } from "../store.jsx";

/** Real coverage of the saved profile against every career, fetched from the backend. */
function useComparison(profile) {
  const { careers } = useApp();
  const [state, setState] = useState({ status: "idle", byCareer: {} });
  const signature = useMemo(() => (profile ? JSON.stringify(toApiProfile(profile)) : ""), [profile]);
  useEffect(() => {
    if (!profile || !careers.data) {
      setState({ status: "idle", byCareer: {} });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    Promise.all(careers.data.careers.map((c) => api.analyze(c.id, toApiProfile(profile)).then((r) => [c.id, r])))
      .then((pairs) => !cancelled && setState({ status: "ready", byCareer: Object.fromEntries(pairs) }))
      .catch(() => !cancelled && setState({ status: "error", byCareer: {} }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, careers.data]);
  return state;
}

const TIER_LABEL = { foundation: "Foundation", core: "Core", advanced: "Advanced" };

export default function Careers() {
  const app = useApp();
  const { careers, profile, careerId } = app;
  const [selected, setSelected] = useState(careerId || "fullstack");
  const comparison = useComparison(profile);

  if (careers.status === "loading") return <div className="center-pad"><Spinner label="Loading careers" /></div>;
  if (careers.status === "error") {
    return (
      <div className="stack">
        <PageHeader title="Career explorer" />
        <Banner tone="error" title="Career data could not be loaded" action={<button className="btn btn-ghost" onClick={app.reloadCareers}><Icon name="refresh" /> Try again</button>}>
          {careers.error.message}
        </Banner>
      </div>
    );
  }

  const list = careers.data.careers;
  const career = list.find((c) => c.id === selected) || list[0];
  const tiers = ["foundation", "core", "advanced"];

  const compare = async () => {
    if (!profile) return;
    await app.selectCareer(career.id);
    go("/dashboard");
  };

  return (
    <div className="stack">
      <PageHeader title="Career explorer" subtitle="Illustrative career profiles. Select one to see what it asks for and how your profile compares." />
      <Banner tone="info" title="About this data">{careers.data.disclaimer} You can edit the datasets in <code>backend/app/data</code>.</Banner>

      <div className="career-tabs" role="tablist" aria-label="Careers">
        {list.map((c) => {
          const res = comparison.byCareer[c.id];
          return (
            <button key={c.id} role="tab" aria-selected={c.id === career.id} className={`career-tab ${c.id === career.id ? "on" : ""}`} onClick={() => setSelected(c.id)}>
              <span className="career-tab-title">{c.title}</span>
              <span className="small muted">{c.totalRequiredSkills} required skills</span>
              {profile && (
                <span className="career-tab-score">
                  {comparison.status === "loading" && !res ? <Spinner label="Comparing" /> : res && res.careerSkillCoverage ? (
                    <><strong>{res.careerSkillCoverage.percent}%</strong> <span className="small muted">coverage for your profile</span></>
                  ) : <span className="small muted">no score</span>}
                </span>
              )}
              {profile && res && res.careerSkillCoverage && <ProgressBar value={res.careerSkillCoverage.percent} label={`${c.title} coverage ${res.careerSkillCoverage.percent} percent`} />}
            </button>
          );
        })}
      </div>

      <Card title={career.title} subtitle={career.tagline}
        action={profile ? (
          <button className="btn btn-primary" onClick={compare}>Compare with my profile <Icon name="arrow" /></button>
        ) : (
          <div className="row wrap"><a className="btn btn-primary" href="#/profile">Build my profile to compare</a><button className="btn btn-ghost" onClick={() => app.loadDemo("aarav")}>Try Demo Profile</button></div>
        )}>
        <p>{career.overview}</p>
      </Card>

      <Card title="Required technical skills" subtitle="Order shows a suggested learning sequence.">
        {tiers.map((tier) => {
          const reqs = career.requirements.filter((r) => r.tier === tier);
          if (!reqs.length) return null;
          return (
            <div key={tier} className="tier">
              <h3 className="mini">{TIER_LABEL[tier]}</h3>
              <ul className="req-list">
                {reqs.map((r) => (
                  <li key={r.skillId}>
                    <div className="row between wrap"><strong>{r.name}</strong><span className="row"><Badge tone={r.importance === "high" ? "indigo" : "neutral"}>{r.importance} importance</Badge><Badge tone="neutral">{r.category}</Badge></span></div>
                    <p className="small muted">{r.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Card>

      <div className="grid-2 align-start">
        <Card title="Relevant soft skills">
          <ul className="plain">{career.softSkills.map((s) => <li key={s.skillId}><strong>{s.name}</strong><p className="small muted">{s.why}</p></li>)}</ul>
        </Card>
        <Card title="Useful certifications and learning paths" subtitle="Examples only. Check the provider for current details.">
          <ul className="plain">{career.certifications.map((c) => <li key={c.name}>{c.name} <Badge tone="neutral">{c.type}</Badge></li>)}</ul>
        </Card>
      </div>

      <Card title="Suggested projects">
        <ul className="project-list">
          {career.projects.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong>
              <p className="small">{p.description}</p>
              <p className="small muted">Practises: {p.skills.join(", ")} · ~{p.effortHours}h (estimate)</p>
              <p className="small muted">Deliverable: {p.deliverable}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Short preparation roadmap">
        <ol className="plain steps">{career.roadmapSummary.map((r) => <li key={r.phase}><strong>{r.phase}.</strong> {r.summary}</li>)}</ol>
        <p className="small muted">Your personal roadmap, built from your actual gaps, is on the <a className="link" href="#/roadmap">Roadmap</a> page.</p>
      </Card>
    </div>
  );
}
