"""DiffSense machine-readable contract constants.

Advertised to consumers via docs/cli-contract.md; bump SCHEMA_VERSION on any
pre-1.0 breaking change to the JSON report shape.
"""

# JSON report schema version. Consumers MUST validate this field first.
SCHEMA_VERSION = "1.0"

# Fixed exit codes for audit/flows surfaced to agents (see docs/cli-contract.md).
EXIT_OK = 0      # pass: no blocked findings, or human acknowledged the risk
EXIT_RISK = 1    # risk: findings exist and review_level reached the blocking threshold
EXIT_ERROR = 2   # tool error: bad arguments, unreachable repo, internal failure


def exit_code_for_review_level(review_level: str) -> int:
    """Map a composed review_level to the fixed audit exit code.

    Only the blocking threshold (critical) yields EXIT_RISK; everything else
    resolves as pass so the contract stays 0/1/2 and never invents extra codes.
    """
    if str(review_level).lower() == "critical":
        return EXIT_RISK
    return EXIT_OK