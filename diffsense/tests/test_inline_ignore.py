import unittest
from pathlib import Path
from core.parser import DiffParser
from core.ast_detector import ASTDetector

class TestInlineIgnore(unittest.TestCase):
    def test_inline_ignore(self):
        diff_path = Path(r"c:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense\tests\fixtures\ast_cases\ignore\inline_ignore.diff")
        content = diff_path.read_text(encoding='utf-8')
        
        parser = DiffParser()
        diff_data = parser.parse(content)
        
        detector = ASTDetector()
        signals = detector.detect_signals(diff_data)
        
        # We expect exactly 1 lock signal (the second one)
        # The first one is ignored
        
        lock_signals = [s for s in signals if s.id == "runtime.concurrency.lock"]
        
        print(f"Found {len(lock_signals)} lock signals")
        for s in lock_signals:
            print(f"Signal at line {s.line}: {s.id}")
            
        self.assertEqual(len(lock_signals), 1)
        # The detected signal should be around line 10 in the file, which corresponds to some line in the patch
        # In the patch:
        # Line 7: lock.lock(); (Ignored)
        # Line 10: lock.lock(); (Triggered)
        
        # Check line number if possible
        self.assertTrue(lock_signals[0].line > 7)

if __name__ == '__main__':
    unittest.main()
