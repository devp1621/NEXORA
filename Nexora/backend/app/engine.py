"""Nexora analysis engine.

Pure Python, no web framework and no network access. Everything the UI shows
about coverage, gaps and the roadmap is computed here from the datasets in
``app/data``.

Scoring methodology (also documented in the README and returned in every
analysis under ``scoring``):

* A *required skill* is one entry in the selected career's ``requirements``.
* A required skill is **matched** when the student lists it (after
  normalization) at ``intermediate`` or ``advanced`` level. A skill listed
  without a level is treated as ``intermediate``.
* A required skill is **in progress** when the student lists it at
  ``beginner`` level.
* Otherwise it is **missing**.
* ``Career Skill Coverage (%) = matched / total required * 100``.
  In-progress skills do not count towards coverage.
* ``Proficiency depth`` is reported separately and never mixed into coverage:
  each listed required skill earns credit (beginner 1/3, intermediate 2/3,
  advanced 1) and the average over all required skills is shown as a percent.
* Neither number predicts employability or the chance of getting a job.
"""

from __future__ import annotations

import difflib
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"

LEVEL_RANK = {"beginner": 1, "intermediate": 2, "advanced": 3}
LEVEL_CREDIT = {1: 1 / 3, 2: 2 / 3, 3: 1.0}
MATCH_MIN_RANK = 2
IMPORTANCE_WEIGHT = {"high": 3, "medium": 2, "low": 1}
TIER_ORDER = {"foundation": 0, "core": 1, "advanced": 2}
FUZZY_MIN_LENGTH = 6
FUZZY_CUTOFF = 0.82

FORMULA_TEXT = "Career Skill Coverage (%) = (required skills matched / total required skills) x 100"
MATCH_RULE_TEXT = (
    "A required skill counts as matched when you list it (after normalizing capitalization, "
    "spelling and common aliases) at intermediate or advanced level. A skill listed without a "
    "level is treated as intermediate. Beginner-level skills are shown as in progress and do not "
    "count towards coverage."
)
DEPTH_TEXT = (
    "Proficiency depth is a separate measure: each listed required skill earns credit "
    "(beginner 1/3, intermediate 2/3, advanced 1) and the average over all required skills is "
    "shown as a percent. It is not mixed into Career Skill Coverage."
)
DISCLAIMER_TEXT = (
    "Career Skill Coverage compares your self-reported skills with an illustrative, editable "
    "skill list. It does not predict hiring outcomes or employability."
)


# --------------------------------------------------------------------------- #
# Normalization
# --------------------------------------------------------------------------- #

