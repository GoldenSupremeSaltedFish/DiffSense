package com.yourorg.gitimpact.inspect;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.yourorg.gitimpact.classification.BackendChangeClassifier;

public class CommitImpact {
    @JsonProperty("commitId")
    private final String commitId;
    
    @JsonProperty("message")
    private final String message;
    
    @JsonProperty("author")
    private final AuthorInfo author;
    
    @JsonProperty("timestamp")
    private final Instant timestamp;
    
    @JsonProperty("changedFilesCount")
    private final int changedFilesCount;
    
    @JsonProperty("changedMethodsCount")
    private final int changedMethodsCount;
    
    @JsonProperty("impactedMethods")
    private final Set<String> impactedMethods;
    
    @JsonProperty("impactedTests")
    private final Map<String, Set<String>> impactedTests;
    
    @JsonProperty("changeClassifications")
    private final List<BackendChangeClassifier.FileClassification> changeClassifications;
    
    @JsonProperty("classificationSummary")
    private final Map<String, Object> classificationSummary;
    
    @JsonProperty("testCoverageGaps")
    private final List<Map<String, Object>> testCoverageGaps;
    
    @JsonProperty("testCoverageStats")
    private final Map<String, Object> testCoverageStats;

    @JsonCreator
    public CommitImpact(
        @JsonProperty("commitId") String commitId,
        @JsonProperty("message") String message,
        @JsonProperty("author") AuthorInfo author,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("changedFilesCount") int changedFilesCount,
        @JsonProperty("changedMethodsCount") int changedMethodsCount,
        @JsonProperty("impactedMethods") Set<String> impactedMethods,
        @JsonProperty("impactedTests") Map<String, Set<String>> impactedTests,
        @JsonProperty("changeClassifications") List<BackendChangeClassifier.FileClassification> changeClassifications,
        @JsonProperty("classificationSummary") Map<String, Object> classificationSummary,
        @JsonProperty("testCoverageGaps") List<Map<String, Object>> testCoverageGaps,
        @JsonProperty("testCoverageStats") Map<String, Object> testCoverageStats
    ) {
        this.commitId = commitId;
        this.message = message;
        this.author = author;
        this.timestamp = timestamp;
        this.changedFilesCount = changedFilesCount;
        this.changedMethodsCount = changedMethodsCount;
        this.impactedMethods = impactedMethods;
        this.impactedTests = impactedTests;
        this.changeClassifications = changeClassifications;
        this.classificationSummary = classificationSummary;
        this.testCoverageGaps = testCoverageGaps;
        this.testCoverageStats = testCoverageStats;
    }

    public String getCommitId() { return commitId; }
    public String getMessage() { return message; }
    public AuthorInfo getAuthor() { return author; }
    public Instant getTimestamp() { return timestamp; }
    public int getChangedFilesCount() { return changedFilesCount; }
    public int getChangedMethodsCount() { return changedMethodsCount; }
    public Set<String> getImpactedMethods() { return impactedMethods; }
    public Map<String, Set<String>> getImpactedTests() { return impactedTests; }
    public List<BackendChangeClassifier.FileClassification> getChangeClassifications() { return changeClassifications; }
    public Map<String, Object> getClassificationSummary() { return classificationSummary; }
    public List<Map<String, Object>> getTestCoverageGaps() { return testCoverageGaps; }
    public Map<String, Object> getTestCoverageStats() { return testCoverageStats; }
} 