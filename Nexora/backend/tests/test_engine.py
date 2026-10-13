"""Engine and AI-fallback tests. Run: python -m unittest discover -s tests -v"""

import json
import os
import socket
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import ai  # noqa: E402
from app.engine import analyze, careers_payload, compact, get_catalog  # noqa: E402

CATALOG = get_catalog()


def skills_for(career_id, count=None, level="intermediate"):
    """Use the career's own required skill names (first `count` by dataset order)."""
    reqs = sorted(CATALOG.careers[career_id]["requirements"], key=lambda r: r["order"])
    reqs = reqs[:count] if count is not None else reqs
    return [{"name": CATALOG.skills[r["skillId"]]["name"], "level": level} for r in reqs]


def profile(skills, **extra):
    base = {"name": "Test Student", "degree": "B.Tech", "branch": "CSE", "year": "3rd year",
            "technicalSkills": skills, "softSkills": [], "projects": [], "certifications": [],
            "experience": [], "achievements": []}
    base.update(extra)
    return base


class DatasetIntegrity(unittest.TestCase):
    def test_all_careers_complete(self):
        self.assertEqual(set(CATALOG.careers), {"fullstack", "datascientist", "cybersecurity", "frontend", "backend", "dataanalyst", "devops", "mobile", "qa"})
        for career in CATALOG.careers.values():
            for key in ("overview", "requirements", "softSkills", "projects", "certifications", "roadmapSummary"):
                self.assertTrue(career[key], f"{career['id']} missing {key}")
            orders = [r["order"] for r in career["requirements"]]
            self.assertEqual(len(orders), len(set(orders)))
            for r in career["requirements"]:
                for field in ("why", "learningTopic", "exercise", "effortHours", "importance", "tier"):
                    self.assertTrue(r.get(field), f"{career['id']}/{r['skillId']} missing {field}")

    def test_no_alias_collisions_and_every_skill_resolves_to_itself(self):
        for sid, skill in CATALOG.skills.items():
            self.assertEqual(CATALOG.resolve(skill["name"])[0], sid)
            for alias in skill["aliases"]:
                self.assertEqual(CATALOG.resolve(alias)[0], sid, f"alias {alias!r}")