def compact(text: str) -> str:
    """Collapse a skill label to a comparison key.

    Lowercases, treats '&' as 'and', and drops spaces, dots, hyphens and slashes so
    that 'Node.js', 'node js' and 'NODEJS' share one key.
    """
    text = unicodedata.normalize("NFKC", str(text)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9+#]", "", text)


class Catalog:
    """Skill catalog plus alias index, built from skills.json and careers.json."""

    def __init__(self, skills_doc: dict, careers_doc: dict):
        self.skills: dict[str, dict] = {s["id"]: s for s in skills_doc["skills"]}
        self.soft_skills: dict[str, dict] = {s["id"]: s for s in skills_doc["softSkills"]}
        self.careers: dict[str, dict] = {c["id"]: c for c in careers_doc["careers"]}
        self.technical_index = self._build_index(self.skills.values())
        self.soft_index = self._build_index(self.soft_skills.values())
        self._validate_careers()

    @staticmethod
    def _build_index(entries) -> dict[str, tuple[str, str]]:
        """Map compact key -> (skill id, 'exact'|'alias'). Fails loudly on collisions."""
        index: dict[str, tuple[str, str]] = {}
        for entry in entries:
            keys = [(compact(entry["name"]), "exact"), (compact(entry["id"]), "alias")]
            keys += [(compact(a), "alias") for a in entry.get("aliases", [])]
            for key, how in keys:
                if not key:
                    continue
                existing = index.get(key)
                if existing and existing[0] != entry["id"]:
                    raise ValueError(
                        f"Alias collision: '{key}' maps to both {existing[0]} and {entry['id']}"
                    )
                if not existing or how == "exact":
                    index[key] = (entry["id"], how)
        return index

    def _validate_careers(self) -> None:
        for career in self.careers.values():
            for req in career["requirements"]:
                if req["skillId"] not in self.skills:
                    raise ValueError(f"{career['id']}: unknown skill {req['skillId']}")
            for soft in career["softSkills"]:
                if soft["skillId"] not in self.soft_skills:
                    raise ValueError(f"{career['id']}: unknown soft skill {soft['skillId']}")
            for project in career["projects"]:
                for sid in project["skillIds"]:
                    if sid not in self.skills:
                        raise ValueError(f"{career['id']}: project uses unknown skill {sid}")

    def resolve(self, label: str, soft: bool = False) -> tuple[str | None, str | None]:
        """Resolve free text to (skill id, how) where how is exact|alias|fuzzy|None."""
        index = self.soft_index if soft else self.technical_index
        key = compact(label)
        if not key:
            return None, None
        hit = index.get(key)
        if hit:
            return hit
        if len(key) >= FUZZY_MIN_LENGTH:
            close = difflib.get_close_matches(key, list(index), n=1, cutoff=FUZZY_CUTOFF)
            if close:
                return index[close[0]][0], "fuzzy"
        return None, None


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    skills_doc = json.loads((DATA_DIR / "skills.json").read_text(encoding="utf-8"))
    careers_doc = json.loads((DATA_DIR / "careers.json").read_text(encoding="utf-8"))
    return Catalog(skills_doc, careers_doc)


# --------------------------------------------------------------------------- #
# Public data for GET /api/careers
# --------------------------------------------------------------------------- #

def careers_payload(catalog: Catalog | None = None) -> dict[str, Any]:
    catalog = catalog or get_catalog()
    careers = []
    for career in catalog.careers.values():
        requirements = []
        for req in sorted(career["requirements"], key=lambda r: r["order"]):
            skill = catalog.skills[req["skillId"]]
            requirements.append({**req, "name": skill["name"], "category": skill["category"]})
        careers.append(
            {
                "id": career["id"],
                "title": career["title"],
                "tagline": career["tagline"],
                "overview": career["overview"],
                "totalRequiredSkills": len(requirements),
                "requirements": requirements,
                "softSkills": [
                    {**s, "name": catalog.soft_skills[s["skillId"]]["name"]}
                    for s in career["softSkills"]
                ],
                "projects": [
                    {**p, "skills": [catalog.skills[sid]["name"] for sid in p["skillIds"]]}
                    for p in career["projects"]
                ],
                "certifications": career["certifications"],
                "roadmapSummary": career["roadmapSummary"],
            }
        )
    return {
        "careers": careers,
        "skillCatalog": [
            {"id": s["id"], "name": s["name"], "category": s["category"], "aliases": s["aliases"]}
            for s in catalog.skills.values()
        ],
        "softSkillCatalog": [
            {"id": s["id"], "name": s["name"], "aliases": s["aliases"]}
            for s in catalog.soft_skills.values()
        ],
        "disclaimer": (
            "Career datasets are illustrative, editable examples created for this MVP. "
            "They are not official industry standards."
        ),
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _priority(importance: str, status: str) -> str:
    score = IMPORTANCE_WEIGHT.get(importance, 1) + (1 if status == "missing" else 0)
    if score >= 4:
        return "High"
    if score == 3:
        return "Medium"
    return "Low"


_PRIORITY_RANK = {"High": 0, "Medium": 1, "Low": 2}


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _list_phrase(items: list[str], limit: int = 4) -> str:
    items = [i for i in items if i]
    if len(items) <= limit:
        return ", ".join(items)
    return ", ".join(items[:limit]) + f" and {len(items) - limit} more"


def _normalize_profile_skills(catalog: Catalog, raw_skills: list[dict]):
    """Return (best level per skill id, normalization records, unrecognized names)."""
    best: dict[str, dict] = {}
    records: list[dict] = []
    unrecognized: list[str] = []
    for raw in raw_skills:
        label = _clean(raw.get("name"))
        if not label:
            continue
        level = str(raw.get("level") or "intermediate").lower()
        rank = LEVEL_RANK.get(level, 2)
        skill_id, how = catalog.resolve(label)
        if skill_id is None:
            unrecognized.append(label)
            records.append({"input": label, "skillId": None, "name": None, "level": level, "how": None})
            continue
        records.append(
            {"input": label, "skillId": skill_id, "name": catalog.skills[skill_id]["name"],
             "level": level, "how": how}
        )
        current = best.get(skill_id)
        if current is None or rank > current["rank"]:
            best[skill_id] = {"rank": rank, "level": level, "input": label}
    return best, records, unrecognized


# --------------------------------------------------------------------------- #
# Main analysis
# --------------------------------------------------------------------------- #

class UnknownCareer(KeyError):
    pass


def analyze(profile: dict, career_id: str, catalog: Catalog | None = None) -> dict[str, Any]:
    """Analyze a profile (already validated dict) against a career id."""
    catalog = catalog or get_catalog()
    career = catalog.careers.get(career_id)
    if career is None:
        raise UnknownCareer(career_id)

    requirements = sorted(career["requirements"], key=lambda r: r["order"])
    total = len(requirements)
    selected = {
        "id": career["id"],
        "title": career["title"],
        "tagline": career["tagline"],
        "overview": career["overview"],
        "totalRequiredSkills": total,
    }

    raw_skills = profile.get("technicalSkills") or []
    best, norm_records, unrecognized = _normalize_profile_skills(catalog, raw_skills)
    notes: list[dict] = []

    scoring = {
        "label": "Career Skill Coverage",
        "formula": FORMULA_TEXT,
        "matchRule": MATCH_RULE_TEXT,
        "depthDescription": DEPTH_TEXT,
        "disclaimer": DISCLAIMER_TEXT,
    }

    # Insufficient data: nothing listed at all, so any number would be misleading.
    missing_fields = []
    if not any(_clean(s.get("name")) for s in raw_skills):
        missing_fields.append("technicalSkills")
    if missing_fields:
        return {
            "status": "insufficient_data",
            "selectedCareer": selected,
            "careerSkillCoverage": None,
            "proficiencyDepth": None,
            "scoring": scoring,
            "matchedSkills": [],
            "inProgressSkills": [],
            "missingSkills": [],
            "categoryBreakdown": [],
            "softSkills": {"matched": [], "missing": []},
            "profileSummary": _profile_summary(catalog, profile, career, best),
            "strengths": [],
            "priorityGaps": [],
            "roadmap": None,
            "recommendations": {"source": "rule-based", "generatedBy": "Deterministic rules (not AI)", "items": []},
            "normalizedSkills": norm_records,
            "unrecognizedSkills": unrecognized,
            "missingProfileData": missing_fields,
            "analysisNotes": [
                {
                    "level": "warning",
                    "message": (
                        "Add at least one technical skill to your profile. Without it there is "
                        "nothing to compare against the "
                        f"{career['title']} requirements, so no coverage score is shown."
                    ),
                }
            ],
        }

    # Evidence from projects: technologies used in each project, resolved to skill ids.
    project_tech: list[dict] = []
    for project in profile.get("projects") or []:
        resolved = []
        for tech in project.get("technologies") or []:
            sid, _ = catalog.resolve(_clean(tech))
            if sid and sid not in resolved:
                resolved.append(sid)
        project_tech.append({"title": _clean(project.get("title")), "skillIds": resolved})

    statuses: list[dict] = []
    for req in requirements:
        skill = catalog.skills[req["skillId"]]
        entry = best.get(req["skillId"])
        if entry is None:
            status, level = "missing", None
        elif entry["rank"] >= MATCH_MIN_RANK:
            status, level = "matched", entry["level"]
        else:
            status, level = "in_progress", entry["level"]
        statuses.append(
            {
                "skillId": req["skillId"],
                "name": skill["name"],
                "category": skill["category"],
                "importance": req["importance"],
                "tier": req["tier"],
                "status": status,
                "userLevel": level,
                "listedAs": entry["input"] if entry else None,
                "usedInProjects": [p["title"] for p in project_tech if req["skillId"] in p["skillIds"]],
                "_req": req,
            }
        )

    matched = [s for s in statuses if s["status"] == "matched"]
    in_progress = [s for s in statuses if s["status"] == "in_progress"]
    missing = [s for s in statuses if s["status"] == "missing"]

    coverage_pct = round(len(matched) / total * 100, 1)
    depth_pct = round(
        sum(LEVEL_CREDIT[best[s["skillId"]]["rank"]] for s in statuses if s["skillId"] in best)
        / total * 100,
        1,
    )

    # Gap details, ordered for learning: tier first, then dataset order.
    gaps = [s for s in statuses if s["status"] != "matched"]
    gaps.sort(key=lambda s: (TIER_ORDER[s["tier"]], s["_req"]["order"]))
    gap_details: dict[str, dict] = {}
    for position, s in enumerate(gaps, start=1):
        req = s["_req"]
        gap_details[s["skillId"]] = {
            "skillId": s["skillId"],
            "name": s["name"],
            "category": s["category"],
            "status": s["status"],
            "userLevel": s["userLevel"],
            "importance": s["importance"],
            "tier": s["tier"],
            "priority": _priority(s["importance"], s["status"]),
            "why": req["why"],
            "learningTopic": req["learningTopic"],
            "exercise": req["exercise"],
            "estimatedHours": req["effortHours"],
            "suggestedOrder": position,
            "usedInProjects": s["usedInProjects"],
        }

    def public(s: dict) -> dict:
        base = {k: v for k, v in s.items() if k != "_req"}
        return {**base, **gap_details.get(s["skillId"], {})} if s["skillId"] in gap_details else base

    matched_out = [public(s) for s in matched]
    in_progress_out = sorted((public(s) for s in in_progress), key=lambda g: g["suggestedOrder"])
    missing_out = sorted((public(s) for s in missing), key=lambda g: g["suggestedOrder"])

    # Notes
    for record in norm_records:
        if record["how"] == "fuzzy":
            notes.append({"level": "info",
                          "message": f"'{record['input']}' was read as {record['name']} (spelling correction). Check that this is what you meant."})
    if unrecognized:
        notes.append({"level": "info",
                      "message": f"Not in the skill catalog, so not counted: {_list_phrase(unrecognized, 6)}."})
    for s in statuses:
        if s["status"] != "matched" and s["usedInProjects"]:
            where = _list_phrase(s["usedInProjects"], 2)
            action = "is not in your skills list" if s["status"] == "missing" else "is listed at beginner level"
            notes.append({"level": "info",
                          "message": f"{s['name']} appears in your project(s) {where} but {action}. Update your skills if you are comfortable with it."})
    if not (profile.get("projects") or []):
        notes.append({"level": "info", "message": "No projects added yet. Projects with technologies make your evidence easier to review."})
    if coverage_pct == 100:
        notes.append({"level": "success", "message": "All required skills in this example dataset are matched. The roadmap now focuses on projects and interview preparation."})
    notes.append({"level": "info", "message": DISCLAIMER_TEXT})

    # Category breakdown for the chart.
    breakdown: dict[str, dict] = {}
    for s in statuses:
        row = breakdown.setdefault(s["category"], {"category": s["category"], "matched": 0, "inProgress": 0, "missing": 0, "total": 0})
        row["total"] += 1
        row[{"matched": "matched", "in_progress": "inProgress", "missing": "missing"}[s["status"]]] += 1

    # Soft skills (informational, not scored).
    listed_soft = set()
    for label in profile.get("softSkills") or []:
        sid, _ = catalog.resolve(_clean(label), soft=True)
        if sid:
            listed_soft.add(sid)
    soft_matched, soft_missing = [], []
    for soft in career["softSkills"]:
        item = {"skillId": soft["skillId"], "name": catalog.soft_skills[soft["skillId"]]["name"], "why": soft["why"]}
        (soft_matched if soft["skillId"] in listed_soft else soft_missing).append(item)

    summary = _profile_summary(catalog, profile, career, best, project_tech)
    strengths = _strengths(matched_out, summary, soft_matched, total)

    priority_gaps = sorted(
        gap_details.values(), key=lambda g: (_PRIORITY_RANK[g["priority"]], g["suggestedOrder"])
    )[:5]
    priority_gaps_out = [
        {"skillId": g["skillId"], "name": g["name"], "priority": g["priority"], "status": g["status"],
         "suggestedOrder": g["suggestedOrder"], "why": g["why"]}
        for g in priority_gaps
    ]

    roadmap = _build_roadmap(catalog, career, gaps_in_order=[gap_details[s["skillId"]] for s in gaps], summary=summary, profile=profile)
    recommendations = _rule_recommendations(priority_gaps, gap_details, summary)

    return {
        "status": "ok",
        "selectedCareer": selected,
        "careerSkillCoverage": {
            "label": "Career Skill Coverage",
            "percent": coverage_pct,
            "matched": len(matched),
            "inProgress": len(in_progress),
            "missing": len(missing),
            "total": total,
        },
        "proficiencyDepth": {"label": "Proficiency depth (separate measure)", "percent": depth_pct},
        "scoring": scoring,
        "matchedSkills": matched_out,
        "inProgressSkills": in_progress_out,
        "missingSkills": missing_out,
        "categoryBreakdown": list(breakdown.values()),
        "softSkills": {"matched": soft_matched, "missing": soft_missing},
        "profileSummary": summary,
        "strengths": strengths,
        "priorityGaps": priority_gaps_out,
        "roadmap": roadmap,
        "recommendations": recommendations,
        "normalizedSkills": norm_records,
        "unrecognizedSkills": unrecognized,
        "missingProfileData": [],
        "analysisNotes": notes,
    }


# --------------------------------------------------------------------------- #
# Profile summary, strengths
# --------------------------------------------------------------------------- #

def _profile_summary(catalog, profile, career, best, project_tech=None) -> dict:
    required_ids = {r["skillId"] for r in career["requirements"]}
    projects = profile.get("projects") or []
    if project_tech is None:
        project_tech = []
        for project in projects:
            ids = []
            for tech in project.get("technologies") or []:
                sid, _ = catalog.resolve(_clean(tech))
                if sid and sid not in ids:
                    ids.append(sid)
            project_tech.append({"title": _clean(project.get("title")), "skillIds": ids})
    relevant = [
        {"title": p["title"], "skills": [catalog.skills[s]["name"] for s in p["skillIds"] if s in required_ids]}
        for p in project_tech if any(s in required_ids for s in p["skillIds"])
    ]
    experience = [
        {"role": _clean(e.get("role")), "organization": _clean(e.get("organization")), "description": _clean(e.get("description"))}
        for e in (profile.get("experience") or [])
    ]
    certs = [_clean(c.get("name")) for c in (profile.get("certifications") or []) if _clean(c.get("name"))]
    achievements = [_clean(a) for a in (profile.get("achievements") or []) if _clean(a)]
    return {
        "projectCount": len(projects),
        "careerRelevantProjects": relevant,
        "careerRelevantProjectCount": len(relevant),
        "projectTitles": [p["title"] for p in project_tech],
        "certificationCount": len(certs),
        "certifications": certs,
        "experienceCount": len(experience),
        "experience": experience,
        "achievementCount": len(achievements),
        "achievements": achievements,
    }


def _strengths(matched: list[dict], summary: dict, soft_matched: list[dict], total: int) -> list[dict]:
    out: list[dict] = []
    advanced = [m["name"] for m in matched if m["userLevel"] == "advanced"]
    if advanced:
        out.append({"title": "Advanced-level skills", "detail": f"You rate yourself advanced in {_list_phrase(advanced)}."})
    if matched:
        pct = round(len(matched) / total * 100)
        if pct >= 50:
            out.append({"title": "Solid coverage of the requirements",
                        "detail": f"{len(matched)} of {total} required skills are matched ({pct}%)."})
        else:
            out.append({"title": "A starting base to build on",
                        "detail": f"You already match {_list_phrase([m['name'] for m in matched])}."})
    if summary["careerRelevantProjectCount"]:
        titles = _list_phrase([p["title"] for p in summary["careerRelevantProjects"]], 3)
        out.append({"title": "Project evidence",
                    "detail": f"{summary['careerRelevantProjectCount']} project(s) use skills this career requires: {titles}."})
    if summary["experienceCount"]:
        first = summary["experience"][0]
        label = first["role"] or "practical experience"
        org = f" at {first['organization']}" if first["organization"] else ""
        out.append({"title": "Practical experience", "detail": f"{label}{org}."})
    if summary["certificationCount"]:
        out.append({"title": "Certifications", "detail": _list_phrase(summary["certifications"], 3) + "."})
    if soft_matched:
        out.append({"title": "Relevant soft skills", "detail": _list_phrase([s["name"] for s in soft_matched]) + "."})
    if summary["achievementCount"]:
        out.append({"title": "Recorded achievements", "detail": f"{summary['achievementCount']} achievement(s) on your profile."})
    return out[:6]


# --------------------------------------------------------------------------- #
# Recommendations (deterministic)
# --------------------------------------------------------------------------- #

def _rule_recommendations(priority_gaps: list[dict], gap_details: dict, summary: dict) -> dict:
    items: list[dict] = []
    for g in priority_gaps[:5]:
        if g["status"] == "in_progress":
            lead = f"You list {g['name']} at beginner level; the next step is to reach intermediate."
        else:
            lead = f"{g['name']} is not on your profile yet."
        items.append(
            {
                "id": f"rec-{g['skillId']}",
                "skillId": g["skillId"],
                "title": f"{'Strengthen' if g['status'] == 'in_progress' else 'Learn'} {g['name']}",
                "why": f"{lead} {g['why']}",
                "nextStep": f"{g['exercise']} Study: {g['learningTopic']}.",
                "estimatedHours": g["estimatedHours"],
                "priority": g["priority"],
            }
        )
    if summary["projectCount"] == 0:
        items.append({"id": "rec-profile-projects", "skillId": None, "title": "Add your first project",
                      "why": "Your profile has no projects, so there is no evidence of applied skills.",
                      "nextStep": "Add one project with the technologies you used and a two-line description.",
                      "estimatedHours": None, "priority": "Medium"})
    if summary["experienceCount"] == 0:
        items.append({"id": "rec-profile-experience", "skillId": None, "title": "Look for practical experience",
                      "why": "No internship or practical experience is listed.",
                      "nextStep": "Apply to internships, join an open-source project or a campus technical team, and record it here.",
                      "estimatedHours": None, "priority": "Medium"})
    return {"source": "rule-based", "generatedBy": "Deterministic rules (not AI)", "items": items}


# --------------------------------------------------------------------------- #
# Roadmap
# --------------------------------------------------------------------------- #

def _skill_item(career_id: str, g: dict, phase: str, order: int) -> dict:
    improving = g["status"] == "in_progress"
    return {
        "id": f"{career_id}:skill:{g['skillId']}",
        "phase": phase,
        "skillId": g["skillId"],
        "objective": f"{'Move' if improving else 'Learn'} {g['name']} {'from beginner to intermediate' if improving else 'to a working level'}",
        "reason": (f"You list {g['name']} at beginner level. " if improving else f"{g['name']} is not on your profile. ") + g["why"],
        "activity": f"Study: {g['learningTopic']}. Then do: {g['exercise']}",
        "deliverable": f"A finished exercise on GitHub (or a notes document) showing {g['name']} in use.",
        "estimatedHours": g["estimatedHours"],
        "priority": g["priority"],
        "order": order,
    }


def _build_roadmap(catalog: Catalog, career: dict, gaps_in_order: list[dict], summary: dict, profile: dict) -> dict:
    cid = career["id"]
    gap_ids = {g["skillId"] for g in gaps_in_order}
    summary_by_phase = {r["phase"]: r["summary"] for r in career["roadmapSummary"]}

    p1 = [g for g in gaps_in_order if g["tier"] == "foundation"]
    p2 = [g for g in gaps_in_order if g["tier"] != "foundation"]

    order = 0
    phase1_items = []
    for g in p1:
        order += 1
        phase1_items.append(_skill_item(cid, g, "phase-1", order))
    phase2_items = []
    for g in p2:
        order += 1
        phase2_items.append(_skill_item(cid, g, "phase-2", order))

    # Phase 3: projects chosen by how many current gaps they cover.
    def project_score(p):
        return len(gap_ids.intersection(p["skillIds"]))

    ranked = sorted(career["projects"], key=lambda p: (-project_score(p), career["projects"].index(p)))
    phase3_items = []
    for p in ranked[:2]:
        order += 1
        covered = [catalog.skills[s]["name"] for s in p["skillIds"] if s in gap_ids]
        if covered:
            reason = f"Covers {len(covered)} of your current gaps ({_list_phrase(covered)}), so you practise them in a realistic setting."
        else:
            reason = "Applies skills you already match in a larger project, which gives you portfolio evidence."
        phase3_items.append({
            "id": f"{cid}:project:{p['id']}",
            "phase": "phase-3",
            "skillId": None,
            "objective": f"Build: {p['title']}",
            "reason": reason,
            "activity": p["description"],
            "deliverable": p["deliverable"],
            "estimatedHours": p["effortHours"],
            "priority": "High" if covered else "Medium",
            "order": order,
        })

    # Phase 4: preparation, adapted to what the profile already has.
    phase4_items = []
    order += 1
    phase4_items.append({
        "id": f"{cid}:prep:resume", "phase": "phase-4", "skillId": None,
        "objective": "Prepare a resume and GitHub profile for this career",
        "reason": f"Your profile lists {summary['projectCount']} project(s) and {summary['certificationCount']} certification(s); a resume should present them for a {career['title']} role.",
        "activity": "Write a one-page resume that links to your best projects, and pin them on your GitHub profile with clear READMEs.",
        "deliverable": "One-page resume (PDF) and a tidy GitHub profile.",
        "estimatedHours": 6, "priority": "Medium", "order": order,
    })
    order += 1
    if summary["experienceCount"] == 0:
        phase4_items.append({
            "id": f"{cid}:prep:experience", "phase": "phase-4", "skillId": None,
            "objective": "Gain practical experience",
            "reason": "No internship or practical experience is listed on your profile.",
            "activity": "Apply to internships, or contribute to an open-source project or campus technical team, and record what you did.",
            "deliverable": "At least five applications sent, or one accepted contribution or team role.",
            "estimatedHours": 20, "priority": "Medium", "order": order,
        })
    else:
        exp = summary["experience"][0]
        label = exp["role"] or "your experience"
        phase4_items.append({
            "id": f"{cid}:prep:experience", "phase": "phase-4", "skillId": None,
            "objective": f"Prepare to discuss {label}",
            "reason": "Interviewers will ask about practical work you have listed.",
            "activity": "Write a short account of what you built, the problems you hit and what you would change.",
            "deliverable": "Three short talking points per experience, using the situation-action-result structure.",
            "estimatedHours": 4, "priority": "Medium", "order": order,
        })
    order += 1
    phase4_items.append({
        "id": f"{cid}:prep:interview", "phase": "phase-4", "skillId": None,
        "objective": f"Practise {career['title']} interview questions",
        "reason": "Explaining your skills aloud is a separate skill from having them.",
        "activity": "Run two mock interviews with a peer. Cover the skills you match and describe how you are closing your gaps.",
        "deliverable": "A list of questions you struggled with and the improved answers.",
        "estimatedHours": 8, "priority": "Medium", "order": order,
    })
    cert = career["certifications"][0]
    order += 1
    phase4_items.append({
        "id": f"{cid}:prep:cert", "phase": "phase-4", "skillId": None,
        "objective": f"Consider: {cert['name']}",
        "reason": f"A suggested {cert['type']} for this path. Optional; check the provider's current details before committing.",
        "activity": "Review the syllabus and compare it with your gap list before deciding whether it is worth your time.",
        "deliverable": "A short decision note, and a study plan if you go ahead.",
        "estimatedHours": 30, "priority": "Low", "order": order,
    })

    phases = [
        {"id": "phase-1", "title": "Phase 1: Strengthen fundamentals",
         "description": summary_by_phase.get("Fundamentals", ""), "items": phase1_items,
         "emptyMessage": "No foundation gaps. Your fundamentals match this career's list."},
        {"id": "phase-2", "title": "Phase 2: Learn missing technical skills",
         "description": summary_by_phase.get("Core stack") or summary_by_phase.get("Core toolkit") or summary_by_phase.get("Core skills", ""),
         "items": phase2_items, "emptyMessage": "No core or advanced skill gaps remain."},
        {"id": "phase-3", "title": "Phase 3: Build portfolio projects",
         "description": summary_by_phase.get("Portfolio", ""), "items": phase3_items, "emptyMessage": ""},
        {"id": "phase-4", "title": "Phase 4: Prepare for internships and interviews",
         "description": summary_by_phase.get("Job readiness", ""), "items": phase4_items, "emptyMessage": ""},
    ]
    all_items = [i for p in phases for i in p["items"]]
    return {
        "careerId": cid,
        "phases": phases,
        "totalItems": len(all_items),
        "totalEstimatedHours": sum(i["estimatedHours"] for i in all_items),
        "estimateNote": "Hour figures are rough estimates for planning, not measured durations.",
    }
