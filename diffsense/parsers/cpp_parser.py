#!/usr/bin/env python3
"""
C++ Parser for DiffSense - Extracts semantic signals from C++ code changes.

This parser handles C++ specific syntax and security patterns including:
- Memory management (new/delete, smart pointers)
- Pointer operations and arithmetic
- Template metaprogramming
- RAII patterns
- Concurrency primitives (std::thread, mutex, etc.)
- Buffer operations and string handling

Author: OpenClaw C++ CVE Agent
Date: 2026-03-10
"""

import re
from typing import Dict, List, Any, Optional
from .base_parser import BaseParser


class CppParser(BaseParser):
    """C++ specific parser implementation for DiffSense."""
    
    def __init__(self):
        super().__init__()
        self.language = "cpp"
        self.file_extensions = {".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"}
        
        # C++ specific patterns to detect
        self.patterns = {
            'memory_allocation': r'\b(new|delete)\b',
            'pointer_arithmetic': r'[a-zA-Z_]\s*\+\s*\d+|\d+\s*\+\s*[a-zA-Z_]',
            'raw_pointers': r'[a-zA-Z_]\s*\*\s*[a-zA-Z_]',
            'buffer_operations': r'\b(memcpy|memset|strcpy|strcat)\b',
            'smart_pointers': r'\b(std::unique_ptr|std::shared_ptr|std::weak_ptr)\b',
            'concurrency': r'\b(std::thread|std::mutex|std::lock_guard|std::unique_lock)\b',
            'templates': r'template\s*<[^>]*>',
            'macros': r'#define\s+[A-Z_][A-Z0-9_]*',
            'unsafe_casts': r'\b(static_cast|dynamic_cast|reinterpret_cast|const_cast)\b',
            'exception_handling': r'\b(try|catch|throw)\b'
        }
    
    def parse_diff(self, diff_content: str) -> Dict[str, Any]:
        """
        Parse C++ diff content and extract semantic signals.
        
        Args:
            diff_content: The diff content to parse
            
        Returns:
            Dictionary containing extracted signals and metadata
        """
        signals = {
            'language': self.language,
            'file_extensions': list(self.file_extensions),
            'detected_patterns': {},
            'security_signals': [],
            'performance_signals': [],
            'concurrency_signals': []
        }
        
        # Extract file information
        files = self._extract_files(diff_content)
        signals['files'] = files
        
        # Analyze each file for patterns
        for file_info in files:
            if self._is_cpp_file(file_info['filename']):
                content = file_info.get('content', '')
                file_signals = self._analyze_cpp_content(content)
                signals['detected_patterns'][file_info['filename']] = file_signals
                
                # Categorize signals by type
                self._categorize_signals(file_signals, signals)
        
        return signals
    
    def _extract_files(self, diff_content: str) -> List[Dict[str, Any]]:
        """Extract file information from diff content."""
        files = []
        current_file = None
        lines = diff_content.split('\n')
        
        for line in lines:
            if line.startswith('diff --git'):
                if current_file:
                    files.append(current_file)
                # Extract filename from diff line
                parts = line.split()
                if len(parts) >= 3:
                    filename = parts[2].lstrip('a/')
                    current_file = {'filename': filename, 'content': ''}
            elif current_file and (line.startswith('+') or line.startswith('-')):
                if not line.startswith('+++') and not line.startswith('---'):
                    current_file['content'] += line[1:] + '\n'
        
        if current_file:
            files.append(current_file)
            
        return files
    
    def _is_cpp_file(self, filename: str) -> bool:
        """Check if file is a C++ file based on extension."""
        return any(filename.endswith(ext) for ext in self.file_extensions)
    
    def _analyze_cpp_content(self, content: str) -> Dict[str, Any]:
        """Analyze C++ content for security and performance patterns."""
        file_signals = {}
        
        for pattern_name, pattern_regex in self.patterns.items():
            matches = re.findall(pattern_regex, content, re.IGNORECASE)
            if matches:
                file_signals[pattern_name] = {
                    'count': len(matches),
                    'matches': matches[:10]  # Limit to first 10 matches
                }
        
        return file_signals
    
    def _categorize_signals(self, file_signals: Dict[str, Any], signals: Dict[str, Any]):
        """Categorize detected signals into security, performance, and concurrency."""
        security_patterns = {
            'memory_allocation', 'pointer_arithmetic', 'raw_pointers', 
            'buffer_operations', 'unsafe_casts'
        }
        
        performance_patterns = {
            'templates', 'macros'
        }
        
        concurrency_patterns = {
            'concurrency', 'exception_handling'
        }
        
        for pattern_name, pattern_data in file_signals.items():
            if pattern_name in security_patterns:
                signals['security_signals'].append({
                    'pattern': pattern_name,
                    'data': pattern_data
                })
            elif pattern_name in performance_patterns:
                signals['performance_signals'].append({
                    'pattern': pattern_name,
                    'data': pattern_data
                })
            elif pattern_name in concurrency_patterns:
                signals['concurrency_signals'].append({
                    'pattern': pattern_name,
                    'data': pattern_data
                })


# Register the parser
def create_parser():
    """Factory function to create C++ parser instance."""
    return CppParser()