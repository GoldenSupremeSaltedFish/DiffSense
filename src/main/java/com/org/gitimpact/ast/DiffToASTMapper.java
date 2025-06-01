package com.org.gitimpact.ast;

import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.org.gitimpact.git.GitDiffAnalyzer;

public class DiffToASTMapper {
    private final ASTAnalyzer astAnalyzer;
    private final String baseDir;

    public DiffToASTMapper(String baseDir) {
        this.astAnalyzer = new ASTAnalyzer();
        this.baseDir = baseDir;
    }

    public static class ImpactedMethod {
        public final String className;
        public final String methodName;
        public final String filePath;

        public ImpactedMethod(String className, String methodName, String filePath) {
            this.className = className;
            this.methodName = methodName;
            this.filePath = filePath;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ImpactedMethod that = (ImpactedMethod) o;
            return className.equals(that.className) && 
                   methodName.equals(that.methodName) &&
                   filePath.equals(that.filePath);
        }

        @Override
        public int hashCode() {
            return 31 * (31 * className.hashCode() + methodName.hashCode()) + filePath.hashCode();
        }
    }

    public List<ImpactedMethod> mapDiffToMethods(List<GitDiffAnalyzer.DiffResult> diffResults) {
        List<ImpactedMethod> impactedMethods = new ArrayList<>();

        for (GitDiffAnalyzer.DiffResult diff : diffResults) {
            try {
                String fullPath = baseDir + "/" + diff.filePath;
                List<ASTAnalyzer.MethodInfo> methods = astAnalyzer.analyzeFile(fullPath);

                for (GitDiffAnalyzer.DiffHunk hunk : diff.hunks) {
                    List<ASTAnalyzer.MethodInfo> affectedMethods = methods.stream()
                        .filter(method -> isMethodAffected(method, hunk))
                        .collect(Collectors.toList());

                    for (ASTAnalyzer.MethodInfo method : affectedMethods) {
                        impactedMethods.add(new ImpactedMethod(
                            method.className,
                            method.methodName,
                            diff.filePath
                        ));
                    }
                }
            } catch (FileNotFoundException e) {
                System.err.println("警告: 无法分析文件 " + diff.filePath + ": " + e.getMessage());
            }
        }

        return impactedMethods;
    }

    private boolean isMethodAffected(ASTAnalyzer.MethodInfo method, GitDiffAnalyzer.DiffHunk hunk) {
        // 检查修改的行是否在方法的范围内
        int hunkStart = hunk.newStart;
        int hunkEnd = hunk.newStart + hunk.newLength;
        return !(hunkEnd < method.startLine || hunkStart > method.endLine);
    }
} 