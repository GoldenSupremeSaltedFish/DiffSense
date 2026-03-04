"""
Example DiffSense rule plugin. get_rules() returns a path to a directory of YAML rules.
DiffSense will load them with the same semantics as --rules <dir>.
"""
import os

def get_rules():
    return os.path.join(os.path.dirname(__file__), "rules")
