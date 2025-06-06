package com.yourorg.gitimpact.config;

public class AnalysisConfig {
    private final int maxDepth;
    private final int maxFiles;
    private final String scope;

    private static final int DEFAULT_MAX_DEPTH = 10;
    private static final int DEFAULT_MAX_FILES = 500;
    private static final String DEFAULT_SCOPE = "";

    private AnalysisConfig(Builder builder) {
        this.maxDepth = builder.maxDepth;
        this.maxFiles = builder.maxFiles;
        this.scope = builder.scope;
    }

    public int getMaxDepth() {
        return maxDepth;
    }

    public int getMaxFiles() {
        return maxFiles;
    }

    public String getScope() {
        return scope;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static AnalysisConfig getDefault() {
        return new Builder().build();
    }

    public static class Builder {
        private int maxDepth = DEFAULT_MAX_DEPTH;
        private int maxFiles = DEFAULT_MAX_FILES;
        private String scope = DEFAULT_SCOPE;

        public Builder maxDepth(int maxDepth) {
            this.maxDepth = maxDepth;
            return this;
        }

        public Builder maxFiles(int maxFiles) {
            this.maxFiles = maxFiles;
            return this;
        }

        public Builder scope(String scope) {
            this.scope = scope != null ? scope : DEFAULT_SCOPE;
            return this;
        }

        public AnalysisConfig build() {
            return new AnalysisConfig(this);
        }
    }
} 