class ScoringScenarios(unittest.TestCase):
    def test_1_all_required_skills_gives_100(self):
        for cid in CATALOG.careers:
            r = analyze(profile(skills_for(cid)), cid)
            self.assertEqual(r["careerSkillCoverage"]["percent"], 100.0, cid)
            self.assertEqual(r["missingSkills"], [])
            self.assertEqual(r["inProgressSkills"], [])

    def test_2_no_matching_skills_gives_0(self):
        r = analyze(profile([{"name": "Photoshop"}, {"name": "Rust"}]), "fullstack")
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["careerSkillCoverage"]["percent"], 0.0)
        self.assertEqual(len(r["missingSkills"]), 10)
        self.assertEqual(set(r["unrecognizedSkills"]), {"Photoshop", "Rust"})

    def test_3_half_of_required_skills_gives_50(self):
        for cid in CATALOG.careers:
            r = analyze(profile(skills_for(cid, 5)), cid)
            self.assertEqual(r["careerSkillCoverage"]["percent"], 50.0, cid)
            self.assertEqual(r["careerSkillCoverage"]["matched"], 5)
            self.assertEqual(len(r["missingSkills"]), 5)

    def test_beginner_is_in_progress_and_not_counted(self):
        sk = skills_for("fullstack", 4) + [{"name": "SQL", "level": "beginner"}]
        r = analyze(profile(sk), "fullstack")
        self.assertEqual(r["careerSkillCoverage"]["percent"], 40.0)
        self.assertEqual([s["name"] for s in r["inProgressSkills"]], ["SQL"])
        self.assertNotIn("SQL", [s["name"] for s in r["missingSkills"]])

    def test_depth_is_separate_from_coverage(self):
        all_beginner = analyze(profile(skills_for("datascientist", level="beginner")), "datascientist")
        self.assertEqual(all_beginner["careerSkillCoverage"]["percent"], 0.0)
        self.assertAlmostEqual(all_beginner["proficiencyDepth"]["percent"], 33.3, places=1)
        advanced = analyze(profile(skills_for("datascientist", level="advanced")), "datascientist")
        self.assertEqual(advanced["careerSkillCoverage"]["percent"], 100.0)
        self.assertEqual(advanced["proficiencyDepth"]["percent"], 100.0)

    def test_default_level_is_intermediate(self):
        r = analyze(profile([{"name": "Python"}]), "datascientist")
        self.assertEqual(r["matchedSkills"][0]["userLevel"], "intermediate")

    def test_4_changing_career_changes_requirements_and_results(self):
        p = profile([{"name": "Python"}, {"name": "SQL"}, {"name": "Git"}])
        results = {cid: analyze(p, cid) for cid in CATALOG.careers}
        self.assertEqual(results["fullstack"]["careerSkillCoverage"]["percent"], 20.0)
        self.assertEqual(results["datascientist"]["careerSkillCoverage"]["percent"], 30.0)
        self.assertEqual(results["cybersecurity"]["careerSkillCoverage"]["percent"], 10.0)
        missing_sets = {cid: {s["skillId"] for s in r["missingSkills"]} for cid, r in results.items()}
        self.assertNotEqual(missing_sets["fullstack"], missing_sets["datascientist"])
        self.assertIn("react", missing_sets["fullstack"])
        self.assertNotIn("react", missing_sets["datascientist"])
        self.assertNotEqual(results["fullstack"]["roadmap"]["careerId"], results["datascientist"]["roadmap"]["careerId"])

    def test_5_editing_skills_updates_results(self):
        before = analyze(profile([{"name": "JavaScript"}]), "fullstack")
        after = analyze(profile([{"name": "JavaScript"}, {"name": "React"}, {"name": "Node"}]), "fullstack")
        self.assertEqual(before["careerSkillCoverage"]["percent"], 10.0)
        self.assertEqual(after["careerSkillCoverage"]["percent"], 30.0)
        self.assertLess(len(after["missingSkills"]), len(before["missingSkills"]))
        # a completed gap disappears from the roadmap
        ids_before = {i["id"] for ph in before["roadmap"]["phases"] for i in ph["items"]}
        ids_after = {i["id"] for ph in after["roadmap"]["phases"] for i in ph["items"]}
        self.assertIn("fullstack:skill:react", ids_before)
        self.assertNotIn("fullstack:skill:react", ids_after)

    def test_insufficient_data_is_explained_not_scored(self):
        r = analyze(profile([]), "fullstack")
        self.assertEqual(r["status"], "insufficient_data")
        self.assertIsNone(r["careerSkillCoverage"])
        self.assertIsNone(r["roadmap"])
        self.assertIn("technicalSkills", r["missingProfileData"])
        self.assertTrue(r["analysisNotes"])

    def test_scores_are_not_constant(self):
        values = {analyze(profile(skills_for("fullstack", n)), "fullstack")["careerSkillCoverage"]["percent"] for n in range(1, 11)}
        self.assertEqual(len(values), 10)

    def test_gap_details_complete_and_ordered(self):
        r = analyze(profile([{"name": "HTML"}]), "fullstack")
        gaps = r["missingSkills"]
        self.assertEqual(len(gaps), 9)
        for g in gaps:
            for field in ("name", "why", "priority", "learningTopic", "exercise", "suggestedOrder"):
                self.assertTrue(g.get(field), field)
            self.assertIn(g["priority"], ("High", "Medium", "Low"))
        self.assertEqual([g["suggestedOrder"] for g in gaps], sorted(g["suggestedOrder"] for g in gaps))
        tiers = [g["tier"] for g in gaps]
        self.assertEqual(tiers, sorted(tiers, key=["foundation", "core", "advanced"].index))

    def test_priority_rule(self):
        r = analyze(profile([{"name": "HTML"}]), "fullstack")
        by_id = {g["skillId"]: g for g in r["missingSkills"]}
        self.assertEqual(by_id["react"]["priority"], "High")          # high importance + missing
        self.assertEqual(by_id["docker-deploy"]["priority"], "Medium")  # medium importance + missing
        r2 = analyze(profile([{"name": "React", "level": "beginner"}]), "fullstack")
        self.assertEqual(r2["inProgressSkills"][0]["priority"], "Medium")  # high importance + in progress


