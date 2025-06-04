package com.yourorg.gitimpact.ast;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.util.io.DisabledOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class DiffToASTMapper {
    private static final Logger logger = LoggerFactory.getLogger(DiffToASTMapper.class);
    private final Repository repository;

    public DiffToASTMapper() {
        this.repository = null;
    }

    public DiffToASTMapper(Repository repository) {
        this.repository = repository;
    }

    public List<ImpactedMethod> mapDiffToMethods(RevCommit from, RevCommit to) {
        if (repository == null) {
            logger.warn("Repository为null，无法检测变更");
            return List.of();
        }

        List<ImpactedMethod> impactedMethods = new ArrayList<>();
        
        try {
            // 获取两个提交之间的差异
            List<DiffEntry> diffs = getDiffEntries(from, to);
            
            logger.info("检测到 {} 个文件变更", diffs.size());
            
            for (DiffEntry diff : diffs) {
                String filePath = getFilePath(diff);
                
                // 只处理Java文件
                if (!isJavaFile(filePath)) {
                    continue;
                }
                
                logger.debug("处理Java文件变更: {} ({})", filePath, diff.getChangeType());
                
                // 解析文件中的方法
                List<ImpactedMethod> fileMethods = extractMethodsFromFile(filePath, diff);
                impactedMethods.addAll(fileMethods);
            }
            
            logger.info("共检测到 {} 个受影响的方法", impactedMethods.size());
            
        } catch (Exception e) {
            logger.error("检测文件变更时发生错误", e);
        }
        
        return impactedMethods;
    }

    private List<DiffEntry> getDiffEntries(RevCommit from, RevCommit to) throws IOException {
        try (ObjectReader reader = repository.newObjectReader()) {
            CanonicalTreeParser oldTreeIter = new CanonicalTreeParser();
            oldTreeIter.reset(reader, from.getTree());
            
            CanonicalTreeParser newTreeIter = new CanonicalTreeParser();
            newTreeIter.reset(reader, to.getTree());
            
            try (Git git = new Git(repository)) {
                return git.diff()
                    .setOldTree(oldTreeIter)
                    .setNewTree(newTreeIter)
                    .call();
            }
        } catch (Exception e) {
            throw new IOException("获取diff失败", e);
        }
    }

    private String getFilePath(DiffEntry diff) {
        // 优先使用新文件路径，如果是删除的文件则使用旧路径
        return diff.getNewPath() != null && !diff.getNewPath().equals("/dev/null") 
            ? diff.getNewPath() 
            : diff.getOldPath();
    }

    private boolean isJavaFile(String filePath) {
        return filePath != null && filePath.endsWith(".java");
    }

    private List<ImpactedMethod> extractMethodsFromFile(String filePath, DiffEntry diff) {
        List<ImpactedMethod> methods = new ArrayList<>();
        
        try {
            // 对于新增、修改的文件，分析新版本
            if (diff.getChangeType() != DiffEntry.ChangeType.DELETE) {
                methods.addAll(parseJavaFileForMethods(filePath));
            }
            
        } catch (Exception e) {
            logger.warn("解析Java文件 {} 失败: {}", filePath, e.getMessage());
        }
        
        return methods;
    }

    private List<ImpactedMethod> parseJavaFileForMethods(String filePath) {
        List<ImpactedMethod> methods = new ArrayList<>();
        
        try {
            // 从文件系统读取Java文件内容
            Path javaFile = Path.of(filePath);
            if (!javaFile.toFile().exists()) {
                logger.warn("Java文件不存在: {}", filePath);
                return methods;
            }
            
            CompilationUnit cu = StaticJavaParser.parse(javaFile);
            String packageName = cu.getPackageDeclaration()
                .map(pd -> pd.getNameAsString())
                .orElse("");
            
            // 使用访问者模式遍历所有方法
            cu.accept(new VoidVisitorAdapter<Void>() {
                @Override
                public void visit(MethodDeclaration method, Void arg) {
                    super.visit(method, arg);
                    
                    String className = method.findAncestor(ClassOrInterfaceDeclaration.class)
                        .map(cls -> cls.getNameAsString())
                        .orElse("Unknown");
                    
                    String methodName = method.getNameAsString();
                    String methodSignature = method.getDeclarationAsString(false, false);
                    
                    ImpactedMethod impactedMethod = new ImpactedMethod(
                        filePath,
                        methodName,
                        methodSignature,
                        className,
                        packageName
                    );
                    
                    methods.add(impactedMethod);
                }
            }, null);
            
        } catch (Exception e) {
            logger.error("解析Java文件时发生错误: {}", filePath, e);
        }
        
        return methods;
    }

    public static class ImpactedMethod {
        public final String filePath;
        public final String methodName;
        public final String methodSignature;
        public final String className;
        public final String packageName;

        public ImpactedMethod(
            String filePath,
            String methodName,
            String methodSignature,
            String className,
            String packageName
        ) {
            this.filePath = filePath;
            this.methodName = methodName;
            this.methodSignature = methodSignature;
            this.className = className;
            this.packageName = packageName;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ImpactedMethod that = (ImpactedMethod) o;
            return Objects.equals(filePath, that.filePath) &&
                   Objects.equals(methodName, that.methodName) &&
                   Objects.equals(methodSignature, that.methodSignature) &&
                   Objects.equals(className, that.className) &&
                   Objects.equals(packageName, that.packageName);
        }

        @Override
        public int hashCode() {
            return Objects.hash(filePath, methodName, methodSignature, className, packageName);
        }

        @Override
        public String toString() {
            return String.format("%s.%s.%s", packageName, className, methodName);
        }
    }
} 