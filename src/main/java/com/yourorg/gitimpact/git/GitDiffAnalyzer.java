package com.yourorg.gitimpact.git;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.diff.Edit;
import org.eclipse.jgit.diff.RawTextComparator;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.util.io.DisabledOutputStream;

public class GitDiffAnalyzer {
    private final GitService gitService;

    public GitDiffAnalyzer(GitService gitService) {
        this.gitService = gitService;
    }

    public static class DiffResult {
        public final String filePath;
        public final List<DiffHunk> hunks;

        public DiffResult(String filePath, List<DiffHunk> hunks) {
            this.filePath = filePath;
            this.hunks = hunks;
        }
    }

    public static class DiffHunk {
        public final int oldStart;
        public final int oldLength;
        public final int newStart;
        public final int newLength;

        public DiffHunk(int oldStart, int oldLength, int newStart, int newLength) {
            this.oldStart = oldStart;
            this.oldLength = oldLength;
            this.newStart = newStart;
            this.newLength = newLength;
        }
    }

    public List<DiffResult> analyzeDiff(String baseRef, String targetRef) throws IOException {
        RevCommit baseCommit = gitService.resolveCommit(baseRef);
        RevCommit targetCommit = gitService.resolveCommit(targetRef);
        Repository repository = gitService.getRepository();

        List<DiffResult> results = new ArrayList<>();
        try (DiffFormatter formatter = new DiffFormatter(DisabledOutputStream.INSTANCE)) {
            formatter.setRepository(repository);
            formatter.setDiffComparator(RawTextComparator.DEFAULT);
            formatter.setDetectRenames(true);

            List<DiffEntry> diffs = formatter.scan(baseCommit.getTree(), targetCommit.getTree());
            
            for (DiffEntry diff : diffs) {
                if (diff.getChangeType() == DiffEntry.ChangeType.DELETE) {
                    continue;
                }

                String newPath = diff.getNewPath();
                if (!newPath.endsWith(".java")) {
                    continue;
                }

                List<DiffHunk> hunks = new ArrayList<>();
                for (Edit edit : formatter.toFileHeader(diff).toEditList()) {
                    hunks.add(new DiffHunk(
                        edit.getBeginA(),
                        edit.getEndA() - edit.getBeginA(),
                        edit.getBeginB(),
                        edit.getEndB() - edit.getBeginB()
                    ));
                }

                results.add(new DiffResult(newPath, hunks));
            }
        }

        return results;
    }
} 