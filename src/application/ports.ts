import type { EditorVersion, GitRepositoryInfo, UnityProject } from '../domain/models.js';

export interface IUnityHubProjectsReader {
  listProjects(): Promise<UnityProject[]>;
  updateLastModified(projectPath: string, date: Date): Promise<void>;
}

export interface IGitRepositoryInfoReader {
  readRepositoryInfo(projectPath: string): Promise<GitRepositoryInfo | undefined>;
}

export interface IUnityProjectOptionsReader {
  readCliArgs(projectPath: string): Promise<readonly string[]>;
}

export interface IUnityProjectLockReader {
  isLocked(projectPath: string): Promise<boolean>;
}

export interface IEditorPathResolver {
  resolve(version: EditorVersion): Promise<string>;
}

export interface IProcessLauncher {
  launch(command: string, args: readonly string[], options?: { detached?: boolean }): Promise<void>;
}

export interface IUnityProcessLockChecker {
  check(projectPath: string): Promise<'allow' | 'skip'>;
}
