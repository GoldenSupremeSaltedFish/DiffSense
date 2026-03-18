from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseParser(ABC):
    """
    Abstract base class for language-specific parsers.
    All language parsers must inherit from this class and implement the abstract methods.
    """
    
    def __init__(self, language: str):
        self.language = language
    
    @abstractmethod
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse a single file and return AST representation.
        
        Args:
            file_path: Path to the source file
            content: File content as string
            
        Returns:
            Dictionary containing parsed AST and metadata
        """
        pass
    
    @abstractmethod
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract semantic signals from parsed AST based on diff context.
        
        Args:
            ast_data: Parsed AST from parse_file()
            diff_context: Diff analysis context containing changed lines, files, etc.
            
        Returns:
            List of signal dictionaries with id, action, file, line, and metadata
        """
        pass
    
    @abstractmethod
    def get_file_extensions(self) -> List[str]:
        """
        Return list of file extensions supported by this parser.
        
        Returns:
            List of file extensions (e.g., ['.java', '.js', '.go'])
        """
        pass
    
    def supports_file(self, file_path: str) -> bool:
        """
        Check if this parser supports the given file based on extension.
        
        Args:
            file_path: Path to check
            
        Returns:
            True if supported, False otherwise
        """
        extensions = self.get_file_extensions()
        return any(file_path.endswith(ext) for ext in extensions)