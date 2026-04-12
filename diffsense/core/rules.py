import os
import yaml
import fnmatch
import time
from typing import Dict, List, Any, Optional, Tuple

def _version_segments(v: str) -> Tuple[int, ...]:
    """将版本字符串转为可比较的整数元组，便于区间判断。"""
    v = (v or "").strip()
    if not v:
        return (0,)
    parts = []
    for s in v.replace("-", ".").split("."):
        s = "".join(c for c in s if c.isdigit())
        parts.append(int(s) if s else 0)
    return tuple(parts) if parts else (0,)

def _version_in_cve_range(current: str, introduced: List[str], fixed: List[str]) -> bool:
    """
    判断当前版本是否在 CVE 受影响区间内。
    约定：introduced = 首个受影响版本（>= 即可能受影响），fixed = 首个修复版本（< fixed 即受影响）。
    受影响区间为 [min(introduced), min(fixed))；若无 fixed 则仅要求 current >= any introduced。
    """
    if not introduced and not fixed:
        return True
    cur = _version_segments(current)
    intro_vers = [_version_segments(x) for x in (introduced or []) if x]
    fix_vers = [_version_segments(x) for x in (fixed or []) if x]
    if intro_vers and cur < min(intro_vers):
        return False
    if fix_vers and cur >= min(fix_vers):
        return False
    return True
from core.rule_base import Rule
from core.quality_manager import RuleQualityManager
from core.parser_manager import ParserManager

try:
    from importlib.metadata import entry_points
except ImportError:
    entry_points = None  # type: ignore
from core.ignore_manager import IgnoreManager
try:
    from ..governance.lifecycle import LifecycleManager
except ImportError:
    from governance.lifecycle import LifecycleManager
from rules.concurrency import (
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule
)
from rules.yaml_adapter import YamlRule

# 导入新增的规则模块（向后兼容：如果模块不存在不会报错）
try:
    from rules.resource_management import (
        CloseableResourceLeakRule,
        DatabaseConnectionLeakRule,
        StreamWrapperRule,
        IOStreamChainingRule,
        ExecutorServiceShutdownRule,
    )
    RESOURCE_RULES_AVAILABLE = True
except ImportError:
    RESOURCE_RULES_AVAILABLE = False

try:
    from rules.exception_handling import (
        SwallowedExceptionRule,
        GenericExceptionRule,
        ThrowRuntimeExceptionRule,
        ThrowsClauseRemovedRule,
        FinallyBlockMissingRule,
        ExceptionLoggingRule,
    )
    EXCEPTION_RULES_AVAILABLE = True
except ImportError:
    EXCEPTION_RULES_AVAILABLE = False

try:
    from rules.null_safety import (
        NullReturnIgnoredRule,
        OptionalUnwrapRule,
        AutoboxingNPERule,
        ChainedMethodCallNPERule,
        ArrayIndexOutOfBoundsRule,
        StringConcatNPERule,
    )
    NULL_SAFETY_RULES_AVAILABLE = True
except ImportError:
    NULL_SAFETY_RULES_AVAILABLE = False

try:
    from rules.collection_handling import (
        RawTypeUsageRule,
        UnmodifiableCollectionRule,
        ConcurrentModificationRule,
        MapComputeRule,
        StreamCollectorRule,
        ImmutableCollectionRule,
        ListResizeRule,
    )
    COLLECTION_RULES_AVAILABLE = True
except ImportError:
    COLLECTION_RULES_AVAILABLE = False

try:
    from rules.api_compatibility import (
        PublicMethodRemovedRule,
        MethodSignatureChangedRule,
        FieldRemovedRule,
        ConstructorRemovedRule,
        InterfaceChangedRule,
        AnnotationRemovedRule,
        DeprecatedApiAddedRule,
        SerialVersionUIDChangedRule,
    )
    API_RULES_AVAILABLE = True
except ImportError:
    API_RULES_AVAILABLE = False

try:
    from rules.go_rules import (
        GoGoroutineLeakRule,
        GoChannelLeakRule,
        GoDeferMisuseRule,
        GoUnsafeUsageRule,
        GoErrorHandlingRule,
        GoNilPointerRule,
        GoRaceConditionRule,
        GoHTTPSecurityRule,
    )
    GO_RULES_AVAILABLE = True
