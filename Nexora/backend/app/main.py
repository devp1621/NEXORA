"""Nexora HTTP API.

Built on Starlette + pydantic (the same foundations FastAPI uses) because FastAPI could not be
installed in the build environment. Endpoint paths and JSON shapes match the original spec.

Run:  uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import accounts, ai, chat, db
from .engine import UnknownCareer, analyze, careers_payload, get_catalog
from .schemas import AnalyzeRequest, ChatRequest

try:  # optional: load backend/.env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover
    pass

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def error(status: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status)


def _validation_details(exc: ValidationError) -> list[dict]:
    details = []
    for e in exc.errors():
        field = ".".join(str(p) for p in e["loc"])
        details.append({"field": field, "message": e["msg"]})
    return details


async def _parse_request(request: Request):
    """Return (AnalyzeRequest, None) or (None, error response)."""
    try:
        payload = await request.json()
    except Exception:
        return None, error(400, "invalid_json", "Request body must be valid JSON.")
    if not isinstance(payload, dict):
        return None, error(400, "invalid_body", "Request body must be a JSON object.")
    try:
        return AnalyzeRequest.model_validate(payload), None
    except ValidationError as exc:
        return None, error(422, "validation_error", "The profile has invalid or missing fields.", _validation_details(exc))


async def health(request: Request) -> JSONResponse:
    catalog = get_catalog()
    return JSONResponse(
        {
            "status": "ok",
            "service": "nexora-api",
            "careersLoaded": len(catalog.careers),
            "aiConfigured": ai.is_configured(),
            "authEnabled": db.get_repo() is not None,
            "database": db.get_repo().kind if db.get_repo() is not None else None,
            "databaseError": db.get_error(),
        }
    )


async def careers(request: Request) -> JSONResponse:
    return JSONResponse(careers_payload())


async def analyze_endpoint(request: Request) -> JSONResponse:
    parsed, err = await _parse_request(request)
    if err:
        return err
    try:
        result = analyze(parsed.profile.model_dump(), parsed.careerId)
    except UnknownCareer:
        valid = ", ".join(get_catalog().careers)
        return error(404, "unknown_career", f"Unknown careerId '{parsed.careerId}'. Valid ids: {valid}.")
    return JSONResponse(result)


async def recommendations_endpoint(request: Request) -> JSONResponse:
    parsed, err = await _parse_request(request)
    if err:
        return err
    profile = parsed.profile.model_dump()
    try:
        analysis = analyze(profile, parsed.careerId)
    except UnknownCareer:
        valid = ", ".join(get_catalog().careers)
        return error(404, "unknown_career", f"Unknown careerId '{parsed.careerId}'. Valid ids: {valid}.")
    return JSONResponse(ai.get_recommendations(analysis, profile))


async def chat_endpoint(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except ValueError:
        return error(400, "invalid_json", "The request body must be valid JSON.")
    try:
        parsed = ChatRequest.model_validate(payload)
    except ValidationError as exc:
        return error(422, "validation_error", "The chat request is invalid.", _validation_details(exc))
    try:
        result = chat.respond(
            parsed.message,
            [t.model_dump() for t in parsed.history],
            parsed.profile.model_dump(),
            parsed.careerId,
        )
    except UnknownCareer:
        valid = ", ".join(get_catalog().careers)
        return error(404, "unknown_career", f"Unknown careerId '{parsed.careerId}'. Valid ids: {valid}.")
    return JSONResponse(result)


async def api_not_found(request: Request) -> JSONResponse:
    return error(404, "not_found", f"No API route at {request.url.path}.")


routes = [
    *accounts.routes,
    Route("/api/health", health, methods=["GET"]),
    Route("/api/careers", careers, methods=["GET"]),
    Route("/api/analyze", analyze_endpoint, methods=["POST"]),
    Route("/api/recommendations", recommendations_endpoint, methods=["POST"]),
    Route("/api/chat", chat_endpoint, methods=["POST"]),
    Route("/api/{path:path}", api_not_found, methods=["GET", "POST", "PUT", "DELETE"]),
]
class NoCacheStaticFiles(StaticFiles):
    """Serve the frontend with caching disabled so a rebuilt site always replaces an old one in the browser."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response


if FRONTEND_DIST.is_dir():
    routes.append(Mount("/", app=NoCacheStaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend"))

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",") if o.strip()]
@asynccontextmanager
async def lifespan(_app):
    db.init_from_env()  # connects to MongoDB if MONGODB_URI is set; otherwise accounts stay disabled
    yield


app = Starlette(
    lifespan=lifespan,
    routes=routes,
    middleware=[Middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PUT"], allow_headers=["content-type"], allow_credentials=True)],
)
