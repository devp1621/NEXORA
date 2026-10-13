"""Start Nexora. Works from any folder:   python start.py   (or double-click start.bat on Windows)

It finds the backend folder itself, checks that the needed packages really import, installs them if not,
starts the server and opens the browser. Every failure prints a plain message with the fix.
"""
import os
import socket
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE / "backend"
PACKAGES = [("starlette", "starlette"), ("pydantic", "pydantic"), ("uvicorn", "uvicorn")]


def can_import(mod: str):
    try:
        __import__(mod)
        return None
    except Exception as exc:  # noqa: BLE001 - a half-installed package raises more than ImportError
        return f"{type(exc).__name__}: {exc}"


def pip(*args: str) -> bool:
    return subprocess.call([sys.executable, "-m", "pip", *args]) == 0


def wants_mongo() -> bool:
    if os.getenv("MONGODB_URI", "").strip():
        return True
    env = BACKEND / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.strip().startswith("MONGODB_URI=") and line.split("=", 1)[1].strip():
                return True
    return False


def free_port(start: int = 8000) -> int:
    for port in range(start, start + 20):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


def run() -> int:
    print(f"Python {sys.version.split()[0]} at {sys.executable}")
    if sys.version_info < (3, 9):
        print("Nexora needs Python 3.9 or newer. Install a newer Python from python.org and try again.")
        return 1
    if not (BACKEND / "app" / "main.py").exists():
        print(f"Cannot find backend/app/main.py next to start.py ({HERE}).")
        print("Unzip the WHOLE project and keep start.py inside it.")
        return 1
    if not (HERE / "frontend" / "dist" / "index.html").exists():
        print("frontend/dist is missing, so there are no pages to show. Extract the zip again.")
        return 1

    for mod, pkg in PACKAGES:
        err = can_import(mod)
        if err:
            print(f"{pkg} is not usable ({err}). Installing/upgrading it ...")
            if not pip("install", "--upgrade", pkg):
                print(f"\nCould not install {pkg}. Run this yourself and read the message:")
                print(f"    {sys.executable} -m pip install --upgrade {pkg}")
                return 1
            err = can_import(mod)
            if err:
                print(f"{pkg} still fails to load: {err}")
                print("Close this window, open a new one and run start.bat again.")
                return 1
    if wants_mongo() and can_import("pymongo") and not pip("install", "pymongo"):
        print("pymongo is needed for MongoDB. Remove MONGODB_URI from backend/.env to use built-in storage instead.")
        return 1

    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))
    try:
        import app.main  # noqa: F401  (surface import errors here, with a readable message)
    except Exception:
        print("\nThe Nexora backend failed to load:\n")
        traceback.print_exc()
        return 1

    port = free_port()
    url = f"http://localhost:{port}"
    if port != 8000:
        print("NOTE: port 8000 is already in use (probably an OLD Nexora still running).")
        print("      Close that old window, or you may see the old site on port 8000.\n")
    print(f"\nNexora is starting at {url}   (press Ctrl+C to stop)\n")
    threading.Thread(target=lambda: (time.sleep(2), webbrowser.open(url)), daemon=True).start()
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=port)
    return 0


def main() -> int:
    try:
        return run()
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    except Exception:
        print("\nUnexpected error while starting Nexora:\n")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
