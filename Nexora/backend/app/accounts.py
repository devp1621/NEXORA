"""Account and saved-state endpoints. Active only when a database is configured (see db.py)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from . import auth, db
from .engine import get_catalog
from .schemas import ProfileIn

COOKIE = "nexora_session"
MAX_STATE_BYTES = 200_000
throttle = auth.Throttle()


def _error(status: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status)


def _unavailable() -> JSONResponse:
    reason = db.get_error()
    msg = "Accounts are not enabled on this server (no database configured)."
    if reason:
        msg = "The database is not reachable, so accounts are unavailable right now."
    return _error(503, "accounts_unavailable", msg)


async def _json_body(request: Request):
    """Parse a JSON object body. Requiring a JSON content type also blocks cross-site form posts."""
    if not request.headers.get("content-type", "").lower().startswith("application/json"):
        return None, _error(415, "unsupported_media_type", "Send the request as application/json.")
    try:
        payload = await request.json()
    except Exception:
        return None, _error(400, "invalid_json", "Request body must be valid JSON.")
    if not isinstance(payload, dict):
        return None, _error(400, "invalid_body", "Request body must be a JSON object.")
    return payload, None


def _public(user: dict) -> dict:
    return {"id": user["_id"], "name": user["name"], "email": user["email"]}


def _set_cookie(response: JSONResponse, token: str) -> None:
    response.set_cookie(
        COOKIE, token, max_age=auth.SESSION_DAYS * 86400, httponly=True, samesite="lax",
        secure=os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes"), path="/",
    )


def current_user(request: Request):
    repo = db.get_repo()
    token = request.cookies.get(COOKIE)
    if repo is None or not token:
        return None
    session = repo.get_session(auth.hash_token(token))
    if not session:
        return None
    expires = session["expiresAt"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        repo.delete_session(auth.hash_token(token))
        return None
    return repo.get_user(session["userId"])


def _client_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "?"
    return f"{host}|{email}"


async def register(request: Request) -> JSONResponse:
    repo = db.get_repo()
    if repo is None:
        return _unavailable()
    payload, err = await _json_body(request)
    if err:
        return err
    name, email, password = (str(payload.get(k) or "") for k in ("name", "email", "password"))
    problems = auth.validate_registration(name, email, password)
    if problems:
        return _error(422, "validation_error", "Please fix the highlighted fields.", problems)
    try:
        user = repo.create_user(auth.normalize_email(email), name.strip(), auth.hash_password(password))
    except db.EmailTaken:
        return _error(409, "email_taken", "An account with this email already exists. Try signing in.", [{"field": "email", "message": "This email is already registered."}])
    token, token_hash, expires = auth.new_session_token()
    repo.create_session(user["_id"], token_hash, expires)
    response = JSONResponse({"user": _public(user)}, status_code=201)
    _set_cookie(response, token)
    return response


async def login(request: Request) -> JSONResponse:
    repo = db.get_repo()
    if repo is None:
        return _unavailable()
    payload, err = await _json_body(request)
    if err:
        return err
    email = auth.normalize_email(str(payload.get("email") or ""))
    password = str(payload.get("password") or "")
    key = _client_key(request, email)
    if throttle.blocked(key):
        return _error(429, "too_many_attempts", "Too many failed attempts. Please wait 15 minutes and try again.")
    user = repo.get_user_by_email(email) if email else None
    ok = auth.verify_password(password, user["passwordHash"]) if user else (auth.burn_time() or False)
    if not user or not ok:
        throttle.fail(key)
        return _error(401, "invalid_credentials", "Invalid email or password.")
    throttle.clear(key)
    token, token_hash, expires = auth.new_session_token()
    repo.create_session(user["_id"], token_hash, expires)
    response = JSONResponse({"user": _public(user)})
    _set_cookie(response, token)
    return response


async def logout(request: Request) -> JSONResponse:
    repo = db.get_repo()
    token = request.cookies.get(COOKIE)
    if repo is not None and token:
        repo.delete_session(auth.hash_token(token))
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, path="/")
    return response


async def me(request: Request) -> JSONResponse:
    if db.get_repo() is None:
        return _unavailable()
    user = current_user(request)
    if not user:
        return JSONResponse({"user": None})  # 200, not 401: a guest visiting is normal and should not log a console error
    return JSONResponse({"user": _public(user)})


# ---------------------------------------------------------------- saved state

class ChatMsg(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: str = Field(pattern="^(user|assistant)$")
    text: str = Field(max_length=2000)
    source: str | None = Field(default=None, max_length=20)
    note: str | None = Field(default=None, max_length=300)
    error: bool | None = None


class StateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile: dict | None = None
    careerId: str | None = Field(default=None, max_length=40)
    progress: dict[str, bool] = Field(default_factory=dict, max_length=500)
    chat: list[ChatMsg] = Field(default_factory=list, max_length=40)


def _clean_state(raw: dict) -> tuple[dict | None, JSONResponse | None]:
    try:
        parsed = StateIn.model_validate(raw)
        profile = None
        if parsed.profile is not None:
            valid = ProfileIn.model_validate(parsed.profile).model_dump()
            sample = parsed.profile.get("sample")
            if isinstance(sample, str) and len(sample) <= 20:
                valid["sample"] = sample
            profile = valid
    except ValidationError as exc:
        details = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
        return None, _error(422, "validation_error", "The saved data is invalid.", details)
    if parsed.careerId is not None and parsed.careerId not in get_catalog().careers:
        return None, _error(422, "unknown_career", f"Unknown careerId '{parsed.careerId}'.")
    if any(len(k) > 80 for k in parsed.progress):
        return None, _error(422, "validation_error", "A progress key is too long.")
    state = {
        "profile": profile,
        "careerId": parsed.careerId,
        "progress": {k: True for k, v in parsed.progress.items() if v},
        "chat": [m.model_dump(exclude_none=True) for m in parsed.chat],
    }
    return state, None


async def get_state(request: Request) -> JSONResponse:
    repo = db.get_repo()
    if repo is None:
        return _unavailable()
    user = current_user(request)
    if not user:
        return _error(401, "not_signed_in", "Sign in to load your saved data.")
    return JSONResponse({"state": repo.get_state(user["_id"])})


async def put_state(request: Request) -> JSONResponse:
    repo = db.get_repo()
    if repo is None:
        return _unavailable()
    user = current_user(request)
    if not user:
        return _error(401, "not_signed_in", "Sign in to save your data.")
    body = await request.body()
    if len(body) > MAX_STATE_BYTES:
        return _error(413, "too_large", "Saved data is too large.")
    payload, err = await _json_body(request)
    if err:
        return err
    state, err = _clean_state(payload)
    if err:
        return err
    repo.save_state(user["_id"], state)
    return JSONResponse({"ok": True})


routes = [
    Route("/api/auth/register", register, methods=["POST"]),
    Route("/api/auth/login", login, methods=["POST"]),
    Route("/api/auth/logout", logout, methods=["POST"]),
    Route("/api/auth/me", me, methods=["GET"]),
    Route("/api/state", get_state, methods=["GET"]),
    Route("/api/state", put_state, methods=["PUT"]),
]
