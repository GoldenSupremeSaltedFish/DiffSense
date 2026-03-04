# Core version for cache invalidation
# Increment this whenever the parser logic, AST detection logic, or data structures change.
CACHE_VERSION = "v2.2.0-rev1"

import os


def get_cache_max_age_seconds() -> int:
    """Return cache TTL in seconds; 0 means no expiry. From env DIFFSENSE_CACHE_MAX_AGE_DAYS."""
    try:
        days = os.environ.get("DIFFSENSE_CACHE_MAX_AGE_DAYS", "")
        if not days:
            return 0
        return max(0, int(float(days) * 86400))
    except (ValueError, TypeError):
        return 0
