import { Card, PageHeader } from "../components.jsx";

export default function About() {
  return (
    <div className="stack prose">
      <PageHeader title="About and impact" subtitle="What problem Nexora addresses, how it works, and what it does not do yet." />

      <Card title="The problem">
        <p>
          A student's evidence of readiness is scattered: skills in a resume, projects on GitHub, certificates in email, internship letters in a drawer.
          Without one view, it is hard to answer simple questions such as &ldquo;What do I already have for a data science role, and what is missing?&rdquo;
          Generic advice does not help because it is not tied to the student's actual profile.
        </p>
      </Card>

      <Card title="How structured profiles help">
        <p>
          A single structured profile records skills with a proficiency level, projects with the technologies used, certifications, experience and achievements.
          Because the data is structured, it can be compared with a specific career's required skills by the same rules every time.
          Capitalization, spelling slips and common aliases (for example &ldquo;JS&rdquo; or &ldquo;Postgres&rdquo;) are normalized so the comparison is fair.
        </p>
      </Card>

      <Card title="How roadmaps turn gaps into actions">
        <p>
          Each missing or beginner-level skill becomes a task with a reason, a suggested activity, an expected deliverable and a rough effort estimate.
          Tasks are grouped into four phases (fundamentals, missing skills, portfolio projects, interview preparation) and ordered so that prerequisites come first.
          Completing a task is saved in the browser, and the roadmap is rebuilt whenever your profile or target career changes.
        </p>
      </Card>

      <Card title="How the score works">
        <p><strong>Career Skill Coverage (%) = matched required skills ÷ total required skills × 100.</strong></p>
        <ul>
          <li>A required skill is matched when you list it at intermediate or advanced level (no level given is treated as intermediate).</li>
          <li>Beginner-level skills are shown as in progress and do not count towards coverage.</li>
          <li>Proficiency depth is shown separately and is never mixed into coverage.</li>
          <li>Soft skills and project evidence are shown for context and are not scored.</li>
          <li>The score does not estimate employability or the chance of getting a job.</li>
        </ul>
      </Card>

      <Card title="Current limitations">
        <ul>
          <li>The career datasets are illustrative examples written for this MVP. They are not official industry standards and have not been validated by employers.</li>
          <li>Skills are self-reported. Nothing verifies that a listed level is accurate.</li>
          <li>Matching is by skill name and a hand-written alias list, so unusual skills may be reported as not recognized. Project text is not parsed; only the technologies you list count as project evidence.</li>
          <li>Profiles and progress are stored in this browser only: no accounts, no sync between devices.</li>
          <li>Effort figures are rough estimates, not measured durations.</li>
          <li>Optional AI recommendations need a server-side API key. Without one, the app uses deterministic rules and says so.</li>
          <li>Only nine careers are included, and each skill list is a short example, not a full job description.</li>
        </ul>
      </Card>

      <Card title="Possible future improvements">
        <ul>
          <li>More careers and a way for educators to edit datasets.</li>
          <li>Accounts and server-side storage so a profile follows the student.</li>
          <li>Importing resumes or GitHub repositories to suggest skills for the student to confirm.</li>
          <li>Linking roadmap tasks to vetted learning resources.</li>
          <li>Validating the datasets and scoring with students, mentors and employers before drawing conclusions.</li>
        </ul>
      </Card>
    </div>
  );
}
