"""
JavaScript Parser for DiffSense
Supports AST-based analysis of JavaScript/TypeScript code changes
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

from ..core.base_parser import BaseParser
from ..core.signal import Signal
from ..utils.ast_utils import extract_ast_signals

logger = logging.getLogger(__name__)

class JavaScriptParser(BaseParser):
    """
    JavaScript/TypeScript parser that extracts semantic signals from code changes.
    Uses AST-based analysis to detect security and quality issues.
    """
    
    def __init__(self):
        super().__init__()
        self.language = "javascript"
        self.supported_extensions = {".js", ".jsx", ".ts", ".tsx"}
        
    def supports_file(self, file_path: str) -> bool:
        """Check if this parser supports the given file."""
        ext = os.path.splitext(file_path)[1].lower()
        return ext in self.supported_extensions
        
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse JavaScript file and extract AST-based signals.
        Returns a dictionary of detected signals and metadata.
        """
        try:
            signals = []
            
            # Extract basic file info
            file_info = {
                "path": file_path,
                "language": self.language,
                "size": len(content),
                "signals": []
            }
            
            # Extract AST-based signals
            ast_signals = self._extract_ast_signals(content, file_path)
            signals.extend(ast_signals)
            
            # Extract pattern-based signals for common vulnerabilities
            pattern_signals = self._extract_pattern_signals(content, file_path)
            signals.extend(pattern_signals)
            
            file_info["signals"] = signals
            return file_info
            
        except Exception as e:
            logger.error(f"Error parsing JavaScript file {file_path}: {e}")
            return {
                "path": file_path,
                "language": self.language,
                "error": str(e),
                "signals": []
            }
    
    def _extract_ast_signals(self, content: str, file_path: str) -> List[Signal]:
        """Extract signals using AST analysis."""
        signals = []
        
        try:
            # This would integrate with a real JS AST parser like esprima or acorn
            # For now, we'll simulate AST-based signal extraction
            
            # Common JS/TS vulnerability patterns
            if "eval(" in content:
                signals.append(Signal(
                    type="security.eval_usage",
                    severity="high",
                    location={"file": file_path},
                    description="Direct eval() usage detected - potential code injection risk"
                ))
                
            if "innerHTML" in content or "outerHTML" in content:
                signals.append(Signal(
                    type="security.xss_dom",
                    severity="medium",
                    location={"file": file_path},
                    description="DOM-based XSS potential via innerHTML/outerHTML"
                ))
                
            if "__proto__" in content or "constructor.prototype" in content:
                signals.append(Signal(
                    type="security.prototype_pollution",
                    severity="high",
                    location={"file": file_path},
                    description="Potential prototype pollution vulnerability"
                ))
                
            if "require(" in content and "userInput" in content:
                signals.append(Signal(
                    type="security.dynamic_require",
                    severity="high",
                    location={"file": file_path},
                    description="Dynamic require() with user input - potential RCE"
                ))
                
            # Concurrency and async patterns
            if "Promise.race(" in content:
                signals.append(Signal(
                    type="performance.promise_race",
                    severity="low",
                    location={"file": file_path},
                    description="Promise.race() usage detected"
                ))
                
            if "setTimeout(" in content and "0" in content:
                signals.append(Signal(
                    type="performance.zero_timeout",
                    severity="low",
                    location={"file": file_path},
                    description="Zero timeout in setTimeout() detected"
                ))
                
        except Exception as e:
            logger.warning(f"AST signal extraction failed for {file_path}: {e}")
            
        return signals
    
    def _extract_pattern_signals(self, content: str, file_path: str) -> List[Signal]:
        """Extract signals using pattern matching."""
        signals = []
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            # Check for dangerous patterns
            if "document.write(" in line:
                signals.append(Signal(
                    type="security.xss_document_write",
                    severity="high",
                    location={"file": file_path, "line": line_num},
                    description="document.write() usage - XSS risk"
                ))
                
            if "location.href" in line and "=" in line:
                signals.append(Signal(
                    type="security.open_redirect",
                    severity="medium",
                    location={"file": file_path, "line": line_num},
                    description="Potential open redirect via location.href assignment"
                ))
                
            if "localStorage.setItem(" in line:
                signals.append(Signal(
                    type="security.local_storage",
                    severity="low",
                    location={"file": file_path, "line": line_num},
                    description="localStorage usage detected"
                ))
                
            if "XMLHttpRequest" in line or "fetch(" in line:
                signals.append(Signal(
                    type="network.http_request",
                    severity="info",
                    location={"file": file_path, "line": line_num},
                    description="HTTP request detected"
                ))
                
        return signals

# Register the parser
def register_parsers():
    """Register JavaScript parser with the system."""
    from ..registry import register_parser
    register_parser("javascript", JavaScriptParser())