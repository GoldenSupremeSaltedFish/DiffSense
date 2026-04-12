"""
DiffSense Rules Package

This package contains built-in rules for DiffSense code review tool.
Rules are organized by category:

- concurrency.py: Thread safety and concurrency rules
- resource_management.py: Resource leak detection rules
- exception_handling.py: Exception handling best practices
- null_safety.py: Null pointer exception prevention
- collection_handling.py: Collection usage best practices
- api_compatibility.py: API breaking change detection
- yaml_adapter.py: Legacy YAML rule adapter

Usage:
    Rules are automatically loaded by the RuleEngine.
    Custom rules can be added by extending BaseRule class.
"""

from rules.concurrency import (
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule,
)

from rules.resource_management import (
    CloseableResourceLeakRule,
    DatabaseConnectionLeakRule,
    StreamWrapperRule,
    IOStreamChainingRule,
    ExecutorServiceShutdownRule,
)

from rules.exception_handling import (
    SwallowedExceptionRule,
    GenericExceptionRule,
    ThrowRuntimeExceptionRule,
    ThrowsClauseRemovedRule,
    FinallyBlockMissingRule,
    ExceptionLoggingRule,
)

from rules.null_safety import (
    NullReturnIgnoredRule,
    OptionalUnwrapRule,
    AutoboxingNPERule,
    ChainedMethodCallNPERule,
    ArrayIndexOutOfBoundsRule,
    StringConcatNPERule,
)

from rules.collection_handling import (
    RawTypeUsageRule,
    UnmodifiableCollectionRule,
    ConcurrentModificationRule,
    MapComputeRule,
    StreamCollectorRule,
    ImmutableCollectionRule,
    ListResizeRule,
)

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

# Cross-language rules (support multiple languages)
try:
    from rules.cross_language_adapter import (
        CrossLanguageRuleFactory,
        GenericResourceLeakRule,
        GenericNullSafetyRule,
        GenericExceptionHandlingRule,
    )
    CROSS_LANGUAGE_RULES_AVAILABLE = True
except ImportError:
    CROSS_LANGUAGE_RULES_AVAILABLE = False

# Registry of all built-in rules
BUILTIN_RULES = [
    # Concurrency (4 rules)
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule,
    
    # Resource Management (5 rules)
    CloseableResourceLeakRule,
    DatabaseConnectionLeakRule,
    StreamWrapperRule,
    IOStreamChainingRule,
    ExecutorServiceShutdownRule,
    
    # Exception Handling (6 rules)
    SwallowedExceptionRule,
    GenericExceptionRule,
    ThrowRuntimeExceptionRule,
    ThrowsClauseRemovedRule,
    FinallyBlockMissingRule,
    ExceptionLoggingRule,
    
    # Null Safety (6 rules)
    NullReturnIgnoredRule,
    OptionalUnwrapRule,
    AutoboxingNPERule,
    ChainedMethodCallNPERule,
    ArrayIndexOutOfBoundsRule,
    StringConcatNPERule,
    
    # Collection Handling (7 rules)
    RawTypeUsageRule,
    UnmodifiableCollectionRule,
    ConcurrentModificationRule,
    MapComputeRule,
    StreamCollectorRule,
    ImmutableCollectionRule,
    ListResizeRule,
    
    # API Compatibility (8 rules)
    PublicMethodRemovedRule,
    MethodSignatureChangedRule,
    FieldRemovedRule,
    ConstructorRemovedRule,
    InterfaceChangedRule,
    AnnotationRemovedRule,
    DeprecatedApiAddedRule,
    SerialVersionUIDChangedRule,
    
    # Go Language Rules (8 rules)
    GoGoroutineLeakRule,
    GoChannelLeakRule,
    GoDeferMisuseRule,
    GoUnsafeUsageRule,
    GoErrorHandlingRule,
    GoNilPointerRule,
    GoRaceConditionRule,
    GoHTTPSecurityRule,
    
    # Python Language Rules (19 rules)
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
    
    # C++ Language Rules (19 rules)
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
    
    # JavaScript Language Rules (15 rules)
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
]

# Total: 44 built-in rules + cross-language rules

# Cross-language rule support (Python, JavaScript, C++)
CROSS_LANGUAGE_RULES_LIST = []

if CROSS_LANGUAGE_RULES_AVAILABLE:
    # Create rules for each supported language
    for language in ['python', 'javascript', 'cpp', 'c']:
        CROSS_LANGUAGE_RULES_LIST.extend(
            CrossLanguageRuleFactory.create_all_rules_for_language(language)
        )


def get_all_builtin_rules():
    """
    Instantiate and return all built-in rules.
    
    Returns:
        List[BaseRule]: List of instantiated rule objects
    """
    return [rule_class() for rule_class in BUILTIN_RULES]


def get_rules_by_category(category: str):
    """
    Get rules filtered by category.
    
    Args:
        category: Category name ('concurrency', 'resource', 'exception', 
                  'null_safety', 'collection', 'api')
    
    Returns:
        List[BaseRule]: List of rules in the specified category
    """
    category_rules = {
        'concurrency': [
            ThreadPoolSemanticChangeRule,
            ConcurrencyRegressionRule,
            ThreadSafetyRemovalRule,
            LatchMisuseRule,
        ],
        'resource': [
            CloseableResourceLeakRule,
            DatabaseConnectionLeakRule,
            StreamWrapperRule,
            IOStreamChainingRule,
            ExecutorServiceShutdownRule,
        ],
        'exception': [
            SwallowedExceptionRule,
            GenericExceptionRule,
            ThrowRuntimeExceptionRule,
            ThrowsClauseRemovedRule,
            FinallyBlockMissingRule,
            ExceptionLoggingRule,
        ],
        'null_safety': [
            NullReturnIgnoredRule,
            OptionalUnwrapRule,
            AutoboxingNPERule,
            ChainedMethodCallNPERule,
            ArrayIndexOutOfBoundsRule,
            StringConcatNPERule,
        ],
        'collection': [
            RawTypeUsageRule,
            UnmodifiableCollectionRule,
            ConcurrentModificationRule,
            MapComputeRule,
            StreamCollectorRule,
            ImmutableCollectionRule,
            ListResizeRule,
        ],
        'api': [
            PublicMethodRemovedRule,
            MethodSignatureChangedRule,
            FieldRemovedRule,
            ConstructorRemovedRule,
            InterfaceChangedRule,
            AnnotationRemovedRule,
            DeprecatedApiAddedRule,
            SerialVersionUIDChangedRule,
        ],
        
        'go': [
            GoGoroutineLeakRule,
            GoChannelLeakRule,
            GoDeferMisuseRule,
            GoUnsafeUsageRule,
            GoErrorHandlingRule,
            GoNilPointerRule,
            GoRaceConditionRule,
            GoHTTPSecurityRule,
        ],
    }
    
    rules = category_rules.get(category.lower(), [])
    return [rule_class() for rule_class in rules]


def get_rule_by_id(rule_id: str):
    """
    Get a specific rule by its ID.
    
    Args:
        rule_id: Rule ID (e.g., 'resource.closeable_leak')
    
    Returns:
        BaseRule: The rule instance, or None if not found
    """
    for rule_class in BUILTIN_RULES:
        rule = rule_class()
        if rule.id == rule_id:
            return rule
    return None
