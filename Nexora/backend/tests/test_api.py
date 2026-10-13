"""HTTP-level tests against a real uvicorn server on a free local port."""

import json
import os
import socket
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.pop("ANTHROPIC_API_KEY", None)

import uvicorn  # noqa: E402

from app.main import app  # noqa: E402

DEMO = {
    "name": "Sample Student", "degree": "B.Tech", "branch": "Computer Science", "year": "5th semester",
    "technicalSkills": [{"name": "HTML", "level": "advanced"}, {"name": "JS", "level": "intermediate"},
                        {"name": "React", "level": "beginner"}, {"name": "git"}],
    "softSkills": ["Teamwork"],
    "projects": [{"title": "Portfolio", "description": "My site", "technologies": ["HTML", "CSS"]}],
    "certifications": [{"name": "Intro course", "issuer": "Someone"}],
    "experience": [], "achievements": ["Hackathon finalist"],
}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = free_port()
        cls.server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=cls.port, log_level="warning"))
        cls.thread = threading.Thread(target=cls.server.run, daemon=True)
        cls.thread.start()
        for _ in range(100):
            if cls.server.started:
                break
            time.sleep(0.05)
        else:
            raise RuntimeError("server did not start")
        cls.base = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(timeout=5)

    def call(self, method, path, body=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, data=data, method=method, headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_health(self):
        status, body = self.call("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        self.assertFalse(body["aiConfigured"])

    def test_careers(self):
        status, body = self.call("GET", "/api/careers")
        self.assertEqual(status, 200)
        self.assertEqual([c["id"] for c in body["careers"]], ["fullstack", "datascientist", "cybersecurity", "frontend", "backend", "dataanalyst", "devops", "mobile", "qa"])
        self.assertTrue(all(c["totalRequiredSkills"] == len(c["requirements"]) for c in body["careers"]))
        self.assertIn("not official industry standards", body["disclaimer"])
        self.assertTrue(body["skillCatalog"] and body["softSkillCatalog"])

    def test_analyze_ok_and_expected_shape(self):
        status, body = self.call("POST", "/api/analyze", {"careerId": "fullstack", "profile": DEMO})
        self.assertEqual(status, 200)
        for key in ("selectedCareer", "careerSkillCoverage", "matchedSkills", "inProgressSkills", "missingSkills",
                    "strengths", "priorityGaps", "roadmap", "recommendations", "analysisNotes"):
            self.assertIn(key, body)
        # HTML & CSS, JavaScript, Git matched; React in progress => 3/10
        self.assertEqual(body["careerSkillCoverage"]["percent"], 30.0)
        self.assertEqual([s["name"] for s in body["inProgressSkills"]], ["React"])

    def test_career_switch_changes_response(self):
        _, a = self.call("POST", "/api/analyze", {"careerId": "fullstack", "profile": DEMO})
        _, b = self.call("POST", "/api/analyze", {"careerId": "cybersecurity", "profile": DEMO})
        self.assertNotEqual(a["careerSkillCoverage"], b["careerSkillCoverage"])
        self.assertNotEqual({s["skillId"] for s in a["missingSkills"]}, {s["skillId"] for s in b["missingSkills"]})

    def test_unknown_career_404(self):
        status, body = self.call("POST", "/api/analyze", {"careerId": "astronaut", "profile": DEMO})
        self.assertEqual(status, 404)
        self.assertEqual(body["error"]["code"], "unknown_career")
        self.assertIn("fullstack", body["error"]["message"])

    def test_validation_errors_are_specific(self):
        bad = {**DEMO, "name": "   ", "degree": "", "technicalSkills": [{"name": "Python", "level": "wizard"}],
               "projects": [{"title": ""}]}
        status, body = self.call("POST", "/api/analyze", {"careerId": "fullstack", "profile": bad})
        self.assertEqual(status, 422)
        self.assertEqual(body["error"]["code"], "validation_error")
        fields = {d["field"] for d in body["error"]["details"]}
        self.assertTrue({"profile.name", "profile.degree", "profile.technicalSkills.0.level", "profile.projects.0.title"} <= fields, fields)

    def test_missing_profile_and_bad_json(self):
        status, body = self.call("POST", "/api/analyze", {"careerId": "fullstack"})
        self.assertEqual(status, 422)
        self.assertIn("profile", {d["field"] for d in body["error"]["details"]})
        status, body = self.call("POST", "/api/analyze", raw=b"{not json")
        self.assertEqual((status, body["error"]["code"]), (400, "invalid_json"))
        status, body = self.call("POST", "/api/analyze", raw=b"[1,2]")
        self.assertEqual((status, body["error"]["code"]), (400, "invalid_body"))

    def test_no_skills_returns_insufficient_data_not_a_score(self):
        status, body = self.call("POST", "/api/analyze", {"careerId": "fullstack", "profile": {**DEMO, "technicalSkills": []}})
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "insufficient_data")
        self.assertIsNone(body["careerSkillCoverage"])

    def test_recommendations_without_ai_key_fall_back_honestly(self):
        status, body = self.call("POST", "/api/recommendations", {"careerId": "fullstack", "profile": DEMO})
        self.assertEqual(status, 200)
        self.assertEqual(body["source"], "rule-based")
        self.assertEqual(body["fallbackReason"], "not_configured")
        self.assertTrue(body["items"])
        self.assertIn("not configured", body["message"])

    def test_recommendations_validate_input_too(self):
        status, body = self.call("POST", "/api/recommendations", {"careerId": "nope", "profile": DEMO})
        self.assertEqual(status, 404)
        status, body = self.call("POST", "/api/recommendations", {"careerId": "fullstack", "profile": {}})
        self.assertEqual(status, 422)

    def test_unknown_api_route_is_json_404(self):
        status, body = self.call("GET", "/api/nothing")
        self.assertEqual((status, body["error"]["code"]), (404, "not_found"))

    def test_no_secrets_in_responses(self):
        os.environ["ANTHROPIC_API_KEY"] = "sk-test-should-never-leak"
        try:
            for path in ("/api/health", "/api/careers"):
                _, body = self.call("GET", path)
                self.assertNotIn("sk-test-should-never-leak", json.dumps(body))
        finally:
            os.environ.pop("ANTHROPIC_API_KEY", None)


if __name__ == "__main__":
    unittest.main(verbosity=2)
