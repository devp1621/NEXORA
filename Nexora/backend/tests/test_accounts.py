import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from starlette.testclient import TestClient  # noqa: E402

from app import accounts, auth, db  # noqa: E402
from app.main import app  # noqa: E402

PROFILE = {
    "name": "Test Student", "degree": "B.Tech", "branch": "CSE", "year": "Semester 5",
    "technicalSkills": [{"name": "React", "level": "advanced"}], "softSkills": ["Teamwork"],
    "projects": [], "certifications": [], "experience": [], "achievements": [],
}
JSON = {"content-type": "application/json"}


class FakeDuplicateKeyError(Exception):
    pass


FakeDuplicateKeyError.__name__ = "DuplicateKeyError"


class FakeCollection:
    def __init__(self):
        self.docs, self.unique, self.indexes = [], [], []

    def create_index(self, field, unique=False, expireAfterSeconds=None):
        self.indexes.append((field, unique, expireAfterSeconds))
        if unique:
            self.unique.append(field)

    def insert_one(self, doc):
        for f in self.unique:
            if any(d.get(f) == doc.get(f) for d in self.docs):
                raise FakeDuplicateKeyError(f)
        self.docs.append(dict(doc))

    def find_one(self, flt):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                return dict(d)
        return None

    def delete_one(self, flt):
        d = self.find_one(flt)
        if d:
            self.docs = [x for x in self.docs if x.get("_id") != d.get("_id") or x.get("tokenHash") != d.get("tokenHash")]

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update["$set"])
                return
        if upsert:
            self.docs.append({**flt, **update["$set"]})


