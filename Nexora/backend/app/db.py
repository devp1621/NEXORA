"""Storage layer for accounts, sessions and each student's saved state.

``MongoRepo`` is the production implementation (MongoDB through PyMongo). ``MemoryRepo`` has the
same interface and exists for tests; it is never used by the running app. The app talks only to the
interface, so the HTTP layer does not care which one is behind it.

Configuration (environment variables):
    MONGODB_URI   e.g. mongodb://localhost:27017  or a MongoDB Atlas connection string
    MONGODB_DB    database name, default "nexora"

If MONGODB_URI is not set, accounts use a local SQLite file (backend/nexora_local.db) so sign in works with zero setup.\nSet NEXORA_LOCAL_DB=off to disable accounts entirely (guest mode).
"""

from __future__ import annotations

import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any


class EmailTaken(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # Mongo returns naive UTC datetimes


class MemoryRepo:
    """In-memory implementation for tests."""

    kind = "memory"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.users: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.states: dict[str, dict] = {}

    def ping(self) -> None:
        return None

    def create_user(self, email: str, name: str, password_hash: str) -> dict:
        with self._lock:
            if any(u["email"] == email for u in self.users.values()):
                raise EmailTaken(email)
            user = {"_id": uuid.uuid4().hex, "email": email, "name": name, "passwordHash": password_hash, "createdAt": _now()}
            self.users[user["_id"]] = user
            return dict(user)

    def get_user_by_email(self, email: str) -> dict | None:
        with self._lock:
            return next((dict(u) for u in self.users.values() if u["email"] == email), None)

    def get_user(self, user_id: str) -> dict | None:
        with self._lock:
            u = self.users.get(user_id)
            return dict(u) if u else None

    def create_session(self, user_id: str, token_hash: str, expires_at: datetime) -> None:
        with self._lock:
            self.sessions[token_hash] = {"tokenHash": token_hash, "userId": user_id, "expiresAt": expires_at}

    def get_session(self, token_hash: str) -> dict | None:
        with self._lock:
            s = self.sessions.get(token_hash)
            return dict(s) if s else None

    def delete_session(self, token_hash: str) -> None:
        with self._lock:
            self.sessions.pop(token_hash, None)

    def get_state(self, user_id: str) -> dict | None:
        with self._lock:
            s = self.states.get(user_id)
            return dict(s["state"]) if s else None

    def save_state(self, user_id: str, state: dict) -> None:
        with self._lock:
            self.states[user_id] = {"userId": user_id, "state": state, "updatedAt": _now()}


class MongoRepo:
    """MongoDB implementation. Collections: users, sessions, states."""

    kind = "mongodb"

    def __init__(self, uri: str, db_name: str = "nexora", client: Any = None) -> None:
        if client is None:
            try:
                from pymongo import MongoClient  # imported lazily so the app runs without pymongo in guest mode
            except ImportError as exc:
                raise RuntimeError("MONGODB_URI is set but the 'pymongo' package is not installed. Run: pip install pymongo") from exc
            client = MongoClient(uri, serverSelectionTimeoutMS=4000, tz_aware=True)
        self.client = client
        self.db = client[db_name]
        self.users = self.db["users"]
        self.sessions = self.db["sessions"]
        self.states = self.db["states"]

    def ping(self) -> None:
        self.client.admin.command("ping")

    def ensure_indexes(self) -> None:
        self.users.create_index("email", unique=True)
        self.sessions.create_index("tokenHash", unique=True)
        self.sessions.create_index("expiresAt", expireAfterSeconds=0)  # Mongo deletes expired sessions itself
        self.states.create_index("userId", unique=True)

    def create_user(self, email: str, name: str, password_hash: str) -> dict:
        user = {"_id": uuid.uuid4().hex, "email": email, "name": name, "passwordHash": password_hash, "createdAt": _now()}
        try:
            self.users.insert_one(user)
        except Exception as exc:  # pymongo.errors.DuplicateKeyError, matched by name to keep the import lazy
            if type(exc).__name__ == "DuplicateKeyError":
                raise EmailTaken(email) from exc
            raise
        return user

    def get_user_by_email(self, email: str) -> dict | None:
        return self.users.find_one({"email": email})

    def get_user(self, user_id: str) -> dict | None:
        return self.users.find_one({"_id": user_id})

    def create_session(self, user_id: str, token_hash: str, expires_at: datetime) -> None:
        self.sessions.insert_one({"tokenHash": token_hash, "userId": user_id, "expiresAt": expires_at})

    def get_session(self, token_hash: str) -> dict | None:
        return self.sessions.find_one({"tokenHash": token_hash})

    def delete_session(self, token_hash: str) -> None:
        self.sessions.delete_one({"tokenHash": token_hash})

    def get_state(self, user_id: str) -> dict | None:
        doc = self.states.find_one({"userId": user_id})
        return doc["state"] if doc else None

    def save_state(self, user_id: str, state: dict) -> None:
        self.states.update_one({"userId": user_id}, {"$set": {"state": state, "updatedAt": _now()}}, upsert=True)


class SqliteRepo:
    """Zero-setup local storage (a single file) used when MONGODB_URI is not set. Same interface as MongoRepo."""

    kind = "local-file"

    def __init__(self, path: str) -> None:
        import json as _json
        import sqlite3

        self._json = _json
        self._lock = threading.Lock()
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        with self._lock, self.conn:
            self.conn.executescript(
                "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, passwordHash TEXT, createdAt TEXT);"
                "CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY, userId TEXT, expiresAt TEXT);"
                "CREATE TABLE IF NOT EXISTS states(userId TEXT PRIMARY KEY, state TEXT, updatedAt TEXT);"
            )

    def ping(self) -> None:
        with self._lock:
            self.conn.execute("SELECT 1")

    def _user(self, row) -> dict | None:
        if not row:
            return None
        return {"_id": row["id"], "email": row["email"], "name": row["name"], "passwordHash": row["passwordHash"],
                "createdAt": datetime.fromisoformat(row["createdAt"])}

    def create_user(self, email: str, name: str, password_hash: str) -> dict:
        import sqlite3

        uid, now = uuid.uuid4().hex, _now()
        try:
            with self._lock, self.conn:
                self.conn.execute("INSERT INTO users VALUES(?,?,?,?,?)", (uid, email, name, password_hash, now.isoformat()))
        except sqlite3.IntegrityError as exc:
            raise EmailTaken(email) from exc
        return {"_id": uid, "email": email, "name": name, "passwordHash": password_hash, "createdAt": now}

    def get_user_by_email(self, email: str) -> dict | None:
        with self._lock:
            return self._user(self.conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone())

    def get_user(self, user_id: str) -> dict | None:
        with self._lock:
            return self._user(self.conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())

    def create_session(self, user_id: str, token_hash: str, expires_at: datetime) -> None:
        with self._lock, self.conn:
            self.conn.execute("DELETE FROM sessions WHERE expiresAt<?", (_now().isoformat(),))
            self.conn.execute("INSERT OR REPLACE INTO sessions VALUES(?,?,?)", (token_hash, user_id, _aware(expires_at).isoformat()))

    def get_session(self, token_hash: str) -> dict | None:
        with self._lock:
            r = self.conn.execute("SELECT * FROM sessions WHERE tokenHash=?", (token_hash,)).fetchone()
        if not r:
            return None
        return {"tokenHash": r["tokenHash"], "userId": r["userId"], "expiresAt": datetime.fromisoformat(r["expiresAt"])}

    def delete_session(self, token_hash: str) -> None:
        with self._lock, self.conn:
            self.conn.execute("DELETE FROM sessions WHERE tokenHash=?", (token_hash,))

    def get_state(self, user_id: str) -> dict | None:
        with self._lock:
            r = self.conn.execute("SELECT state FROM states WHERE userId=?", (user_id,)).fetchone()
        return self._json.loads(r["state"]) if r else None

    def save_state(self, user_id: str, state: dict) -> None:
        with self._lock, self.conn:
            self.conn.execute("INSERT OR REPLACE INTO states VALUES(?,?,?)", (user_id, self._json.dumps(state), _now().isoformat()))


# ---------------------------------------------------------------- app-wide handle

_repo: Any = None
_error: str | None = None


def init_from_env() -> None:
    """Connect to MongoDB if MONGODB_URI is set. Never raises: a failure disables accounts and is reported by /api/health."""
    global _repo, _error
    uri = os.getenv("MONGODB_URI", "").strip()
    _repo, _error = None, None
    if not uri:
        if os.getenv("NEXORA_LOCAL_DB", "").strip().lower() == "off":
            return
        try:  # no MongoDB configured: fall back to a local file so sign in/up works with zero setup
            here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            path = os.getenv("NEXORA_LOCAL_DB", "").strip()
            if not path:
                # Cloud-synced folders (OneDrive) can lock SQLite files, so keep the data in the user's home folder there.
                if "onedrive" in here.lower():
                    home = os.path.join(os.path.expanduser("~"), ".nexora")
                    os.makedirs(home, exist_ok=True)
                    path = os.path.join(home, "nexora_local.db")
                else:
                    path = os.path.join(here, "nexora_local.db")
            _repo = SqliteRepo(path)
        except Exception as exc:  # noqa: BLE001
            _error = f"{type(exc).__name__}: {str(exc)[:200]}"
        return
    try:
        repo = MongoRepo(uri, os.getenv("MONGODB_DB", "nexora").strip() or "nexora")
        repo.ping()
        repo.ensure_indexes()
        _repo = repo
    except Exception as exc:  # noqa: BLE001 - report any connection problem without leaking the URI
        _error = f"{type(exc).__name__}: {str(exc).replace(uri, '<uri>')[:200]}"


def get_repo() -> Any:
    return _repo


def get_error() -> str | None:
    return _error


def set_repo(repo: Any) -> None:
    """Used by tests."""
    global _repo, _error
    _repo, _error = repo, None
