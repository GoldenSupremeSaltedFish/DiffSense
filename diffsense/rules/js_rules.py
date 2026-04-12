"""
JavaScript/TypeScript Rules for DiffSense

JS/TS specific security, best practices, and quality rules.
"""

import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


# ==================== Security Rules ====================

class JSHardcodedSecretRule(BaseRule):
    """检测硬编码密钥"""

    def __init__(self):
        self._patterns = [
            re.compile(r'password\s*[:=]\s*["\'][^"\']{3,}["\']', re.IGNORECASE),
            re.compile(r'api[_-]?key\s*[:=]\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'secret\s*[:=]\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'token\s*[:=]\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'aws[_-]?secret', re.IGNORECASE),
            re.compile(r'private[_-]?key\s*[:=]', re.IGNORECASE),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.hardcoded_secret"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Hardcoded credentials detected"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class JSEvalUsageRule(BaseRule):
    """检测 eval 使用"""

    def __init__(self):
        self._eval_patterns = [
            re.compile(r'\beval\s*\('),
            re.compile(r'\bFunction\s*\('),
            re.compile(r'setTimeout\s*\(\s*["\']'),
            re.compile(r'setInterval\s*\(\s*["\']'),
            re.compile(r'\bnew\s+Function\s*\('),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.code_injection"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "eval/Function allows arbitrary code execution"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._eval_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class JSXSSRule(BaseRule):
    """检测 XSS 漏洞"""

    def __init__(self):
        self._xss_patterns = [
            re.compile(r'innerHTML\s*='),
            re.compile(r'outerHTML\s*='),
            re.compile(r'document\.write\s*\('),
            re.compile(r'\.insertAdjacentHTML\s*\('),
            re.compile(r'dangerouslySetInnerHTML'),  # React
        ]

    @property
    def id(self) -> str:
        return "javascript.security.xss"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential XSS vulnerability - sanitize user input"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._xss_patterns:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class JSPrototypePollutionRule(BaseRule):
    """检测原型污染"""

    def __init__(self):
        self._pollution_patterns = [
            re.compile(r'__proto__'),
            re.compile(r'constructor\.prototype'),
            re.compile(r'Object\.assign\s*\([^)]*req\.body'),
            re.compile(r'\[\s*userKey\s*\]\s*='),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.prototype_pollution"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential prototype pollution vulnerability"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._pollution_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class JSCommandInjectionRule(BaseRule):
    """检测命令注入"""

    def __init__(self):
        self._dangerous = [
            re.compile(r'child_process.*exec\s*\('),
            re.compile(r'child_process.*spawn\s*\('),
            re.compile(r'child_process.*execSync\s*\('),
            re.compile(r'\.exec\s*\('),
            re.compile(r'process\.exit\s*\('),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.command_injection"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential command injection"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._dangerous:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class JSOpenRedirectRule(BaseRule):
    """检测开放重定向"""

    def __init__(self):
        self._redirect_patterns = [
            re.compile(r'window\.location\s*=\s*'),
            re.compile(r'response\.redirect\s*\('),
            re.compile(r'res\.redirect\s*\('),
            re.compile(r'Redirect\s*\('),
            re.compile(r'\.push\s*\(\s*'),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.open_redirect"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential open redirect - validate URL"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._redirect_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Best Practices ====================

class JSConsoleLogRule(BaseRule):
    """检测 console.log 遗留"""

    def __init__(self):
        self._console_patterns = [
            re.compile(r'\bconsole\.(log|debug|info|warn|error)\s*\('),
        ]

    @property
    def id(self) -> str:
        return "javascript.maintenance.debug_code"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Console statement should be removed in production"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._console_patterns:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class JSDebuggerRule(BaseRule):
    """检测 debugger 语句"""

    def __init__(self):
        self._debugger = re.compile(r'\bdebugger\s*;')

    @property
    def id(self) -> str:
        return "javascript.maintenance.debugger"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Debugger statement should be removed"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._debugger.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Async/Promise Rules ====================

class JSPromiseRejectRule(BaseRule):
    """检测未处理的 Promise 拒绝"""

    def __init__(self):
        self._reject = re.compile(r'\.reject\s*\(|Promise\.reject\s*\(')

    @property
    def id(self) -> str:
        return "javascript.exception.promise_reject"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Unhandled Promise rejection"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._reject.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Type Safety (TypeScript) ====================

class JSTypeNarrowingRule(BaseRule):
    """检测类型收窄问题"""

    def __init__(self):
        self._unsafe = [
            re.compile(r'as\s+\w+'),  # Type assertion without check
            re.compile(r'<\w+>'),  # JSX without validation
        ]

    @property
    def id(self) -> str:
        return "javascript.null.type_assertion"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Unsafe type assertion - use type guards"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._unsafe:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Module/Import Rules ====================

class JSDynamicImportRule(BaseRule):
    """检测动态 import（安全考虑）"""

    def __init__(self):
        self._dynamic_import = re.compile(r'import\s*\(')

    @property
    def id(self) -> str:
        return "javascript.performance.dynamic_import"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Dynamic import detected - may impact performance"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._dynamic_import.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Sensitive Data ====================

class JSLocalStorageSecretRule(BaseRule):
    """检测 localStorage 存储敏感信息"""

    def __init__(self):
        self._patterns = [
            re.compile(r'localStorage\.setItem\s*\(\s*["\']?(?:token|password|secret|key)'),
            re.compile(r'sessionStorage\.setItem\s*\(\s*["\']?(?:token|password|secret|key)'),
        ]

    @property
    def id(self) -> str:
        return "javascript.security.sensitive_storage"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Sensitive data in localStorage - use httpOnly cookies"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Regex DoS ====================

class JSReDoSRule(BaseRule):
    """检测正则表达式 DoS 风险"""

    def __init__(self):
        self._dangerous = [
            re.compile(r'\/\.\*\*/'),  # .* followed by anything
            re.compile(r'\/\.\+\/'),
            re.compile(r'\(\?\=.*\)\*'),  # Lookahead with *
            re.compile(r'\(\?\!.*\)\*'),  # Negative lookahead with *
        ]

    @property
    def id(self) -> str:
        return "javascript.performance.regex_dos"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Potential ReDoS vulnerability - use atomic groups"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._dangerous:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Deprecated APIs ====================

class JSDeprecatedAPIRule(BaseRule):
    """检测使用已废弃 API"""

    def __init__(self):
        self._deprecated = [
            re.compile(r'__defineGetter__'),
            re.compile(r'__defineSetter__'),
            re.compile(r'document\.getElementsByClassName'),  # Use querySelector
            re.compile(r'Element\.prototype\.attachShadow'),  # Check compatibility
        ]

    @property
    def id(self) -> str:
        return "javascript.maintenance.deprecated_api"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Deprecated API usage"

    @property
    def language(self) -> str:
        return "javascript"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._deprecated:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None