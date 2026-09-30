package com.yourorg.gitimpact.spoon;

import com.yourorg.gitimpact.config.AnalysisConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spoon.Launcher;
import spoon.reflect.CtModel;
import spoon.reflect.declaration.CtType;
import spoon.reflect.visitor.filter.TypeFilter;

import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

public class DiffBasedSpoonLauncher {
    private static final Logger logger = LoggerFactory.getLogger(DiffBasedSpoonLauncher.class);
    
    private final List<Path> changedFiles;
    private final Path baseDir;
    private final AnalysisConfig config;
    private final Map<String, CtType<?>> typeCache = new HashMap<>();

    public DiffBasedSpoonLauncher(List<Path> changedFiles, Path baseDir, AnalysisConfig config) {
        this.changedFiles = changedFiles;
        this.baseDir = baseDir;
        this.config = config;
    }

    /**
     * 从变更文件构建部分 CtModel
     */
    public CtModel buildPartialModel() {
        if (changedFiles.isEmpty()) {
            logger.warn("没有检测到变更的文件");
            return null;
        }

        // 检查文件数量限制
        if (changedFiles.size() > config.getMaxFiles()) {
            logger.warn("检测到 {} 个修改的文件，超过了最大限制 {}。考虑增加 --max-files 或限制 --scope",
                changedFiles.size(), config.getMaxFiles());
        }

        // 初始化 Spoon
        Launcher launcher = new Launcher();
        launcher.getEnvironment().setComplianceLevel(17);
        launcher.getEnvironment().setNoClasspath(true); // 避免加载完整类路径
        launcher.getEnvironment().setIgnoreDuplicateDeclarations(true); // 处理重复声明

        // 只添加变更的文件
        int fileCount = 0;
        for (Path file : changedFiles) {
            if (fileCount >= config.getMaxFiles()) {
                logger.warn("已达到最大文件数限制 {}，停止添加更多文件", config.getMaxFiles());
                break;
            }

            if (isInScope(file)) {
                String relativePath = baseDir.relativize(file).toString();
                launcher.addInputResource(relativePath);
                fileCount++;
            }
        }

        // 构建模型
        return launcher.buildModel();
    }

    /**
     * 获取变更文件中的所有类型
     */
    public Set<CtType<?>> getChangedTypes(CtModel model) {
        Set<CtType<?>> changedTypes = new HashSet<>();
        
        // 获取所有类型
        List<CtType<?>> allTypes = model.getElements(new TypeFilter<>(CtType.class));
        
        // 过滤出变更文件中的类型
        for (CtType<?> type : allTypes) {
            String sourcePath = type.getPosition().getFile().getPath();
            Path typePath = Path.of(sourcePath);
            
            // 检查类型是否在变更文件中
            if (changedFiles.stream().anyMatch(f -> f.equals(typePath))) {
                changedTypes.add(type);
                typeCache.put(type.getQualifiedName(), type);
            }
        }
        
        return changedTypes;
    }

    /**
     * 获取类型的完全限定名
     */
    public String getQualifiedName(Path javaFile) {
        // 移除 .java 后缀
        String fileName = javaFile.toString().replace(".java", "");
        
        // 将文件路径转换为包路径
        String packagePath = fileName.replace('\\', '.').replace('/', '.');
        
        // 如果路径中包含 src/main/java，移除它
        int srcIndex = packagePath.indexOf("src.main.java.");
        if (srcIndex != -1) {
            packagePath = packagePath.substring(srcIndex + "src.main.java.".length());
        }
        
        return packagePath;
    }

    private boolean isInScope(Path file) {
        if (config.getScope().isEmpty()) {
            return true;
        }

        String filePath = file.toString().replace('\\', '/');
        String packagePath = config.getScope().replace('.', '/');

        return filePath.contains(packagePath);
    }

    /**
     * 获取已缓存的类型
     */
    public CtType<?> getCachedType(String qualifiedName) {
        return typeCache.get(qualifiedName);
    }

    /**
     * 清除类型缓存
     */
    public void clearCache() {
        typeCache.clear();
    }
} 