class AliasNormalization(unittest.TestCase):
    def test_capitalization_spacing_and_punctuation(self):
        for variant in ("Node.js", "node.js", "NODE.JS", "nodejs", "Node JS", "node-js"):
            self.assertEqual(CATALOG.resolve(variant)[0], "nodejs", variant)

    def test_common_aliases(self):
        cases = {"js": "javascript", "ReactJS": "react", "react.js": "react", "Postgres": "sql",
                 "MySQL": "sql", "ML": "machine-learning", "sklearn": "machine-learning",
                 "pytorch": "deep-learning", "Mongo": "nosql", "github": "git-github",
                 "Kali Linux": "linux", "tcp/ip": "networking", "OWASP Top 10": "web-security",
                 "EDA": "data-cleaning-eda", "Power BI": "data-visualization", "HTML/CSS": "html-css"}
        for text, expected in cases.items():
            self.assertEqual(CATALOG.resolve(text)[0], expected, text)

    def test_spelling_correction_is_flagged(self):
        self.assertEqual(CATALOG.resolve("pyhton"), ("python", "fuzzy"))
        self.assertEqual(CATALOG.resolve("javascrpt"), ("javascript", "fuzzy"))
        r = analyze(profile([{"name": "pyhton"}]), "datascientist")
        self.assertEqual(r["matchedSkills"][0]["name"], "Python")
        self.assertTrue(any("spelling correction" in n["message"] for n in r["analysisNotes"]))

    def test_unrelated_words_are_not_force_matched(self):
        for text in ("Rust", "Photoshop", "Blender", "Reach", "Guitar playing", ""):
            self.assertIsNone(CATALOG.resolve(text)[0], text)

    def test_alias_and_canonical_name_are_same_skill_and_keep_best_level(self):
        sk = [{"name": "JS", "level": "beginner"}, {"name": "JavaScript", "level": "advanced"}]
        r = analyze(profile(sk), "fullstack")
        self.assertEqual(r["careerSkillCoverage"]["matched"], 1)
        self.assertEqual(r["matchedSkills"][0]["userLevel"], "advanced")

    def test_soft_skill_aliases(self):
        r = analyze(profile([{"name": "Python"}], softSkills=["team work", "Public speaking", "Juggling"]), "fullstack")
        names = {s["name"] for s in r["softSkills"]["matched"]}
        self.assertEqual(names, {"Teamwork", "Communication"})

    def test_compact_is_stable(self):
        self.assertEqual(compact("  C++  "), "c++")
        self.assertEqual(compact("Html & CSS"), compact("html and css"))


