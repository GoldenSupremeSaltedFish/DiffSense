import javalang
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.change import ChangeKind

detector = ASTDetector()
filename = "Test.java"
removed_lines = ["String encodedName = agentIdCodecHolder.encode(agentName);"]

print("Analyzing snippet:", removed_lines)

# Simulate _analyze_snippet_for_changes
changes = []
removed_vars = {}
removed_calls = set()
removed_modifiers = set()

detector._analyze_snippet_for_changes(
    removed_lines, 
    filename, 
    is_added=False, 
    var_map=removed_vars, 
    call_set=removed_calls, 
    mod_set=removed_modifiers, 
    changes=changes
)

print("\nDetected Changes:")
for ch in changes:
    print(f"- {ch.kind.name}: {ch.symbol} (Meta: {ch.meta})")

# Check if 'encode' was detected as CALL_REMOVED
found = any(ch.symbol == "encode" and ch.kind == ChangeKind.CALL_REMOVED for ch in changes)
print(f"\nFound 'encode' removal? {found}")
