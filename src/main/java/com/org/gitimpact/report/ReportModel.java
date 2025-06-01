package com.org.gitimpact.report;

import java.util.List;
import java.util.Set;

import com.org.gitimpact.suggest.TestSuggester;
import com.org.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

public class ReportModel {
    private final List<ImpactedMethod> directlyImpactedMethods;
    private final Set<String> indirectlyImpactedMethods;
    private final List<TestSuggester.TestSuggestion> suggestedTests;

    public ReportModel(
        List<ImpactedMethod> directlyImpactedMethods,
        Set<String> indirectlyImpactedMethods,
        List<TestSuggester.TestSuggestion> suggestedTests
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

    public List<TestSuggester.TestSuggestion> getSuggestedTests() {
        return suggestedTests;
    }
} 