except ImportError:
    GO_RULES_AVAILABLE = False

# Python rules
try:
    from rules.python_rules import (
        PythonHardcodedSecretRule,
        PythonCommandInjectionRule,
        PythonEvalUsageRule,
        PythonSQLInjectionRule,
        PythonResourceLeakRule,
        PythonThreadSafetyRule,
        PythonSwallowedExceptionRule,
        PythonBroadExceptionRule,
        PythonNoneCheckRule,
        PythonTypeSafetyRule,
        PythonLoopInEfficientRule,
        PythonInMemoryLargeDataRule,
        PythonSensitiveImportRule,
        PythonWeakCryptographyRule,
        PythonDebugCodeRule,
        PythonMutableDefaultArgRule,
        PythonPathTraversalRule,
    )
    PYTHON_RULES_AVAILABLE = True
except ImportError:
    PYTHON_RULES_AVAILABLE = False

# C++ rules
try:
    from rules.cpp_rules import (
        CppMemoryLeakRule,
        CppRawPointerRule,
        CppBufferOverflowRule,
        CppHardcodedSecretRule,
        CppCommandInjectionRule,
        CppSQLInjectionRule,
        CppUnsafeCastRule,
        CppThreadSafetyRule,
        CppDataRaceRule,
        CppResourceLeakRule,
        CppSwallowedExceptionRule,
        CppNoexceptRule,
        CppNullPointerRule,
        CppInefficientCopyRule,
        CppUnboundedVectorRule,
        CppMagicNumberRule,
        CppIntegerOverflowRule,
        CppUninitializedRule,
    )
    CPP_RULES_AVAILABLE = True
except ImportError:
    CPP_RULES_AVAILABLE = False

# JavaScript rules
try:
    from rules.js_rules import (
        JSHardcodedSecretRule,
        JSEvalUsageRule,
        JSXSSRule,
        JSPrototypePollutionRule,
        JSCommandInjectionRule,
        JSOpenRedirectRule,
        JSConsoleLogRule,
        JSDebuggerRule,
        JSPromiseRejectRule,
        JSTypeNarrowingRule,
        JSDynamicImportRule,
        JSLocalStorageSecretRule,
        JSReDoSRule,
        JSDeprecatedAPIRule,
    )
    JAVASCRIPT_RULES_AVAILABLE = True
except ImportError:
    JAVASCRIPT_RULES_AVAILABLE = False

# Cross-language rules (Python, JavaScript, C++)
try:
    from rules.cross_language_adapter import (
        CrossLanguageRuleFactory,
    )
    CROSS_LANGUAGE_RULES_AVAILABLE = True
except ImportError:
    CROSS_LANGUAGE_RULES_AVAILABLE = False

