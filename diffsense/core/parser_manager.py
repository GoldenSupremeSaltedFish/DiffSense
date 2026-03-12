"""
Multi-language Parser Manager for DiffSense
Manages language-specific parsers and provides unified AST signal extraction interface.
"""

import os
import importlib
from typing import Dict, List, Any, Optional, Set
from core.rule_base import Rule

class ParserManager:
    """
    Manages multiple language parsers and provides unified interface for AST signal extraction.
    Parsers are loaded dynamically based on available language modules.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.parsers: Dict[str, Any] = {}
        self.supported_languages: Set[str] = set()
        self._load_parsers()
    
    def _load_parsers(self):
        """Load all available language parsers from diffsense.parsers package."""
        parser_dir = os.path.join(os.path.dirname(__file__), '..', 'parsers')
        if not os.path.exists(parser_dir):
            return
        
        # Look for language-specific parser modules
        for item in os.listdir(parser_dir):
            if item.startswith('__') or not item.endswith('.py'):
                continue
            
            module_name = item[:-3]  # Remove .py extension
            try:
                # Try to import the parser module
                parser_module = importlib.import_module(f'diffsense.parsers.{module_name}')
                
                # Check if it has a get_parser function
                if hasattr(parser_module, 'get_parser'):
                    parser_instance = parser_module.get_parser(self.config)
                    language = getattr(parser_instance, 'language', module_name)
                    
                    self.parsers[language] = parser_instance
                    self.supported_languages.add(language)
                    
            except (ImportError, AttributeError) as e:
                # Skip modules that don't conform to parser interface
                continue
    
    def extract_signals(self, file_path: str, file_content: str, language: Optional[str] = None) -> List[Any]:
        """
        Extract AST signals from a file using the appropriate language parser.
        
        Args:
            file_path: Path to the source file
            file_content: Content of the source file
            language: Optional explicit language hint
            
        Returns:
            List of AST signals extracted from the file
        """
        # Determine language if not provided
        if language is None:
            language = self._detect_language(file_path)
        
        # Use appropriate parser if available
        if language in self.parsers:
            try:
                return self.parsers[language].extract_signals(file_path, file_content)
            except Exception as e:
                # Log error but don't crash - return empty signals
                return []
        
        # Fallback: return empty signals for unsupported languages
        return []
    
    def _detect_language(self, file_path: str) -> str:
        """Detect programming language from file extension."""
        extension_map = {
            '.java': 'java',
            '.go': 'go', 
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.scala': 'scala',
            '.kt': 'kotlin'
        }
        
        _, ext = os.path.splitext(file_path.lower())
        return extension_map.get(ext, 'unknown')
    
    def get_supported_languages(self) -> Set[str]:
        """Get set of supported programming languages."""
        return self.supported_languages.copy()
    
    def is_language_supported(self, language: str) -> bool:
        """Check if a language is supported by available parsers."""
        return language in self.supported_languages