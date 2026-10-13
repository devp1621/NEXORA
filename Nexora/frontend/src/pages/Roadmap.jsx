import { useState } from "react";
import { Badge, Card, PageHeader, PriorityBadge, ProgressBar, SampleBadge } from "../components.jsx";
import { Icon } from "../icons.jsx";
import { sampleLabel } from "../store.jsx";
import { CareerSwitch, OfflineNotice, useAnalysisGate } from "./Dashboard.jsx";

function Item({ item, done, onToggle, onAddSkill, busy }) {
  const [added, setAdded] = useState(false);
  const checkId = `task-${item.id}`;
  return (
    <li className={`task ${done ? "done" : ""}`}>
      <input id={checkId} type="checkbox" className="check" checked={done} onChange={() => onToggle(item.id)} aria-describedby={`${checkId}-meta`} />
      <div className="task-body">
        <label htmlFor={checkId} className="task-title">{item.objective}</label>
        <div className="row wrap" id={`${checkId}-meta`}>
          <PriorityBadge priority={item.priority} />
          <Badge tone="neutral"><Icon name="clock" size={12} /> ~{item.estimatedHours}h (estimate)</Badge>
          {done && <Badge tone="green">Completed</Badge>}
        </div>
        <dl className="task-dl">
          <div><dt>Why</dt><dd>{item.reason}</dd></div>
          <div><dt>Activity</dt><dd>{item.activity}</dd></div>
          <div><dt>Deliverable</dt><dd>{item.deliverable}</dd></div>
        </dl>
        {done && item.skillId && !added && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setAdded(true); onAddSkill(item); }}>
            <Icon name="plus" /> Add to my skills as Intermediate and re-run analysis
          </button>
        )}
        {added && <p className="small ok-text"><Icon name="check" size={14} /> Added to your profile; the analysis was refreshed.</p>}
      </div>
    </li>
  );
}

export default function Roadmap() {
  const gate = useAnalysisGate();
  if (gate.view) return <div className="stack"><PageHeader title="Personalized roadmap" />{gate.view}</div>;
  const { app, data, loading } = gate;

  if (data.status === "insufficient_data" || !data.roadmap) {
    return (
      <div className="stack">
        <PageHeader title="Personalized roadmap" />
        <p className="muted">A roadmap is built from your skill gaps, so it needs at least one technical skill on your profile.</p>
        <a className="btn btn-primary fit" href="#/profile">Add skills to my profile</a>
      </div>
    );
  }

  const roadmap = data.roadmap;
  const items = roadmap.phases.flatMap((p) => p.items);
  const doneItems = items.filter((i) => app.progress[i.id]);
  const pct = items.length ? Math.round((doneItems.length / items.length) * 100) : 0;
  const remaining = items.filter((i) => !app.progress[i.id]).reduce((n, i) => n + i.estimatedHours, 0);

  return (
    <div className="stack">
      <PageHeader title="Personalized roadmap" subtitle={`${data.selectedCareer.title}: built from your ${data.missingSkills.length + data.inProgressSkills.length} skill gaps. It changes when your profile or career changes.`}>
        <SampleBadge label={sampleLabel(app.profile)} />
        <CareerSwitch />
      </PageHeader>
      <OfflineNotice />

      <Card>
        <div className="row between wrap">
          <div>
            <strong>{doneItems.length} of {items.length} tasks complete</strong>
            <p className="small muted">About {remaining} hours remaining. Hour figures are rough estimates for planning, not measurements.</p>
          </div>
          <button className="btn btn-quiet" disabled={!doneItems.length}
            onClick={() => { if (window.confirm("Reset all completed tasks for this roadmap?")) app.resetProgress(items.map((i) => i.id)); }}>
            <Icon name="refresh" /> Reset progress
          </button>
        </div>
        <ProgressBar value={pct} label={`Roadmap progress ${pct} percent`} tone="cyan" />
        {!app.storageOk && <p className="small warn-text"><Icon name="alert" size={14} /> Browser storage is unavailable, so completed tasks will not survive a refresh.</p>}
      </Card>

      <ol className="phases">
        {roadmap.phases.map((phase) => {
          const phaseDone = phase.items.filter((i) => app.progress[i.id]).length;
          return (
            <li key={phase.id}>
              <details className="phase" open>
                <summary>
                  <span className="phase-title">{phase.title}</span>
                  <span className="small muted">{phase.items.length ? `${phaseDone}/${phase.items.length} done` : "nothing needed"}</span>
                  <Icon name="down" className="chev" />
                </summary>
                {phase.description && <p className="small muted phase-desc">{phase.description}</p>}
                {phase.items.length ? (
                  <ul className="tasks">
                    {phase.items.map((item) => (
                      <Item key={item.id} item={item} done={!!app.progress[item.id]} busy={loading} onToggle={app.toggleTask}
                        onAddSkill={(it) => {
                          const gap = [...data.missingSkills, ...data.inProgressSkills].find((g) => g.skillId === it.skillId);
                          app.addSkill(gap ? gap.listedAs || gap.name : it.objective, "intermediate");
                        }} />
                    ))}
                  </ul>
                ) : <p className="muted small phase-empty">{phase.emptyMessage}</p>}
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
