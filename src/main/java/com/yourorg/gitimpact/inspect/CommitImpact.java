package com.yourorg.gitimpact.inspect;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

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
    
    @JsonProperty("riskScore")
    private final int riskScore;

    public CommitImpact(
        String commitId,
        String message,
        AuthorInfo author,
        Instant timestamp,
        int changedFilesCount,
        int changedMethodsCount,
        Set<String> impactedMethods,
        Map<String, Set<String>> impactedTests,
        int riskScore
    ) {
        this.commitId = commitId;
        this.message = message;
        this.author = author;
        this.timestamp = timestamp;
        this.changedFilesCount = changedFilesCount;
        this.changedMethodsCount = changedMethodsCount;
        this.impactedMethods = impactedMethods;
        this.impactedTests = impactedTests;
        this.riskScore = riskScore;
    }

    public String getCommitId() { return commitId; }
    public String getMessage() { return message; }
    public AuthorInfo getAuthor() { return author; }
    public Instant getTimestamp() { return timestamp; }
    public int getChangedFilesCount() { return changedFilesCount; }
    public int getChangedMethodsCount() { return changedMethodsCount; }
    public Set<String> getImpactedMethods() { return impactedMethods; }
    public Map<String, Set<String>> getImpactedTests() { return impactedTests; }
    public int getRiskScore() { return riskScore; }
} 