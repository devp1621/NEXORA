import { useEffect, useMemo, useRef, useState } from "react";
import { toApiProfile } from "../api.js";
import { Banner, Card, ChipInput, PageHeader, SampleBadge } from "../components.jsx";
import { DEMOS, blankProfile } from "../demo.js";
import { Icon } from "../icons.jsx";
import { go, sampleLabel, useApp } from "../store.jsx";

const DEGREES = ["B.Tech", "B.E.", "B.Sc", "BCA", "B.Com", "M.Tech", "M.Sc", "MCA", "MBA", "Diploma"];
const BRANCHES = [
  "Computer Science and Engineering", "Information Technology", "Electronics and Communication Engineering",
  "Electrical Engineering", "Mechanical Engineering", "Civil Engineering", "Data Science", "Artificial Intelligence and Machine Learning",
  "Mathematics", "Statistics", "Physics",
];
const TERMS = [...Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`), "1st year", "2nd year", "3rd year", "4th year", "Final year", "Postgraduate"];

const isBlank = (o, keys) => keys.every((k) => !(o[k] && String(o[k]).trim()));

function validate(draft, career) {
  const e = {};
  const req = (key, label, max = 80) => {
    const v = (draft[key] || "").trim();
    if (!v) e[key] = `${label} is required.`;
    else if (v.length > max) e[key] = `${label} must be ${max} characters or fewer.`;
  };
  req("name", "Student name");
  req("degree", "Degree");
  req("branch", "Branch");
  req("year", "Current semester or year", 40);
  if (!career) e.career = "Choose a target career.";
  if (!draft.technicalSkills.length) e.skills = "Add at least one technical skill so there is something to compare with the career.";
  draft.projects.forEach((p, i) => {
    if (!isBlank(p, ["title", "description"]) || p.technologies.length) {
      if (!p.title.trim()) e[`projects.${i}.title`] = "Give this project a title, or remove it.";
      else if (p.title.length > 100) e[`projects.${i}.title`] = "Title must be 100 characters or fewer.";
      if ((p.description || "").length > 1000) e[`projects.${i}.description`] = "Description must be 1000 characters or fewer.";
    }
  });
  draft.certifications.forEach((c, i) => {
    if (!isBlank(c, ["name", "issuer"]) && !c.name.trim()) e[`certifications.${i}.name`] = "Enter the certification name, or remove it.";
  });
  draft.experience.forEach((x, i) => {
    if (!isBlank(x, ["role", "organization", "description"]) && !x.role.trim()) e[`experience.${i}.role`] = "Enter your role, or remove this entry.";
  });
  return e;
}

function cleanDraft(draft) {
  return {
    ...draft,
    name: draft.name.trim(), degree: draft.degree.trim(), branch: draft.branch.trim(), year: draft.year.trim(),
    projects: draft.projects.filter((p) => !isBlank(p, ["title", "description"]) || p.technologies.length),
    certifications: draft.certifications.filter((c) => !isBlank(c, ["name", "issuer"])),
    experience: draft.experience.filter((x) => !isBlank(x, ["role", "organization", "description"])),
    achievements: draft.achievements.map((a) => a.trim()).filter(Boolean),
  };
}

function Field({ label, id, error, hint, children, required }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {children}
      {error && <p className="field-error" id={`${id}-err`}><Icon name="alert" size={14} /> {error}</p>}
    </div>
  );
}

function aria(id, error, hint) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined,
  };
}

export default function Profile() {
  const app = useApp();
  const { profile, careerId, careers } = app;
  const [draft, setDraft] = useState(() => (profile ? structuredClone(profile) : blankProfile()));
  const [career, setCareer] = useState(careerId || "");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef(null);

  // Re-sync when the saved profile changes from elsewhere (e.g. the sidebar demo button).
  useEffect(() => {
    setDraft(profile ? structuredClone(profile) : blankProfile());
    setCareer(careerId || "");
    setErrors({});
    setServerError(null);
  }, [profile, careerId]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const catalog = careers.data;
  const skillSuggestions = catalog ? catalog.skillCatalog : [];
  const softSuggestions = catalog ? catalog.softSkillCatalog : [];

  const dirty = useMemo(() => {
    const saved = profile ? JSON.stringify([toApiProfile(profile), careerId]) : JSON.stringify([toApiProfile(blankProfile()), null]);
    return JSON.stringify([toApiProfile(draft), career || null]) !== saved;
  }, [draft, career, profile, careerId]);

  const fillSample = (key) => {
    const demo = DEMOS[key];
    setDraft({ ...structuredClone(demo.profile), sample: key });
    setCareer(demo.careerId);
    setErrors({});
    setServerError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError(null);
    const found = validate(draft, career);
    setErrors(found);
    if (Object.keys(found).length) {
      setTimeout(() => summaryRef.current && summaryRef.current.focus(), 0);
      return;
    }
    setBusy(true);
    const result = await app.saveProfile(cleanDraft(draft), career);
    setBusy(false);
    if (result.ok) go("/dashboard");
    else if (!result.stale) {
      setServerError(result.error);
      setTimeout(() => summaryRef.current && summaryRef.current.focus(), 0);
    }
  };

  const errorList = Object.entries(errors);
  const label = sampleLabel(draft.sample ? draft : null);

  return (
    <form onSubmit={submit} noValidate className="stack">
      <PageHeader
        title="Student profile"
        subtitle="Everything you enter is saved in this browser. Analysis runs on the backend each time you save."
      >
        {dirty && <span className="badge badge-amber">Unsaved changes</span>}
        <SampleBadge label={draft.sample ? (label || "Sample data (edited)") : null} />
      </PageHeader>

      {(errorList.length > 0 || serverError) && (
        <div ref={summaryRef} tabIndex={-1} className="error-summary" role="alert">
          {errorList.length > 0 && (
            <>
              <strong>Please fix {errorList.length} {errorList.length === 1 ? "problem" : "problems"} before analyzing:</strong>
              <ul>{errorList.map(([k, m]) => <li key={k}>{m}</li>)}</ul>
            </>
          )}
          {serverError && (
            <>
              <strong>{serverError.message}</strong>
              {serverError.details && serverError.details.length > 0 && (
                <ul>{serverError.details.map((d, i) => <li key={i}>{d.field}: {d.message}</li>)}</ul>
              )}
            </>
          )}
        </div>
      )}

      <Card title="Try sample data" subtitle="Fill the form with a fictional student, then edit anything and analyze again.">
        <div className="row wrap">
          {Object.values(DEMOS).map((d) => (
            <button type="button" className="btn btn-ghost" key={d.key} onClick={() => fillSample(d.key)}>
              <Icon name="user" /> {d.label}
            </button>
          ))}
          {profile && (
            <button type="button" className="btn btn-ghost" onClick={() => { app.clearProfile(); setDraft(blankProfile()); setCareer(""); }}>
              <Icon name="trash" /> Clear saved profile
            </button>
          )}
        </div>
      </Card>

      <Card title="Education">
        <div className="grid-3">
          <Field label="Student name" id="f-name" error={errors.name} required>
            <input className="input" {...aria("f-name", errors.name)} value={draft.name} maxLength={80} autoComplete="name"
              onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Degree" id="f-degree" error={errors.degree} required>
            <input className="input" list="degrees" {...aria("f-degree", errors.degree)} value={draft.degree} maxLength={80}
              onChange={(e) => set({ degree: e.target.value })} />
            <datalist id="degrees">{DEGREES.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field label="Branch" id="f-branch" error={errors.branch} required>
            <input className="input" list="branches" {...aria("f-branch", errors.branch)} value={draft.branch} maxLength={80}
              onChange={(e) => set({ branch: e.target.value })} />
            <datalist id="branches">{BRANCHES.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field label="Current semester or year" id="f-year" error={errors.year} required>
            <input className="input" list="terms" {...aria("f-year", errors.year)} value={draft.year} maxLength={40}
              onChange={(e) => set({ year: e.target.value })} />
            <datalist id="terms">{TERMS.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
        </div>
      </Card>

      <Card title="Target career" subtitle="Pick the path to compare against. You can change it later without losing your profile.">
        <div className={`choice-grid ${errors.career ? "has-error" : ""}`} role="radiogroup" aria-label="Target career">
          {catalog ? catalog.careers.map((c) => (
            <label key={c.id} className={`choice ${career === c.id ? "selected" : ""}`}>
              <input type="radio" name="career" value={c.id} checked={career === c.id} onChange={() => setCareer(c.id)} />
              <span className="choice-title">{c.title}</span>
              <span className="choice-sub">{c.tagline}</span>
            </label>
          )) : <p className="muted">Career list unavailable. Start the backend and reload.</p>}
        </div>
        {errors.career && <p className="field-error"><Icon name="alert" size={14} /> {errors.career}</p>}
      </Card>

      <Card title="Skills">
        <div className="stack">
          <ChipInput
            label="Technical skills" inputId="f-skills" items={draft.technicalSkills} suggestions={skillSuggestions} withLevel
            placeholder="Type to search, e.g. Python, React, SQL, or use an alias like JS"
            hint="Pick a proficiency for each. Only Intermediate and Advanced count as matched; Beginner shows as in progress. Unlisted spellings and aliases are normalized by the server."
            onChange={(items) => set({ technicalSkills: items })} error={errors.skills} errorId="f-skills-err"
          />
          {errors.skills && <p className="field-error" id="f-skills-err"><Icon name="alert" size={14} /> {errors.skills}</p>}
          <ChipInput
            label="Soft skills" inputId="f-soft" items={draft.softSkills.map((s) => ({ name: s }))} suggestions={softSuggestions}
            placeholder="e.g. Communication, Teamwork"
            hint="Shown for context only. Soft skills are not part of the coverage score."
            onChange={(items) => set({ softSkills: items.map((i) => i.name) })}
          />
        </div>
      </Card>

      <Card
        title="Projects"
        subtitle="List the technologies each project used. They count as supporting evidence and are never silently added to your skills."
        action={<button type="button" className="btn btn-ghost" onClick={() => set({ projects: [...draft.projects, { title: "", description: "", technologies: [] }] })}><Icon name="plus" /> Add project</button>}
      >
        {draft.projects.length === 0 && <p className="muted">No projects yet.</p>}
        <div className="stack">
          {draft.projects.map((p, i) => {
            const upd = (patch) => set({ projects: draft.projects.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <fieldset className="repeat" key={i}>
                <legend>Project {i + 1}</legend>
                <Field label="Title" id={`p-title-${i}`} error={errors[`projects.${i}.title`]}>
                  <input className="input" {...aria(`p-title-${i}`, errors[`projects.${i}.title`])} value={p.title} maxLength={100} onChange={(e) => upd({ title: e.target.value })} />
                </Field>
                <Field label="Description" id={`p-desc-${i}`} error={errors[`projects.${i}.description`]}>
                  <textarea className="input" rows={2} {...aria(`p-desc-${i}`, errors[`projects.${i}.description`])} value={p.description} maxLength={1000} onChange={(e) => upd({ description: e.target.value })} />
                </Field>
                <ChipInput label="Technologies used" inputId={`p-tech-${i}`} items={p.technologies.map((t) => ({ name: t }))} suggestions={skillSuggestions}
                  placeholder="e.g. React, Node, MySQL" onChange={(items) => upd({ technologies: items.map((t) => t.name) })} />
                <button type="button" className="btn btn-quiet" onClick={() => set({ projects: draft.projects.filter((_, j) => j !== i) })}><Icon name="trash" /> Remove project {i + 1}</button>
              </fieldset>
            );
          })}
        </div>
      </Card>

      <Card
        title="Certifications"
        action={<button type="button" className="btn btn-ghost" onClick={() => set({ certifications: [...draft.certifications, { name: "", issuer: "" }] })}><Icon name="plus" /> Add certification</button>}
      >
        {draft.certifications.length === 0 && <p className="muted">No certifications yet.</p>}
        <div className="stack">
          {draft.certifications.map((c, i) => {
            const upd = (patch) => set({ certifications: draft.certifications.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div className="repeat-row" key={i}>
                <Field label="Certification" id={`c-name-${i}`} error={errors[`certifications.${i}.name`]}>
                  <input className="input" {...aria(`c-name-${i}`, errors[`certifications.${i}.name`])} value={c.name} maxLength={120} onChange={(e) => upd({ name: e.target.value })} />
                </Field>
                <Field label="Issuer" id={`c-issuer-${i}`}>
                  <input className="input" id={`c-issuer-${i}`} value={c.issuer} maxLength={120} onChange={(e) => upd({ issuer: e.target.value })} />
                </Field>
                <button type="button" className="btn btn-quiet" onClick={() => set({ certifications: draft.certifications.filter((_, j) => j !== i) })} aria-label={`Remove certification ${i + 1}`}><Icon name="trash" /></button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Internship or practical experience"
        action={<button type="button" className="btn btn-ghost" onClick={() => set({ experience: [...draft.experience, { role: "", organization: "", description: "" }] })}><Icon name="plus" /> Add experience</button>}
      >
        {draft.experience.length === 0 && <p className="muted">No experience listed. The roadmap will include a step for gaining some.</p>}
        <div className="stack">
          {draft.experience.map((x, i) => {
            const upd = (patch) => set({ experience: draft.experience.map((y, j) => (j === i ? { ...y, ...patch } : y)) });
            return (
              <fieldset className="repeat" key={i}>
                <legend>Experience {i + 1}</legend>
                <div className="grid-2">
                  <Field label="Role" id={`x-role-${i}`} error={errors[`experience.${i}.role`]}>
                    <input className="input" {...aria(`x-role-${i}`, errors[`experience.${i}.role`])} value={x.role} maxLength={100} onChange={(e) => upd({ role: e.target.value })} />
                  </Field>
                  <Field label="Organization" id={`x-org-${i}`}>
                    <input className="input" id={`x-org-${i}`} value={x.organization} maxLength={120} onChange={(e) => upd({ organization: e.target.value })} />
                  </Field>
                </div>
                <Field label="What did you do?" id={`x-desc-${i}`}>
                  <textarea className="input" rows={2} id={`x-desc-${i}`} value={x.description} maxLength={1000} onChange={(e) => upd({ description: e.target.value })} />
                </Field>
                <button type="button" className="btn btn-quiet" onClick={() => set({ experience: draft.experience.filter((_, j) => j !== i) })}><Icon name="trash" /> Remove experience {i + 1}</button>
              </fieldset>
            );
          })}
        </div>
      </Card>

      <Card title="Achievements">
        <Field label="One achievement per line" id="f-ach" hint="Competitions, awards, leadership roles, published work.">
          <textarea className="input" rows={3} id="f-ach" aria-describedby="f-ach-hint" value={draft.achievements.join("\n")}
            onChange={(e) => set({ achievements: e.target.value.split("\n") })} />
        </Field>
      </Card>

      <div className="sticky-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Analyzing…" : <>Save and analyze <Icon name="arrow" /></>}
        </button>
        <span className="muted small">Analysis uses only the skills you list here. Nothing is guessed.</span>
      </div>
    </form>
  );
}
