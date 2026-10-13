"""Password hashing, session tokens and login throttling. Standard library only (scrypt, sha256, secrets)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

SESSION_DAYS = 7
MIN_PASSWORD = 8
MAX_PASSWORD = 128
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# A real hash of a random password, verified against when the email is unknown so response time doesn't reveal it.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def burn_time() -> None:
    verify_password("x", _DUMMY_HASH)


def new_session_token() -> tuple[str, str, datetime]:
    """Return (token for the cookie, sha256 hash to store, expiry). Only the hash is stored."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token), datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_registration(name: str, email: str, password: str) -> list[dict]:
    problems = []
    if not name.strip() or len(name.strip()) > 80:
        problems.append({"field": "name", "message": "Enter your name (up to 80 characters)."})
    if not EMAIL_RE.match(email.strip()):
        problems.append({"field": "email", "message": "Enter a valid email address."})
    if len(password) < MIN_PASSWORD:
        problems.append({"field": "password", "message": f"Use at least {MIN_PASSWORD} characters."})
    elif len(password) > MAX_PASSWORD:
        problems.append({"field": "password", "message": f"Use at most {MAX_PASSWORD} characters."})
    return problems


class Throttle:
    """Allow `limit` failed attempts per key per `window` seconds."""

    def __init__(self, limit: int = 6, window: int = 900) -> None:
        self.limit, self.window = limit, window
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str) -> list[float]:
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        self._hits[key] = hits
        return hits

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._recent(key)) >= self.limit

    def fail(self, key: str) -> None:
        with self._lock:
            self._recent(key).append(time.monotonic())

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset_all(self) -> None:
        with self._lock:
            self._hits.clear()
