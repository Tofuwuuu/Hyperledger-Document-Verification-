# This file makes the utils directory a proper Python package
# It can be empty, but we'll re-export some common utilities for convenience

from .utils import (
    generate_url_slug,
    format_datetime,
    truncate_string,
    safe_get
) 