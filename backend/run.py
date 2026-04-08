import os
import sys

import uvicorn


def main() -> None:
    # Ensure `backend/app` is imported as `app` (this repo also has a top-level `app/` dir).
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    # Import the ASGI app object here so it uses this process' sys.path.
    # (Otherwise uvicorn may re-import using a different sys.path and pick the
    # wrong top-level `app` package from the repo.)
    from app.main import app as fastapi_app

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=port,
        reload=os.getenv("RELOAD", "false").lower() == "true",
    )


if __name__ == "__main__":
    main()
