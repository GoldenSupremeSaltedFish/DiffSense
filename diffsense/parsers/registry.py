from typing import Dict, Type, Optional
from .base_parser import BaseParser
from .java_parser import JavaParser
from .go_parser import GoParser  
from .python_parser import PythonParser

# Registry of available parsers
PARSER_REGISTRY: Dict[str, Type[BaseParser]] = {
    "java": JavaParser,
    "go": GoParser,
    "python": PythonParser
}

def get_parser_for_language(language: str) -> Optional[BaseParser]:
    """
    Get parser instance for the specified language.
    
    Args:
        language: Language identifier (e.g., 'java', 'go', 'python')
        
    Returns:
        Parser instance or None if not found
    """
    parser_class = PARSER_REGISTRY.get(language.lower())
    if parser_class:
        return parser_class()
    return None

def get_parser_for_file(file_path: str) -> Optional[BaseParser]:
    """
    Get appropriate parser for the given file based on its extension.
    
    Args:
        file_path: Path to the source file
        
    Returns:
        Parser instance that supports the file or None if not found
    """
    for parser_class in PARSER_REGISTRY.values():
        parser_instance = parser_class()
        if parser_instance.supports_file(file_path):
            return parser_instance
    return None

def get_supported_languages() -> list:
    """
    Get list of supported languages.
    
    Returns:
        List of supported language identifiers
    """
    return list(PARSER_REGISTRY.keys())

def get_supported_extensions() -> list:
    """
    Get list of all supported file extensions.
    
    Returns:
        List of supported file extensions
    """
    extensions = []
    for parser_class in PARSER_REGISTRY.values():
        parser_instance = parser_class()
        extensions.extend(parser_instance.get_file_extensions())
    return list(set(extensions))