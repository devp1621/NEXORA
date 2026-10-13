# Nexora

*Your Potential, Your Next Frontier*
IEEE Day Hackathon 2026 · Problem Statement 2: Smart Student Career Profile.

Flow: **Profile → Analyze → Identify gaps → Recommend → Roadmap.**

## Pages and flow
1. **Welcome page** (`#/`): the starting page everyone sees first. It explains Nexora, shows a live sample preview, the features, how it works, the careers, and what to know, with **Sign in**, **Create account** and **Continue as guest**.
2. **Sign in / Sign up** (`#/login`), optional.
3. **The app**: Home, Profile, Careers, Dashboard, Skill gaps, Roadmap, About (with the sidebar and chat assistant). Guests land on Home; signed-in users go to their dashboard (or profile if they have none yet).

## Run it
Requirements: Python 3.11+, Node 18+.

```bash
# 1. Backend (also serves the built frontend)
cd backend
pip install -r requirements.txt
cp .env.example .env            # optional; only needed for AI recommendations
python3 -m uvicorn app.main:app --port 8000

# 2. Frontend (only needed after editing src/)
cd frontend
npm install
npm run build                   # esbuild -> frontend/dist
```
Open http://localhost:8000. Click **Try Demo Profile** (Aarav Mehta or Priya Nair, fictional sample data).

Tests: `cd backend && python3 -m unittest discover -s tests -t .` (75 tests).

## Stack notes
React 19 bundled with esbuild, plain CSS, no Tailwind/Recharts/Lucide (inline SVG icons and charts). The backend is **Starlette + Pydantic** (the foundation of FastAPI, same endpoints and JSON), because FastAPI could not be installed in the build sandbox. Swapping to FastAPI is a small change in `app/main.py`.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status, careers loaded, whether AI is configured |
| GET | `/api/careers` | the 3 career datasets |
| POST | `/api/analyze` | `{careerId, profile}` → coverage, matched / inProgress / missing, strengths, priorityGaps, roadmap, recommendations, analysisNotes |
| POST | `/api/recommendations` | same input; AI-enhanced if a key is set, otherwise deterministic fallback, labelled honestly |

| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Accounts (503 when no database is configured) |
| GET | `/api/auth/me` | The signed-in user |
| GET / PUT | `/api/state` | Load / save the signed-in user's profile, career, roadmap progress and chat |
| POST | `/api/chat` | `{careerId, profile, message, history?}` → `{reply, source, suggestions, fallbackReason}`. The server recomputes the analysis for every message, so answers use the real calculated numbers. |

Errors are JSON: `{"error": {"code", "message", "details"}}`.

## Database and accounts (MongoDB)
Sign-in is optional. Without a database, Nexora runs in **guest mode** and saves to the browser only. With MongoDB configured, a student can create an account and their profile, chosen career, roadmap ticks and chat history are saved to MongoDB and follow them to any device.

1. Install MongoDB Community Server and start it (or create a free MongoDB Atlas cluster and copy its connection string).
2. `pip install -r requirements.txt` (adds `pymongo`).
3. In `backend/.env` set `MONGODB_URI=mongodb://localhost:27017` (and optionally `MONGODB_DB`).
4. Restart the server. `/api/health` shows `"authEnabled": true, "database": "mongodb"`, and the sidebar shows **Sign in / Sign up**. If the database can't be reached, `databaseError` explains why and the site keeps working in guest mode.

Collections (indexes are created automatically): `users` (unique email, scrypt password hash), `sessions` (only a SHA-256 of the session token is stored; expired sessions are removed by a TTL index) and `states` (one document per user). The login cookie is HttpOnly, SameSite=Lax, valid for 7 days. Repeated failed logins are throttled. Logging out wipes the browser's local copy so the next person on a shared computer sees nothing.

**Tested vs not tested:** the account logic is covered by automated tests against an in-memory stand-in, and the MongoDB code is exercised through a fake client. It has **not** been run against a real MongoDB server, because none was available where this was built. Please run through sign up, sign in, saving and logout once on your machine.

## Chat assistant
A docked side panel (open it with **Ask assistant**). It answers questions about your own analysis: score, gaps, what to learn first, a specific skill, the roadmap, how the score is calculated, and a comparison across the careers. Each reply is labelled **Rule-based, not AI** or **AI-generated**. Without `ANTHROPIC_API_KEY` it uses deterministic rules over the calculated analysis; with a key it asks the model, giving it only the calculated facts, and falls back to the rules (with the reason) on timeout, rate limit, bad key or an unusable reply. It only knows what is in the analysis, so it can't answer general career questions.

## Scoring
**Career Skill Coverage (%) = required skills matched / total required skills × 100.**
- A skill is *matched* if listed at intermediate or advanced level (default is intermediate). Beginner = *in progress*, not counted. Absent = *missing*.
- Names are normalized (case, spacing, punctuation, aliases such as `reactjs` → React, light spelling correction, flagged in notes).
- *Proficiency depth* (beginner 1/3, intermediate 2/3, advanced 1, averaged) is shown **separately**; it never changes coverage.
- Too little data → an explanation of what is missing instead of a score.
- It is not a hiring or employability prediction.

## AI setup
Set `ANTHROPIC_API_KEY` in `backend/.env` (backend only; never sent to the browser). Responses are validated, hallucinated skills dropped, and timeouts, rate limits and malformed output fall back to rule-based recommendations with the reason. Core analysis never depends on AI. **AI has not been tested against the live API in this build** (no key or network available); that path is covered by mocked tests only.

## Known limitations
- Career datasets are illustrative and editable (`backend/app/data/`), not industry standards.
- Skills are self-reported; project technologies are evidence only.
- Nine illustrative careers (Full Stack, Frontend, Backend, Data Scientist, Data Analyst, Cybersecurity, DevOps, Mobile, QA). Without MongoDB configured, data lives in browser localStorage only (guest mode).
- No email verification or password reset yet; accounts are a simple email + password.
- Effort figures are rough estimates.

## Accounts without MongoDB (default)

If `MONGODB_URI` is empty, Nexora stores accounts and saved progress in a local SQLite file
(`backend/nexora_local.db`), so sign up / sign in work with no setup. Set `MONGODB_URI` to use MongoDB
instead. Set `NEXORA_LOCAL_DB=off` to turn accounts off (guest mode). The local file is for a single
machine; use MongoDB if you want the data on a shared server. Add `nexora_local.db` to `.gitignore`.

## Easiest way to run

Unzip the whole project, then **double-click `start.bat`** (Windows) or run `python start.py` from any folder.
It finds the right folder, installs missing packages, starts the server and opens http://localhost:8000.

## Report and print

The dashboard has **Download report** (a Markdown file built from the calculated analysis, nothing added) and **Print / save as PDF** (print styles hide the navigation and chat).

## App layout

Grouped left sidebar (Start, Analyze, Grow, More), a top bar with breadcrumb, **search palette (Ctrl/Cmd + K)** for pages and careers, and an assistant button. The dashboard opens with a greeting, a summary banner and four stat tiles. Sign in / sign up use a split layout with an illustrated panel.

## UI theme: clay + liquid glass
The interface is styled as soft clay objects (cards, buttons, fields, bars) under liquid-glass chrome (sidebar, top bar, chat, search). Styles live in `frontend/src/theme.css` (tokens, clay and glass primitives), `app.css` (pages) and `welcome.css` (welcome page, 3D hero, intro). The 5.9 second intro and the 3D hero are in `frontend/src/scene.jsx`; the intro plays once per page load and can be skipped. Motion is disabled for users who prefer reduced motion. Rebuild with `npm run build`.
