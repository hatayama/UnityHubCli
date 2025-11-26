import type { EditorVersion, GitRepositoryInfo, UnityProcess, UnityProject } from '../domain/models.js';

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

export interface IUnityProcessTerminator {
  terminate(
    unityProcess: UnityProcess,
  ): Promise<{ readonly terminated: boolean; readonly stage?: 'graceful' | 'sigterm' | 'sigkill' }>;
}

export interface IUnityProcessReader {
  findByProjectPath(projectPath: string): Promise<UnityProcess | undefined>;
}

export interface IUnityTempDirectoryCleaner {
  clean(projectPath: string): Promise<void>;
}

export type ExternalEditorResult =
  | { readonly status: 'found'; readonly path: string; readonly name: string }
  | { readonly status: 'not_configured' }
  | { readonly status: 'not_found'; readonly configuredPath: string };

export interface IExternalEditorPathReader {
  read(): Promise<ExternalEditorResult>;
}

export interface IExternalEditorLauncher {
  launch(editorPath: string, projectRoot: string): Promise<void>;
}
