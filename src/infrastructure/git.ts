import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { IGitRepositoryInfoReader } from '../application/ports.js';
import type { GitBranch, GitRepositoryInfo } from '../domain/models.js';

const HEAD_FILE = 'HEAD';
const GIT_DIR = '.git';
const MAX_ASCENT = 50;

const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};

const findGitDir = async (start: string): Promise<string | undefined> => {
  let current = resolve(start);
  for (let depth = 0; depth < MAX_ASCENT; depth += 1) {
    const candidate = join(current, GIT_DIR);
    if (await isDirectory(candidate)) {
      return candidate;
    }

    if (await isFile(candidate)) {
      const content = await readFile(candidate, 'utf8');
      const match = content.match(/^gitdir:\s*(.+)$/m);
      if (match) {
        const gitdirPath = match[1]?.trim();
        if (gitdirPath) {
          const target = gitdirPath.startsWith('/')
            ? gitdirPath
            : resolve(current, gitdirPath);
          return target;
        }
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
};

const parseHead = (content: string): GitBranch | undefined => {
  const trimmed = content.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('ref:')) {
    const refName = trimmed.split(' ')[1]?.trim();
    if (refName?.startsWith('refs/heads/')) {
      return { type: 'branch', name: refName.replace('refs/heads/', '') };
    }
    return undefined;
  }

  return { type: 'detached', sha: trimmed.slice(0, 7) };
};

export class GitRepositoryInfoReader implements IGitRepositoryInfoReader {
  async readRepositoryInfo(projectPath: string): Promise<GitRepositoryInfo | undefined> {
    const gitDir = await findGitDir(projectPath);
    if (!gitDir) {
      return undefined;
    }

    try {
      const headPath = join(gitDir, HEAD_FILE);
      const content = await readFile(headPath, 'utf8');
      const branch = parseHead(content);
      const root = dirname(gitDir);
      return { branch, root }; 
    } catch {
      return undefined;
    }
  }
}