class ProjectsAndRoadmap(unittest.TestCase):
    def test_project_technologies_are_evidence_but_do_not_change_coverage(self):
        p = profile([{"name": "JavaScript"}],
                    projects=[{"title": "Shop", "description": "", "technologies": ["React", "Node", "MongoDB"]}])
        r = analyze(p, "fullstack")
        self.assertEqual(r["careerSkillCoverage"]["percent"], 10.0)
        react = next(g for g in r["missingSkills"] if g["skillId"] == "react")
        self.assertEqual(react["usedInProjects"], ["Shop"])
        self.assertTrue(any("React" in n["message"] and "Shop" in n["message"] for n in r["analysisNotes"]))
        self.assertEqual(r["profileSummary"]["careerRelevantProjectCount"], 1)

    def test_roadmap_structure_and_stable_ids(self):
        r = analyze(profile([{"name": "HTML"}, {"name": "JavaScript"}]), "fullstack")
        phases = r["roadmap"]["phases"]
        self.assertEqual([p["id"] for p in phases], ["phase-1", "phase-2", "phase-3", "phase-4"])
        ids = [i["id"] for p in phases for i in p["items"]]
        self.assertEqual(len(ids), len(set(ids)))
        for p in phases:
            for item in p["items"]:
                for field in ("objective", "reason", "activity", "deliverable", "estimatedHours", "priority"):
                    self.assertTrue(item.get(field), f"{item['id']} missing {field}")
        self.assertEqual(r["roadmap"]["totalItems"], len(ids))
        again = analyze(profile([{"name": "HTML"}, {"name": "JavaScript"}]), "fullstack")
        self.assertEqual(ids, [i["id"] for p in again["roadmap"]["phases"] for i in p["items"]])

    def test_phase_1_holds_foundation_gaps_and_phase_2_the_rest(self):
        r = analyze(profile([{"name": "Python"}]), "fullstack")
        p1 = {i["skillId"] for i in r["roadmap"]["phases"][0]["items"]}
        p2 = {i["skillId"] for i in r["roadmap"]["phases"][1]["items"]}
        self.assertEqual(p1, {"html-css", "javascript", "git-github"})
        self.assertTrue({"react", "nodejs", "authentication"} <= p2)

    def test_full_coverage_roadmap_skips_skill_phases_but_keeps_projects(self):
        r = analyze(profile(skills_for("cybersecurity")), "cybersecurity")
        phases = r["roadmap"]["phases"]
        self.assertEqual(phases[0]["items"], [])
        self.assertEqual(phases[1]["items"], [])
        self.assertTrue(phases[2]["items"])
        self.assertTrue(phases[3]["items"])

    def test_projects_target_the_gaps(self):
        # student missing only Docker & Deployment -> the deployment project must be chosen
        sk = [s for s in skills_for("fullstack") if s["name"] != "Docker & Deployment"]
        r = analyze(profile(sk), "fullstack")
        titles = [i["objective"] for i in r["roadmap"]["phases"][2]["items"]]
        self.assertIn("Build: Deployed portfolio with a live backend", titles)

    def test_experience_changes_phase_4(self):
        none = analyze(profile([{"name": "Python"}]), "datascientist")
        some = analyze(profile([{"name": "Python"}], experience=[{"role": "Data intern", "organization": "Acme Lab", "description": ""}]), "datascientist")
        self.assertIn("Gain practical experience", [i["objective"] for i in none["roadmap"]["phases"][3]["items"]])
        self.assertIn("Prepare to discuss Data intern", [i["objective"] for i in some["roadmap"]["phases"][3]["items"]])

    def test_recommendations_match_actual_gaps(self):
        r = analyze(profile([{"name": "HTML"}]), "fullstack")
        gap_ids = {g["skillId"] for g in r["missingSkills"]}
        skill_recs = [i for i in r["recommendations"]["items"] if i["skillId"]]
        self.assertTrue(skill_recs)
        for rec in skill_recs:
            self.assertIn(rec["skillId"], gap_ids)
        self.assertEqual(r["recommendations"]["source"], "rule-based")