class RuleEngine:
    def __init__(self, rules_path: Optional[str] = None, profile: Optional[str] = None, config: Optional[Dict[str, Any]] = None, pro_rules_path: Optional[str] = None):
        self.rules: List[Rule] = []
        self.metrics: Dict[str, Dict[str, Any]] = {}  # id -> {calls, hits, time_ns, errors}
        self.ignore_manager = IgnoreManager()
        self.profile = profile
        self.config = config or {}
        self.lifecycle = LifecycleManager(self.config)
        self.quality_manager = self._init_quality_manager()
        exp_cfg = self.config.get("experimental", {})
        self.experimental_enabled = bool(exp_cfg.get("enabled", False))
        self.experimental_report_only = bool(exp_cfg.get("report_only", True))

        # 1. Register Built-in Rules (Plugins)
        self._register_builtins()

        # 2. Load YAML Rules (Plugins)
        self._load_yaml_rules(rules_path)

        # 3. Load PRO rules if path is provided (skip java/go/python/cve subdirs with single-rule schema)
        # Support tier-based loading for Java CVE rules
        if pro_rules_path and os.path.exists(pro_rules_path):
            self._load_pro_rules_with_tiers(pro_rules_path)

        # 4. Load rules from pip-installed packages (entry point group: diffsense.rules)
        self._load_entry_point_rules()
        self._load_rulesets_from_config()

        # 5. Apply profile filter (lightweight = only critical; standard = critical+high; strict = all)
        self._apply_profile_filter(profile)

    def _register_builtins(self):
        """
        Registers core rules that are implemented as Python classes.
        Backward compatible: old rules always available, new rules loaded if present.
        """
        # Original 4 concurrency rules (always available)
        self.rules.append(ThreadPoolSemanticChangeRule())
        self.rules.append(ConcurrencyRegressionRule())
        self.rules.append(ThreadSafetyRemovalRule())
        self.rules.append(LatchMisuseRule())
        
        # New built-in rules (loaded if available - backward compatible)
        if RESOURCE_RULES_AVAILABLE:
            self.rules.append(CloseableResourceLeakRule())
            self.rules.append(DatabaseConnectionLeakRule())
            self.rules.append(StreamWrapperRule())
            self.rules.append(IOStreamChainingRule())
            self.rules.append(ExecutorServiceShutdownRule())
        
        if EXCEPTION_RULES_AVAILABLE:
            self.rules.append(SwallowedExceptionRule())
            self.rules.append(GenericExceptionRule())
            self.rules.append(ThrowRuntimeExceptionRule())
            self.rules.append(ThrowsClauseRemovedRule())
            self.rules.append(FinallyBlockMissingRule())
            self.rules.append(ExceptionLoggingRule())
        
        if NULL_SAFETY_RULES_AVAILABLE:
            self.rules.append(NullReturnIgnoredRule())
            self.rules.append(OptionalUnwrapRule())
            self.rules.append(AutoboxingNPERule())
            self.rules.append(ChainedMethodCallNPERule())
            self.rules.append(ArrayIndexOutOfBoundsRule())
            self.rules.append(StringConcatNPERule())
        
        if COLLECTION_RULES_AVAILABLE:
            self.rules.append(RawTypeUsageRule())
            self.rules.append(UnmodifiableCollectionRule())
            self.rules.append(ConcurrentModificationRule())
            self.rules.append(MapComputeRule())
            self.rules.append(StreamCollectorRule())
            self.rules.append(ImmutableCollectionRule())
            self.rules.append(ListResizeRule())
        
        if API_RULES_AVAILABLE:
            self.rules.append(PublicMethodRemovedRule())
            self.rules.append(MethodSignatureChangedRule())
            self.rules.append(FieldRemovedRule())
            self.rules.append(ConstructorRemovedRule())
            self.rules.append(InterfaceChangedRule())
            self.rules.append(AnnotationRemovedRule())
            self.rules.append(DeprecatedApiAddedRule())
            self.rules.append(SerialVersionUIDChangedRule())
        
        if GO_RULES_AVAILABLE:
            self.rules.append(GoGoroutineLeakRule())
            self.rules.append(GoChannelLeakRule())
            self.rules.append(GoDeferMisuseRule())
            self.rules.append(GoUnsafeUsageRule())
            self.rules.append(GoErrorHandlingRule())
            self.rules.append(GoNilPointerRule())
            self.rules.append(GoRaceConditionRule())
            self.rules.append(GoHTTPSecurityRule())

        # Python rules
        if PYTHON_RULES_AVAILABLE:
            self.rules.append(PythonHardcodedSecretRule())
            self.rules.append(PythonCommandInjectionRule())
            self.rules.append(PythonEvalUsageRule())
            self.rules.append(PythonSQLInjectionRule())
            self.rules.append(PythonResourceLeakRule())
            self.rules.append(PythonThreadSafetyRule())
            self.rules.append(PythonSwallowedExceptionRule())
            self.rules.append(PythonBroadExceptionRule())
            self.rules.append(PythonNoneCheckRule())
            self.rules.append(PythonTypeSafetyRule())
            self.rules.append(PythonLoopInEfficientRule())
            self.rules.append(PythonInMemoryLargeDataRule())
            self.rules.append(PythonSensitiveImportRule())
            self.rules.append(PythonWeakCryptographyRule())
            self.rules.append(PythonDebugCodeRule())
            self.rules.append(PythonMutableDefaultArgRule())
            self.rules.append(PythonPathTraversalRule())

        # C++ rules
        if CPP_RULES_AVAILABLE:
            self.rules.append(CppMemoryLeakRule())
            self.rules.append(CppRawPointerRule())
            self.rules.append(CppBufferOverflowRule())
            self.rules.append(CppHardcodedSecretRule())
            self.rules.append(CppCommandInjectionRule())
            self.rules.append(CppSQLInjectionRule())
            self.rules.append(CppUnsafeCastRule())
            self.rules.append(CppThreadSafetyRule())
            self.rules.append(CppDataRaceRule())
            self.rules.append(CppResourceLeakRule())
            self.rules.append(CppSwallowedExceptionRule())
            self.rules.append(CppNoexceptRule())
            self.rules.append(CppNullPointerRule())
            self.rules.append(CppInefficientCopyRule())
            self.rules.append(CppUnboundedVectorRule())
            self.rules.append(CppMagicNumberRule())
            self.rules.append(CppIntegerOverflowRule())
            self.rules.append(CppUninitializedRule())

        # JavaScript rules
        if JAVASCRIPT_RULES_AVAILABLE:
            self.rules.append(JSHardcodedSecretRule())
            self.rules.append(JSEvalUsageRule())
            self.rules.append(JSXSSRule())
            self.rules.append(JSPrototypePollutionRule())
            self.rules.append(JSCommandInjectionRule())
            self.rules.append(JSOpenRedirectRule())
            self.rules.append(JSConsoleLogRule())
            self.rules.append(JSDebuggerRule())
            self.rules.append(JSPromiseRejectRule())
            self.rules.append(JSTypeNarrowingRule())
            self.rules.append(JSDynamicImportRule())
            self.rules.append(JSLocalStorageSecretRule())
            self.rules.append(JSReDoSRule())
            self.rules.append(JSDeprecatedAPIRule())

        # Cross-language rules (Python, JavaScript, C++)
        if CROSS_LANGUAGE_RULES_AVAILABLE:
            for language in ['python', 'javascript', 'cpp', 'c']:
                rules = CrossLanguageRuleFactory.create_all_rules_for_language(language)
                for rule in rules:
                    self.rules.append(rule)

    def _load_yaml_rules(self, path: Optional[str], skip_single_rule_subdirs: bool = False):
        """
        Loads YAML rules from a single file or a directory of .yaml files.
        If path is a directory, loads all .yaml files in that directory recursively.
        Each file must have top-level 'rules: [...]'. Load order is deterministic (sorted by name).
        When skip_single_rule_subdirs is True (e.g. for pro-rules), skips subdirs java/go/python (bulk single-rule);
        subdir cve/ is still walked so cve/java and cve/JavaScript single-rule YAMLs can be loaded and recognized by language.
        """
        if not path or not os.path.exists(path):
            return
            
        if os.path.isdir(path):
            # 仅在 pro-rules 根目录跳过 java/go/python（大批量单文件）；不跳过 cve/java、cve/JavaScript
            skip_dirs = {'java', 'go', 'python'} if skip_single_rule_subdirs else set()
            for root, dirs, files in os.walk(path):
                if skip_dirs and os.path.normpath(root) == os.path.normpath(path):
                    dirs[:] = [d for d in dirs if d not in skip_dirs]
                for name in sorted(f for f in files if f.endswith('.yaml')):
                    file_path = os.path.join(root, name)
                    self._load_yaml_file(file_path)
        else:
            self._load_yaml_file(path)

    def _single_rule_to_engine_format(self, data: dict) -> Optional[dict]:
        """将按语言单条规则 schema (id, language, severity, description, category, ...) 转为引擎 YamlRule 所需格式.
        支持 id / rule_name（如 pro-rules/cve/java、cve/Go 单文件）."""
        if not data:
            return None
        rule_id = data.get('id') or data.get('rule_name')
        if not rule_id:
            return None
        out = {
            'id': str(rule_id),
            'language': data.get('language', '*'),
            'severity': (data.get('severity') or 'high').lower(),
            'rationale': data.get('rationale') or data.get('description') or '',
            'file': data.get('file', '**'),
            'action': data.get('action', 'report'),
            'signal': data.get('signal') or 'security.vulnerability',
            'impact': data.get('impact') or data.get('category') or 'security',
        }
        if data.get('package') is not None:
            out['package'] = data['package']
        if data.get('versions') is not None:
            out['versions'] = data['versions']
        return out

    def _load_yaml_file(self, path: str):
        """Loads a single YAML file: either top-level 'rules: [...]' or single-rule schema (id, language, severity, ...) for cve/java etc.
        也支持「单 key 即 rule id」格式（如 pro-rules/cve/Go/*.yaml：prorule.go_2021_0265_go: { description, language, ... }）."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}

            # Extract and merge global config from YAML (e.g., skip_paths)
            yaml_config = data.get('config', {})
            if yaml_config:
                for key, value in yaml_config.items():
                    if key not in self.config:
                        self.config[key] = value

            raw_rules = data.get('rules', [])
            if isinstance(raw_rules, list) and raw_rules:
                for r in raw_rules:
                    self.rules.append(YamlRule(r))
                return
            # 单 key 即 rule id 的格式（如 cve/Go/*.yaml）
            if isinstance(data, dict) and len(data) == 1:
                key = next(iter(data))
                val = data[key]
                if isinstance(val, dict) and (key.startswith('prorule.') or 'language' in val or 'description' in val):
                    data = dict(val)
                    data['id'] = key
            # 单条规则 schema（如 pro-rules/cve/java/*.yaml）
            one = self._single_rule_to_engine_format(data)
            if one:
                self.rules.append(YamlRule(one))
        except FileNotFoundError:
            pass
        except yaml.YAMLError:
            pass

    def _load_entry_point_rules(self):
        """
        Discovers and loads rules from packages that register under entry point group 'diffsense.rules'.
        Each entry point must be a callable returning either List[Rule] or a str path (file or directory).
        Failures in a single plugin are caught so one bad package does not break the engine.
        """
        if entry_points is None:
            return
        try:
            eps = entry_points(group="diffsense.rules")
        except TypeError:
            # Python < 3.10: entry_points() takes no keyword argument
            eps = entry_points().get("diffsense.rules", [])
        for ep in eps:
            try:
                fn = ep.load()
                result = fn()
                if isinstance(result, list):
                    for r in result:
                        if isinstance(r, Rule) and getattr(r, 'enabled', True):
                            self.rules.append(r)
                elif isinstance(result, str) and result:
                    self._load_yaml_rules(result)
            except Exception:
                pass  # skip broken plugin

    def _init_quality_manager(self) -> RuleQualityManager:
        cfg = self.config.get("rule_quality", {})
        path = os.environ.get("DIFFSENSE_RULE_METRICS") or os.path.join(os.getcwd(), "rule_metrics.json")
        auto_tune = cfg.get("auto_tune", False)
        degrade = cfg.get("degrade_threshold", 0.5)
        disable = cfg.get("disable_threshold", 0.3)
        min_samples = cfg.get("min_samples", 30)
        try:
            degrade = float(degrade)
        except Exception:
            degrade = 0.5
        try:
            disable = float(disable)
        except Exception:
            disable = 0.3
        try:
            min_samples = int(min_samples)
        except Exception:
            min_samples = 30
        auto_tune = bool(auto_tune)
        return RuleQualityManager(path, auto_tune, degrade, disable, min_samples)

    def _load_rulesets_from_config(self) -> None:
        rulesets = []
        cfg_sets = self.config.get("rulesets")
        if isinstance(cfg_sets, list):
            rulesets.extend([s for s in cfg_sets if isinstance(s, str)])
        env_sets = os.environ.get("DIFFSENSE_RULESETS")
        if env_sets:
            for s in env_sets.split(","):
                s = s.strip()
                if s:
                    rulesets.append(s)
        for path in rulesets:
            if os.path.exists(path):
                self._load_yaml_rules(path)

    def _load_pro_rules_with_tiers(self, pro_rules_path: str):
        """
        Load PRO rules with tier-based filtering for Java CVE rules.
        Supports profile-based tier selection:
        - lightweight: Load only tier1_critical
        - standard: Load tier1_critical + tier2_high
        - strict: Load all tiers
        
        For other pro-rules (non-tiered), loads normally.
        """
        if not os.path.exists(pro_rules_path):
            return
        
        # Check if this is the java CVE directory with tier subdirs
        java_tier_base = os.path.join(pro_rules_path, "cve", "java")
        if os.path.isdir(java_tier_base):
            # Load tier directories based on profile
            tiers_to_load = self._get_tiers_for_profile()
            for tier_dir in tiers_to_load:
                tier_path = os.path.join(java_tier_base, tier_dir)
                if os.path.isdir(tier_path):
                    # Load tier rules, skip further subdirs
                    self._load_yaml_rules(tier_path, skip_single_rule_subdirs=False)
            
            # Load non-tiered files in java root (if any)
            for f in sorted(os.listdir(java_tier_base)):
                if f.endswith('.yaml') and not f.startswith('tier'):
                    self._load_yaml_file(os.path.join(java_tier_base, f))
        else:
            # Not a tiered directory, load normally
            self._load_yaml_rules(pro_rules_path, skip_single_rule_subdirs=True)

    def _get_tiers_for_profile(self) -> List[str]:
        """
        Get list of tier directories to load based on profile.
        Returns tier directory names.
        """
        if self.profile == "lightweight":
            return ["tier1_critical"]
        elif self.profile == "standard":
            return ["tier1_critical", "tier2_high"]
        else:  # strict or None
            return ["tier1_critical", "tier2_high", "tier3_medium", "tier4_low"]

    def _apply_profile_filter(self, profile: Optional[str]):
        """
        Apply profile-based filtering to loaded rules.
        - lightweight: Only severity=critical
        - standard: severity in (critical, high)
        - strict: All rules
        """
        if not profile or profile == "strict":
            # No filtering, keep all rules
            return
        
        filtered_rules = []
        for rule in self.rules:
            if not getattr(rule, 'enabled', True):
                continue
            
            severity = getattr(rule, 'severity', '').lower()
            
            if profile == "lightweight":
                # Only critical rules
                if severity == "critical":
                    filtered_rules.append(rule)
            elif profile == "standard":
                # Critical + high rules
                if severity in ("critical", "high"):
                    filtered_rules.append(rule)
            else:
                # Unknown profile, keep the rule
                filtered_rules.append(rule)
        
        self.rules = filtered_rules

    def persist_rule_quality(self) -> None:
        self._update_quality_report()
        self.quality_manager.persist()

    def get_rule_quality_metrics(self) -> Dict[str, Any]:
        return self.quality_manager.get_metrics()

    def get_quality_warnings(self) -> List[Dict[str, Any]]:
        return self.quality_manager.warnings()

    def get_rule_stats(self, limit: int = 10) -> Dict[str, Any]:
        metrics = self.metrics
        quality = self.get_rule_quality_metrics()
        rows = []
        for rule_id, m in metrics.items():
            calls = int(m.get("calls", 0))
            hits = int(m.get("hits", 0))
            ignores = int(m.get("ignores", 0))
            errors = int(m.get("errors", 0))
            time_ns = int(m.get("time_ns", 0))
            avg_time_ms = (time_ns / 1_000_000 / calls) if calls else 0.0
            fp_rate = (ignores / hits) if hits else 0.0
            q = quality.get(rule_id, {})
            precision = q.get("precision") if isinstance(q, dict) else None
            rows.append({
                "rule_id": rule_id,
                "calls": calls,
                "hits": hits,
                "ignores": ignores,
                "errors": errors,
                "time_ms": time_ns / 1_000_000,
                "avg_time_ms": avg_time_ms,
                "fp_rate": fp_rate,
                "precision": precision
            })
        top_slow = sorted(rows, key=lambda r: r["time_ms"], reverse=True)[:limit]
        top_noisy = sorted(rows, key=lambda r: r["fp_rate"], reverse=True)[:limit]
        top_triggered = sorted(rows, key=lambda r: r["hits"], reverse=True)[:limit]
        total_rules = len(self.rules)
        executed_count = len(metrics)
        return {
            "total_rules": total_rules,
            "executed_count": executed_count,
            "top_slow": top_slow,
            "top_noisy": top_noisy,
            "top_triggered": top_triggered
        }

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any] = None) -> List[Dict[str, Any]]:
        """
        Evaluates all registered rules against the diff.
        """
        triggered_rules = []
        ast_signals = ast_signals or []
        
        # Incremental Scheduling: Extract unique file extensions and paths from diff_data
        changed_files = diff_data.get("files", [])
        new_files = diff_data.get("new_files", [])
        stats = diff_data.get("stats", {"add": 0, "del": 0})
        
        # Adaptive Scheduling: If this is a "pure new project/file" diff, skip regression rules
        # Logic: If deletions are very low compared to additions, it's likely new code.
        total_changes = stats["add"] + stats["del"]
        is_mostly_new = False
        if total_changes > 10: # Only apply heuristic for non-trivial diffs
             if stats["del"] / total_changes < 0.1: # Less than 10% deletions
                  is_mostly_new = True
        
        # Another heuristic: If > 80% of files are new
        if len(changed_files) > 0 and (len(new_files) / len(changed_files)) > 0.8:
            is_mostly_new = True

        for rule in self.rules:
            if not getattr(rule, 'enabled', True):
                continue
            status = getattr(rule, "status", "stable")
            if status == "disabled":
                continue
            if status == "experimental" and not self.experimental_enabled:
                continue
            if not self.lifecycle.should_run(rule):
                continue
                
            # Adaptive Filter: Skip regression rules if the diff is mostly new files
            rule_type = getattr(rule, 'rule_type', 'absolute')
            if is_mostly_new and rule_type == 'regression':
                # Skip regression rules for new projects/files as they are meaningless
                continue

            # Skip paths filter: Skip files matching configured skip_paths patterns
            skip_paths = self.config.get("skip_paths", [])
            if skip_paths:
                file_should_skip = False
                for file_path in changed_files:
                    for pattern in skip_paths:
                        if fnmatch.fnmatch(file_path, pattern):
                            file_should_skip = True
                            break
                    if file_should_skip:
                        break
                if file_should_skip:
                    continue

            # Incremental Filtering: Only run rule if it matches at least one changed file
            rule_lang = getattr(rule, 'language', '*')
            rule_scope = getattr(rule, 'scope', '**')

            # Map language to file extensions
            lang_extensions = {
                'java': ['.java'],
                'go': ['.go'],
                'python': ['.py'],
                'javascript': ['.js', '.jsx', '.mjs', '.cjs'],
                'typescript': ['.ts', '.tsx'],
                'cpp': ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.c++'],
                'c': ['.c', '.h'],
            }

            should_run = False
            if rule_lang == '*' and rule_scope == '**':
                should_run = True
            else:
                for file_path in changed_files:
                    # Get extensions for this language
                    extensions = lang_extensions.get(rule_lang, [f".{rule_lang}"])

                    # Check if file matches any extension
                    lang_match = False
                    for ext in extensions:
                        if file_path.endswith(ext):
                            lang_match = True
                            break

                    if rule_lang != '*' and not lang_match:
                        continue
                    # Simple scope check (basic substring for now, could be improved to glob)
                    if rule_scope != '**' and not fnmatch.fnmatch(file_path, rule_scope):
                        continue
                    should_run = True
                    break

            if not should_run:
                continue

            # CVE 版本精确匹配：若规则带 package + versions 且用户配置了 dependency_versions，仅当配置版本在受影响区间内才执行
            rule_package = getattr(rule, 'package', None)
            rule_versions = getattr(rule, 'versions', None)
            if rule_package and rule_versions and isinstance(rule_package, dict):
                dep_versions = self.config.get("dependency_versions") or {}
                eco = (rule_package.get("ecosystem") or "").strip().lower()
                pkg_name = (rule_package.get("name") or "").strip()
                if eco and pkg_name:
                    eco_map = dep_versions.get(eco)
                    if isinstance(eco_map, dict):
                        current_ver = eco_map.get(pkg_name)
                        if current_ver is None:
                            continue  # 未配置该包版本，不执行此 CVE 规则（需用户配置以精确匹配）
                        intro = rule_versions.get("introduced") or []
                        fixed = rule_versions.get("fixed") or []
                        if not _version_in_cve_range(str(current_ver), intro if isinstance(intro, list) else [intro], fixed if isinstance(fixed, list) else [fixed] if fixed else []):
                            continue  # 配置版本不在受影响区间，跳过

            rule_id = rule.id
            quality_status, precision, _ = self.quality_manager.status(rule_id)
            if self.quality_manager.auto_tune and quality_status == "disabled":
                continue
            degrade_severity = self.quality_manager.auto_tune and quality_status == "degraded"
            if rule_id not in self.metrics:
                self.metrics[rule_id] = {"calls": 0, "hits": 0, "ignores": 0, "time_ns": 0, "errors": 0}
            
            self.metrics[rule_id]["calls"] += 1
            
            start_time = time.time_ns()
            match_details = None
            
            try:
                match_details = rule.evaluate(diff_data, ast_signals)
                if match_details:
                    matched_file = match_details.get('file', 'unknown')
                    if self.ignore_manager.is_ignored(rule_id, matched_file):
                        self.metrics[rule_id]["hits"] += 1
                        self.metrics[rule_id]["ignores"] += 1
                        self.quality_manager.record_false_positive(rule_id)
                        match_details = None
            except Exception:
                self.metrics[rule_id]["errors"] += 1
            finally:
                duration = time.time_ns() - start_time
                self.metrics[rule_id]["time_ns"] += duration
            
            if match_details:
                self.metrics[rule_id]["hits"] += 1
                quality_entry = self.quality_manager.record_hit(rule_id)
                severity = self.lifecycle.adjust_severity(rule, rule.severity)
                if degrade_severity:
                    severity = self._downgrade_severity(severity)
                triggered = {
                    "id": rule.id,
                    "title": getattr(rule, 'title', rule.id),  # Fallback to id if title not available
                    "severity": severity,
                    "impact": rule.impact,
                    "rationale": rule.rationale,
                    "matched_file": match_details.get('file', 'unknown'),
                    "precision": quality_entry.get("precision", precision),
                    "quality_status": quality_status,
                    "is_blocking": getattr(rule, 'is_blocking', False)
                }
                if status == "experimental" and self.experimental_report_only:
                    triggered["experimental"] = True
                triggered_rules.append(triggered)
                
        return triggered_rules
    
    def get_metrics(self) -> Dict[str, Any]:
        """Returns the collected performance metrics (calls, hits, ignores, time_ns, errors)."""
        return self.metrics

    @staticmethod
    def _downgrade_severity(severity: str) -> str:
        order = ["critical", "high", "medium", "low"]
        try:
            idx = order.index(str(severity).lower())
        except ValueError:
            return severity
        return order[min(idx + 1, len(order) - 1)]

    def _rule_confidences(self) -> Dict[str, float]:
        result = {}
        for rule in self.rules:
            try:
                result[rule.id] = float(getattr(rule, "confidence", 1.0))
            except Exception:
                result[rule.id] = 1.0
        return result

    def _update_quality_report(self) -> None:
        metrics = self.metrics
        confidences = self._rule_confidences()
        self.quality_manager.update_report(metrics, confidences)

    @staticmethod
    def quality_report_from_metrics(metrics: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Builds rule quality report from metrics. Each row: rule_id, hits, accepts, ignores, fp_rate.
        fp_rate = ignores/hits when hits > 0; used to flag noisy rules.
        Skips non-rule keys (e.g. cache, rule_stats) when _metrics from replay is passed.
        """
        rows = []
        for rule_id, m in metrics.items():
            if rule_id in ("cache", "rule_stats") or not isinstance(m, dict):
                continue
            hits = m.get("hits", 0)
            ignores = m.get("ignores", 0)
            accepts = max(0, hits - ignores)
            fp_rate = (ignores / hits) if hits else 0.0
            rows.append({
                "rule_id": rule_id,
                "hits": hits,
                "accepts": accepts,
                "ignores": ignores,
                "fp_rate": fp_rate,
            })
        return sorted(rows, key=lambda r: (-r["hits"], r["rule_id"]))
