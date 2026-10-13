import { useState } from "react";
import { Badge, Card, LEVELS, PageHeader, PriorityBadge, SampleBadge, StatusBadge, levelLabel } from "../components.jsx";
import { Icon } from "../icons.jsx";
import { sampleLabel } from "../store.jsx";
import { CareerSwitch, OfflineNotice, useAnalysisGate } from "./Dashboard.jsx";

function GapCard({ gap, onLearned, busy }) {
  const [level, setLevel] = useState("intermediate");
  const progress = gap.status === "in_progress";
  return (
    <li className="gap" id={`gap-${gap.skillId}`}>
      <div className="gap-order" aria-label={`Suggested completion order ${gap.suggestedOrder}`}>{gap.suggestedOrder}</div>
      <div className="gap-main">
        <div className="row between wrap">
          <h3>{gap.name}</h3>
          <span className="row wrap"><StatusBadge status={gap.status} /><PriorityBadge priority={gap.priority} /><Badge tone="neutral">{gap.category}</Badge></span>
        </div>
        {progress && <p className="small muted">You list this at {levelLabel(gap.userLevel).toLowerCase()} level. Reach intermediate to count it as matched.</p>}
        <dl className="gap-dl">
          <div><dt>Why it matters</dt><dd>{gap.why}</dd></div>
          <div><dt>Recommended learning topic</dt><dd>{gap.learningTopic}</dd></div>
          <div><dt>Practical exercise</dt><dd>{gap.exercise}</dd></div>
          <div><dt>Effort</dt><dd>~{gap.estimatedHours} hours <span className="muted">(estimate)</span></dd></div>
          {gap.usedInProjects.length > 0 && <div><dt>Seen in your projects</dt><dd>{gap.usedInProjects.join(", ")}</dd></div>}
        </dl>
        <div className="row wrap learned">
          <label className="sr-only" htmlFor={`lvl-${gap.skillId}`}>Level for {gap.name}</label>
          <select id={`lvl-${gap.skillId}`} className="input input-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onLearned(gap.name, level)}>
            <Icon name="check" /> I have learned this: update my profile
          </button>
        </div>
      </div>
    </li>
  );
}

export default function Gaps() {
  const gate = useAnalysisGate();
  const [filter, setFilter] = useState("all");
  if (gate.view) return <div className="stack"><PageHeader title="Skill gap analyzer" />{gate.view}</div>;
  const { app, data, loading } = gate;

  if (data.status === "insufficient_data") {
    return (
      <div className="stack">
        <PageHeader title="Skill gap analyzer" />
        <p className="muted">{data.analysisNotes[0].message}</p>
        <a className="btn btn-primary fit" href="#/profile">Add skills to my profile</a>
      </div>
    );
  }

  const gaps = [...data.missingSkills, ...data.inProgressSkills].sort((a, b) => a.suggestedOrder - b.suggestedOrder);
  const shown = filter === "missing" ? data.missingSkills.slice().sort((a, b) => a.suggestedOrder - b.suggestedOrder)
    : filter === "progress" ? data.inProgressSkills
    : filter === "matched" ? [] : gaps;
  const tabs = [
    { id: "all", label: `All gaps (${gaps.length})` },
    { id: "missing", label: `Missing (${data.missingSkills.length})` },
    { id: "progress", label: `In progress (${data.inProgressSkills.length})` },
    { id: "matched", label: `Matched (${data.matchedSkills.length})` },
  ];

  return (
    <div className="stack">
      <PageHeader title="Skill gap analyzer" subtitle={`${data.selectedCareer.title}: each requirement from the career dataset, ordered by what to learn first.`}>
        <SampleBadge label={sampleLabel(app.profile)} />
        <CareerSwitch />
      </PageHeader>
      <OfflineNotice />
      <div className="tabs" role="tablist" aria-label="Filter skills">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={filter === t.id} className={`tab ${filter === t.id ? "on" : ""}`} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
      </div>
      <p className="muted small" role="status">{loading ? "Updating…" : "Order is by learning tier (foundation, core, advanced), then by the dataset's suggested sequence."}</p>

      {filter === "matched" ? (
        data.matchedSkills.length ? (
          <ul className="matched-list">
            {data.matchedSkills.map((s) => (
              <li key={s.skillId}>
                <div className="row between wrap"><strong>{s.name}</strong><span className="row"><StatusBadge status="matched" /><Badge tone="neutral">{levelLabel(s.userLevel)}</Badge></span></div>
                <p className="small muted">Listed as &ldquo;{s.listedAs}&rdquo;{s.usedInProjects.length ? ` · used in ${s.usedInProjects.join(", ")}` : ""}</p>
              </li>
            ))}
          </ul>
        ) : <Card><p className="muted">No required skills matched yet.</p></Card>
      ) : shown.length ? (
        <ol className="gaps">
          {shown.map((g) => <GapCard key={g.skillId} gap={g} busy={loading} onLearned={(name, level) => app.addSkill(g.listedAs || name, level)} />)}
        </ol>
      ) : (
        <Card><p className="muted">Nothing in this group. {filter === "all" ? "You match every skill in this career's list." : ""}</p></Card>
      )}
    </div>
  );
}
