package com.org.gitimpact.git;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import java.io.File;
import java.io.IOException;

public class GitService {
    private final Repository repository;

    public GitService(String repoPath) throws IOException {
        FileRepositoryBuilder builder = new FileRepositoryBuilder();
        this.repository = builder.setGitDir(new File(repoPath + "/.git"))
                                .readEnvironment()
                                .findGitDir()
                                .build();
    }

    public RevCommit resolveCommit(String revisionStr) throws IOException {
        ObjectId objectId = repository.resolve(revisionStr);
        if (objectId == null) {
            throw new IllegalArgumentException("无法解析修订版本: " + revisionStr);
        }
        
        try (RevWalk revWalk = new RevWalk(repository)) {
            return revWalk.parseCommit(objectId);
        }
    }

    public Repository getRepository() {
        return repository;
    }

    public void close() {
        repository.close();
    }
} 