import os
import sys
from pathlib import Path

# A throwaway signing key for tests only. The app refuses to start without one.
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-0123456789-abcdefghij")
os.environ.setdefault("PASSWORD_RESET_ENABLED", "false")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.utils.rate_limit import reset_rate_limits  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_rate_limits()
    yield
    reset_rate_limits()
