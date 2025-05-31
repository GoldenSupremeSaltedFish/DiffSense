package com.yourorg.gitimpact.report;

import java.util.List;
import java.util.Set;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.suggest.TestSuggester.TestSuggestion;

public class ReportModel {
    private final List<ImpactedMethod> directlyImpactedMethods;
    private final Set<String> indirectlyImpactedMethods;
    private final List<TestSuggestion> suggestedTests;

    public ReportModel(
        List<ImpactedMethod> directlyImpactedMethods,
        Set<String> indirectlyImpactedMethods,
        List<TestSuggestion> suggestedTests
    ) {
        this.directlyImpactedMethods = directlyImpactedMethods;
        this.indirectlyImpactedMethods = indirectlyImpactedMethods;
        this.suggestedTests = suggestedTests;
    }

    public List<ImpactedMethod> getDirectlyImpactedMethods() {
        return directlyImpactedMethods;
    }

    public Set<String> getIndirectlyImpactedMethods() {
        return indirectlyImpactedMethods;
    }

    public List<TestSuggestion> getSuggestedTests() {
        return suggestedTests;
    }
} 