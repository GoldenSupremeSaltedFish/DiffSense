package com.yourorg.gitimpact.inspect;

import java.nio.file.Path;
import java.time.LocalDate;

public class InspectConfig {
    private final String branch;
    private final String baseline;
    private final Integer commits;
    private final LocalDate since;
    private final Path reportPath;
    private final int depth;
    private final Path cacheDir;

    private static final int DEFAULT_DEPTH = 10;
    private static final String DEFAULT_BASELINE = "main";
    private static final String DEFAULT_CACHE_DIR = ".inspect_cache";

    private InspectConfig(Builder builder) {
        this.branch = builder.branch;
        this.baseline = builder.baseline;
        this.commits = builder.commits;
        this.since = builder.since;
        this.reportPath = builder.reportPath;
        this.depth = builder.depth;
        this.cacheDir = builder.cacheDir;
    }

    public String getBranch() {
        return branch;
    }

    public String getBaseline() {
        return baseline;
    }

    public Integer getCommits() {
        return commits;
    }

    public LocalDate getSince() {
        return since;
    }

    public Path getReportPath() {
        return reportPath;
    }

    public int getDepth() {
        return depth;
    }

    public Path getCacheDir() {
        return cacheDir;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String branch;
        private String baseline = DEFAULT_BASELINE;
        private Integer commits;
        private LocalDate since;
        private Path reportPath;
        private int depth = DEFAULT_DEPTH;
        private Path cacheDir = Path.of(DEFAULT_CACHE_DIR);

        public Builder branch(String branch) {
            this.branch = branch;
            return this;
        }

        public Builder baseline(String baseline) {
            this.baseline = baseline != null ? baseline : DEFAULT_BASELINE;
            return this;
        }

        public Builder commits(Integer commits) {
            this.commits = commits;
            return this;
        }

        public Builder since(LocalDate since) {
            this.since = since;
            return this;
        }

        public Builder reportPath(Path reportPath) {
            this.reportPath = reportPath;
            return this;
        }

        public Builder depth(int depth) {
            this.depth = depth;
            return this;
        }

        public Builder cacheDir(Path cacheDir) {
            this.cacheDir = cacheDir != null ? cacheDir : Path.of(DEFAULT_CACHE_DIR);
            return this;
        }

        public InspectConfig build() {
            if (branch == null) {
                throw new IllegalStateException("分支名称是必需的");
            }
            if (commits == null && since == null) {
                throw new IllegalStateException("必须指定 commits 或 since 参数之一");
            }
            return new InspectConfig(this);
        }
    }
} 