class AIFallback(unittest.TestCase):
    def setUp(self):
        self._saved = os.environ.pop("ANTHROPIC_API_KEY", None)
        self.profile = profile([{"name": "HTML"}, {"name": "JavaScript", "level": "beginner"}])
        self.analysis = analyze(self.profile, "fullstack")

    def tearDown(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        if self._saved is not None:
            os.environ["ANTHROPIC_API_KEY"] = self._saved

    def _with_key(self):
        os.environ["ANTHROPIC_API_KEY"] = "test-key-not-real"

    def ok_body(self, recs):
        return json.dumps({"content": [{"type": "text", "text": json.dumps({"recommendations": recs})}]})

    def test_no_key_falls_back_without_calling_network(self):
        def boom(*a, **k):
            raise AssertionError("transport must not be called without a key")
        r = ai.get_recommendations(self.analysis, self.profile, transport=boom)
        self.assertEqual(r["source"], "rule-based")
        self.assertEqual(r["fallbackReason"], "not_configured")
        self.assertFalse(r["aiConfigured"])
        self.assertFalse(r["aiAttempted"])
        self.assertTrue(r["items"])
        self.assertNotIn("AI model", r["generatedBy"])

    def test_valid_ai_response_is_labelled_ai_and_validated(self):
        self._with_key()
        good = [{"skill": "React", "whyRelevant": "You have JavaScript basics.", "nextStep": "Build a counter app this week."},
                {"skill": "node.js", "whyRelevant": "Needed for your backend.", "nextStep": "Create one Express route."}]
        seen = {}

        def transport(headers, body, timeout):
            seen.update(headers=headers, body=body, timeout=timeout)
            return 200, self.ok_body(good)
        r = ai.get_recommendations(self.analysis, self.profile, transport=transport)
        self.assertEqual(r["source"], "ai")
        self.assertEqual([i["title"] for i in r["items"]], ["React", "Node.js"])
        self.assertEqual(seen["headers"]["x-api-key"], "test-key-not-real")
        user_msg = seen["body"]["messages"][0]["content"]
        self.assertIn("Full Stack Developer", user_msg)
        self.assertIn("React", user_msg)  # calculated gaps are passed to the model
        self.assertNotIn("test-key-not-real", json.dumps(seen["body"]))

    def test_hallucinated_skills_are_dropped(self):
        self._with_key()
        recs = [{"skill": "Quantum Basket Weaving", "whyRelevant": "x", "nextStep": "y"},
                {"skill": "HTML & CSS", "whyRelevant": "already matched, not a gap", "nextStep": "y"},
                {"skill": "React", "whyRelevant": "ok", "nextStep": "do it"}]
        r = ai.get_recommendations(self.analysis, self.profile, transport=lambda h, b, t: (200, self.ok_body(recs)))
        self.assertEqual(r["source"], "ai")
        self.assertEqual([i["title"] for i in r["items"]], ["React"])

    def test_failure_modes_fall_back_with_reason(self):
        self._with_key()

        def raising(exc):
            def t(h, b, to):
                raise exc
            return t
        cases = {
            "rate_limited": lambda h, b, t: (429, "{}"),
            "auth_failed": lambda h, b, t: (401, "{}"),
            "service_error": lambda h, b, t: (500, "oops"),
            "malformed_response": lambda h, b, t: (200, json.dumps({"content": [{"type": "text", "text": "Sure! Here are some ideas"}]})),
            "timeout": raising(TimeoutError()),
            "unavailable": raising(urllib.error.URLError("no route")),
        }
        for reason, transport in cases.items():
            r = ai.get_recommendations(self.analysis, self.profile, transport=transport)
            self.assertEqual(r["source"], "rule-based", reason)
            self.assertEqual(r["fallbackReason"], reason)
            self.assertTrue(r["aiAttempted"])
            self.assertTrue(r["items"])
            self.assertTrue(r["message"])

    def test_malformed_shapes_rejected(self):
        self._with_key()
        for text in ('{"recommendations": "nope"}', '[]', '{"recommendations": [{"skill": "React"}]}', "```json\n{broken\n```"):
            body = json.dumps({"content": [{"type": "text", "text": text}]})
            r = ai.get_recommendations(self.analysis, self.profile, transport=lambda h, b, t, body=body: (200, body))
            self.assertEqual(r["fallbackReason"], "malformed_response", text)

    def test_code_fenced_json_is_accepted(self):
        items = ai.parse_and_validate('```json\n{"recommendations":[{"skill":"react","whyRelevant":"a","nextStep":"b"}]}\n```', ["React"])
        self.assertEqual(items[0]["skill"], "React")

    def test_no_gaps_and_insufficient_data_skip_ai(self):
        self._with_key()

        def boom(*a, **k):
            raise AssertionError("should not call AI")
        full = analyze(profile(skills_for("fullstack")), "fullstack")
        self.assertEqual(ai.get_recommendations(full, self.profile, transport=boom)["fallbackReason"], "no_gaps")
        empty = analyze(profile([]), "fullstack")
        self.assertEqual(ai.get_recommendations(empty, self.profile, transport=boom)["fallbackReason"], "insufficient_data")


if __name__ == "__main__":
    unittest.main(verbosity=2)
