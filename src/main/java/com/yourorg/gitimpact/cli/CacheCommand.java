package com.yourorg.gitimpact.cli;

import java.io.File;
import java.util.concurrent.Callable;

import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

/**
 * 缓存管理命令
 */
@Command(
    name = "cache",
    description = "缓存管理 (clear|info)",
    mixinStandardHelpOptions = true
)
public class CacheCommand implements Callable<Integer> {
    
    @Parameters(index = "0", description = "操作: clear|info", defaultValue = "info")
    private String action;
    
    @Override
    public Integer call() throws Exception {
        switch (action.toLowerCase()) {
            case "clear":
                clearCache();
                break;
            case "info":
                showCacheInfo();
                break;
            default:
                System.err.println("未知操作: " + action);
                System.err.println("支持的操作: clear, info");
                return 1;
        }
        return 0;
    }
    
    private void clearCache() {
        File cacheDir = new File(".diffsense-cache");
        if (cacheDir.exists()) {
            deleteDirectory(cacheDir);
            System.out.println("✅ 缓存已清理");
        } else {
            System.out.println("ℹ️ 没有发现缓存目录");
        }
    }
    
    private void showCacheInfo() {
        File cacheDir = new File(".diffsense-cache");
        if (cacheDir.exists()) {
            long size = getDirSize(cacheDir);
            int files = countFiles(cacheDir);
            System.out.println("缓存目录: " + cacheDir.getAbsolutePath());
            System.out.println("大小: " + formatSize(size));
            System.out.println("文件数: " + files);
        } else {
            System.out.println("没有发现缓存");
        }
    }
    
    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    deleteDirectory(file);
                } else {
                    file.delete();
                }
            }
        }
        dir.delete();
    }
    
    private long getDirSize(File dir) {
        long size = 0;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile()) {
                    size += file.length();
                } else if (file.isDirectory()) {
                    size += getDirSize(file);
                }
            }
        }
        return size;
    }
    
    private int countFiles(File dir) {
        int count = 0;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile()) {
                    count++;
                } else if (file.isDirectory()) {
                    count += countFiles(file);
                }
            }
        }
        return count;
    }
    
    private String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        else if (bytes < 1024 * 1024) return (bytes / 1024) + " KB";
        else return (bytes / (1024 * 1024)) + " MB";
    }
} 