class FakeMongoClient:
    def __init__(self):
        self.dbs = {}
        self.admin = type("A", (), {"command": staticmethod(lambda c: {"ok": 1})})()

    def __getitem__(self, name):
        db_ = self.dbs.setdefault(name, {})
        return type("Db", (), {"__getitem__": lambda s, c: db_.setdefault(c, FakeCollection())})()


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.repo = db.MemoryRepo()
        db.set_repo(self.repo)
        accounts.throttle.reset_all()
        self.c = TestClient(app)

    def tearDown(self):
        db.set_repo(None)

    def register(self, email="a@example.com", name="Asha", password="correct-horse", client=None):
        return (client or self.c).post("/api/auth/register", json={"name": name, "email": email, "password": password})

    def test_register_logs_in_and_me_works(self):
        r = self.register()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["user"]["email"], "a@example.com")
        self.assertNotIn("passwordHash", r.text)
        self.assertEqual(self.c.get("/api/auth/me").json()["user"]["name"], "Asha")
        self.assertIn("httponly", r.headers["set-cookie"].lower())

    def test_password_is_hashed_and_token_stored_hashed(self):
        self.register(password="correct-horse")
        stored = next(iter(self.repo.users.values()))["passwordHash"]
        self.assertTrue(stored.startswith("scrypt$"))
        self.assertNotIn("correct-horse", stored)
        token = self.c.cookies.get(accounts.COOKIE)
        self.assertNotIn(token, self.repo.sessions)  # only the sha256 is stored
        self.assertIn(auth.hash_token(token), self.repo.sessions)

    def test_validation_errors(self):
        r = self.c.post("/api/auth/register", json={"name": "", "email": "nope", "password": "short"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual({d["field"] for d in r.json()["error"]["details"]}, {"name", "email", "password"})

    def test_duplicate_email_case_insensitive(self):
        self.register("Same@Example.com")
        r = self.register("same@example.COM", client=TestClient(app))
        self.assertEqual(r.status_code, 409)

    def test_login_logout_cycle(self):
        self.register()
        other = TestClient(app)
        bad = other.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-password"})
        self.assertEqual(bad.status_code, 401)
        self.assertEqual(bad.json()["error"]["message"], "Invalid email or password.")
        unknown = other.post("/api/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"})
        self.assertEqual(unknown.json()["error"]["message"], bad.json()["error"]["message"])  # no user enumeration
        ok = other.post("/api/auth/login", json={"email": " A@Example.com ", "password": "correct-horse"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(other.get("/api/auth/me").status_code, 200)
        other.post("/api/auth/logout")
        self.assertIsNone(other.get("/api/auth/me").json()["user"])

    def test_throttle_after_repeated_failures(self):
        self.register()
        other = TestClient(app)
        for _ in range(6):
            other.post("/api/auth/login", json={"email": "a@example.com", "password": "bad-password"})
        r = other.post("/api/auth/login", json={"email": "a@example.com", "password": "correct-horse"})
        self.assertEqual(r.status_code, 429)

    def test_expired_session_rejected(self):
        self.register()
        for s in self.repo.sessions.values():
            s["expiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertIsNone(self.c.get("/api/auth/me").json()["user"])
        self.assertEqual(self.repo.sessions, {})

    def test_state_requires_login_and_roundtrips(self):
        anon = TestClient(app)
        self.assertEqual(anon.get("/api/state").status_code, 401)
        self.assertEqual(anon.put("/api/state", json={}).status_code, 401)
        self.register()
        self.assertEqual(self.c.get("/api/state").json(), {"state": None})
        body = {"profile": {**PROFILE, "sample": "aarav"}, "careerId": "fullstack", "progress": {"t1": True, "t2": False},
                "chat": [{"role": "user", "text": "hi"}, {"role": "assistant", "text": "hello", "source": "rule-based"}]}
        self.assertEqual(self.c.put("/api/state", json=body).status_code, 200)
        got = self.c.get("/api/state").json()["state"]
        self.assertEqual(got["careerId"], "fullstack")
        self.assertEqual(got["progress"], {"t1": True})
        self.assertEqual(got["profile"]["sample"], "aarav")
        self.assertEqual(len(got["chat"]), 2)

    def test_users_cannot_see_each_others_data(self):
        self.register("one@example.com")
        self.c.put("/api/state", json={"profile": PROFILE, "careerId": "fullstack"})
        two = TestClient(app)
        self.register("two@example.com", client=two)
        self.assertIsNone(two.get("/api/state").json()["state"])

    def test_state_validation(self):
        self.register()
        self.assertEqual(self.c.put("/api/state", json={"careerId": "nope"}).status_code, 422)
        self.assertEqual(self.c.put("/api/state", json={"profile": {"name": ""}}).status_code, 422)
        self.assertEqual(self.c.put("/api/state", json={"chat": [{"role": "system", "text": "x"}]}).status_code, 422)
        self.assertEqual(self.c.put("/api/state", content=b"{}", headers={"content-type": "text/plain"}).status_code, 415)
        self.assertEqual(self.c.put("/api/state", content=b"{bad", headers=JSON).status_code, 400)

    def test_guest_mode_without_database(self):
        db.set_repo(None)
        c = TestClient(app)
        self.assertEqual(c.post("/api/auth/login", json={"email": "a@b.co", "password": "x"}).status_code, 503)
        self.assertEqual(c.get("/api/auth/me").status_code, 503)
        health = c.get("/api/health").json()
        self.assertFalse(health["authEnabled"])
        self.assertEqual(c.get("/api/careers").status_code, 200)  # core features unaffected

    def test_health_reports_database(self):
        h = self.c.get("/api/health").json()
        self.assertTrue(h["authEnabled"])
        self.assertEqual(h["database"], "memory")


class MongoRepoTests(unittest.TestCase):
    """Runs the real MongoRepo code against a fake client (no real MongoDB is available in CI here)."""

    def setUp(self):
        self.repo = db.MongoRepo("mongodb://unused", "t", client=FakeMongoClient())
        self.repo.ensure_indexes()

    def test_indexes_requested(self):
        self.assertIn(("email", True, None), self.repo.users.indexes)
        self.assertIn(("expiresAt", False, 0), self.repo.sessions.indexes)
        self.assertIn(("userId", True, None), self.repo.states.indexes)

    def test_user_session_state_cycle(self):
        u = self.repo.create_user("a@b.co", "A", "hash")
        with self.assertRaises(db.EmailTaken):
            self.repo.create_user("a@b.co", "A2", "hash")
        self.assertEqual(self.repo.get_user_by_email("a@b.co")["_id"], u["_id"])
        self.assertEqual(self.repo.get_user(u["_id"])["name"], "A")
        exp = datetime.now(timezone.utc) + timedelta(days=1)
        self.repo.create_session(u["_id"], "th", exp)
        self.assertEqual(self.repo.get_session("th")["userId"], u["_id"])
        self.repo.delete_session("th")
        self.assertIsNone(self.repo.get_session("th"))
        self.assertIsNone(self.repo.get_state(u["_id"]))
        self.repo.save_state(u["_id"], {"careerId": "x"})
        self.repo.save_state(u["_id"], {"careerId": "y"})
        self.assertEqual(self.repo.get_state(u["_id"]), {"careerId": "y"})

    def test_missing_pymongo_gives_clear_error_and_disables_accounts(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {"MONGODB_URI": "mongodb://secret-host:27017"}):
            db.init_from_env()
        self.assertIsNone(db.get_repo())
        self.assertTrue(db.get_error())
        self.assertNotIn("secret-host", db.get_error())
        db.set_repo(None)


if __name__ == "__main__":
    unittest.main()


class SqliteRepoTests(unittest.TestCase):
    def test_roundtrip(self):
        import tempfile, os
        from datetime import datetime, timedelta, timezone
        from app import db
        with tempfile.TemporaryDirectory() as d:
            r = db.SqliteRepo(os.path.join(d, "t.db"))
            u = r.create_user("a@b.co", "A", "hash")
            with self.assertRaises(db.EmailTaken):
                r.create_user("a@b.co", "A2", "h2")
            self.assertEqual(r.get_user_by_email("a@b.co")["_id"], u["_id"])
            r.create_session(u["_id"], "tok", datetime.now(timezone.utc) + timedelta(days=1))
            self.assertEqual(r.get_session("tok")["userId"], u["_id"])
            r.save_state(u["_id"], {"x": 1})
            self.assertEqual(r.get_state(u["_id"]), {"x": 1})
            r.delete_session("tok")
            self.assertIsNone(r.get_session("tok"))
