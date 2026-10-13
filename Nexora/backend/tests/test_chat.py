import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import chat  # noqa: E402
from app.engine import analyze  # noqa: E402

PROFILE = {
    "name": "Test Student", "degree": "B.Tech", "branch": "CSE", "year": "Semester 5",
    "technicalSkills": [{"name": "ReactJS", "level": "advanced"}, {"name": "JS", "level": "intermediate"},
                        {"name": "Node", "level": "beginner"}],
    "softSkills": [], "projects": [], "certifications": [], "experience": [], "achievements": [],
}


def ok_transport(text):
    return lambda h, b, t: (200, json.dumps({"content": [{"type": "text", "text": text}]}))


class ChatTests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_score_reply_uses_real_numbers(self):
        a = analyze(PROFILE, "fullstack")
        r = chat.respond("what is my score?", [], PROFILE, "fullstack")
        self.assertEqual(r["source"], "rule-based")
        self.assertIn(f"{a['careerSkillCoverage']['percent']:g}%", r["reply"])
        self.assertEqual(r["fallbackReason"], "not_configured")

    def test_missing_lists_actual_gaps(self):
        a = analyze(PROFILE, "fullstack")
        r = chat.respond("what am I missing?", [], PROFILE, "fullstack")
        for g in a["missingSkills"]:
            self.assertIn(g["name"], r["reply"])

    def test_start_points_to_first_gap(self):
        a = analyze(PROFILE, "fullstack")
        first = sorted(a["missingSkills"] + a["inProgressSkills"], key=lambda g: g["suggestedOrder"])[0]
        self.assertIn(first["name"], chat.respond("What should I learn first?", [], PROFILE, "fullstack")["reply"])

    def test_skill_question_and_career_switch(self):
        r = chat.respond("tell me about Docker", [], PROFILE, "fullstack")
        self.assertIn("Docker", r["reply"])
        ds = chat.respond("what is my score?", [], PROFILE, "datascientist" if "datascientist" in __import__("app.engine", fromlist=["x"]).get_catalog().careers else "fullstack")
        self.assertTrue(ds["reply"])

    def test_skill_aliases_and_full_names_resolve(self):
        for q in ("tell me about docker", "how do I learn nodejs?", "explain ReactJS"):
            r = chat.respond(q, [], PROFILE, "fullstack")
            self.assertNotIn("not sure I understood", r["reply"], q)
        self.assertIn("Docker & Deployment", chat.respond("tell me about docker", [], PROFILE, "fullstack")["reply"])

    def test_compare_ranks_all_careers(self):
        r = chat.respond("which career fits me best?", [], PROFILE, "fullstack")
        self.assertEqual(r["reply"].count("%"), 9)

    def test_insufficient_data_not_scored(self):
        empty = {**PROFILE, "technicalSkills": []}
        r = chat.respond("what is my score?", [], empty, "fullstack")
        self.assertNotIn("Career Skill Coverage for", r["reply"])
        self.assertEqual(r["source"], "rule-based")

    def test_unknown_message_is_honest(self):
        r = chat.respond("asdf qwerty", [], PROFILE, "fullstack")
        self.assertIn("not sure", r["reply"])

    def test_ai_success_is_labelled_ai(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            r = chat.respond("hi there", [{"role": "assistant", "content": "x"}, {"role": "user", "content": "a"}], PROFILE, "fullstack", ok_transport("Hello from model"))
        self.assertEqual(r["source"], "ai")
        self.assertEqual(r["reply"], "Hello from model")

    def test_ai_request_roles_alternate_and_key_not_in_response(self):
        seen = {}

        def transport(h, b, t):
            seen["body"] = b
            return 200, json.dumps({"content": [{"type": "text", "text": "ok"}]})

        hist = [{"role": "assistant", "content": "stray"}, {"role": "user", "content": "q1"},
                {"role": "assistant", "content": "a1"}, {"role": "user", "content": "dangling"}]
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "secret-key-123"}):
            r = chat.respond("next?", hist, PROFILE, "fullstack", transport)
        roles = [m["role"] for m in seen["body"]["messages"]]
        self.assertEqual(roles[0], "user")
        self.assertTrue(all(roles[i] != roles[i + 1] for i in range(len(roles) - 1)))
        self.assertEqual(roles[-1], "user")
        self.assertNotIn("secret-key-123", json.dumps(r))

    def test_ai_failures_fall_back_with_reason(self):
        cases = {429: "rate_limited", 401: "auth_failed", 500: "service_error"}
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "k"}):
            for status, reason in cases.items():
                r = chat.respond("what is my score?", [], PROFILE, "fullstack", lambda h, b, t, s=status: (s, "{}"))
                self.assertEqual((r["source"], r["fallbackReason"]), ("rule-based", reason))
            def boom(h, b, t):
                raise TimeoutError
            self.assertEqual(chat.respond("score", [], PROFILE, "fullstack", boom)["fallbackReason"], "timeout")
            r = chat.respond("score", [], PROFILE, "fullstack", lambda h, b, t: (200, "not json"))
            self.assertEqual(r["fallbackReason"], "malformed_response")
            r = chat.respond("score", [], PROFILE, "fullstack", lambda h, b, t: (200, json.dumps({"content": []})))
            self.assertEqual(r["fallbackReason"], "malformed_response")


class ChatApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from starlette.testclient import TestClient  # needs httpx; skip if absent
        from app.main import app
        cls.client = TestClient(app)

    def test_endpoint(self):
        r = self.client.post("/api/chat", json={"careerId": "fullstack", "profile": PROFILE, "message": "what is my score?"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["source"], "rule-based")

    def test_validation_and_unknown_career(self):
        self.assertEqual(self.client.post("/api/chat", json={"careerId": "fullstack", "profile": PROFILE, "message": ""}).status_code, 422)
        self.assertEqual(self.client.post("/api/chat", json={"careerId": "nope", "profile": PROFILE, "message": "hi"}).status_code, 404)
        self.assertEqual(self.client.post("/api/chat", content=b"{bad", headers={"content-type": "application/json"}).status_code, 400)


if __name__ == "__main__":
    unittest.main()
