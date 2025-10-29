import type { GitRepositoryInfo, UnityProject } from '../domain/models.js';

import type {
  IEditorPathResolver,
  IGitRepositoryInfoReader,
  IProcessLauncher,
  IUnityHubProjectsReader,
  IUnityProcessLockChecker,
  IUnityProcessReader,
  IUnityProcessTerminator,
  IUnityTempDirectoryCleaner,
  IUnityProjectLockReader,
  IUnityProjectOptionsReader,
} from './ports.js';

export type LaunchStatus = 'idle' | 'running' | 'crashed';

export type ProjectView = {
  readonly project: UnityProject;
  readonly repository?: GitRepositoryInfo;
  readonly isLocked: boolean;
  readonly launchStatus: LaunchStatus;
};

export class ListProjectsUseCase {
  constructor(
    private readonly unityHubProjectsReader: IUnityHubProjectsReader,
    private readonly gitRepositoryInfoReader: IGitRepositoryInfoReader,
    private readonly unityProjectOptionsReader: IUnityProjectOptionsReader,
    private readonly lockReader: IUnityProjectLockReader,
    private readonly unityProcessReader: IUnityProcessReader,
  ) {}

  async execute(): Promise<ProjectView[]> {
    const projects = await this.unityHubProjectsReader.listProjects();
    const [repositoryInfoResults, lockResults, processResults] = await Promise.all([
      Promise.allSettled(
        projects.map((project) => this.gitRepositoryInfoReader.readRepositoryInfo(project.path)),
      ),
      Promise.allSettled(projects.map((project) => this.lockReader.isLocked(project.path))),
      Promise.allSettled(projects.map((project) => this.unityProcessReader.findByProjectPath(project.path))),
    ]);

    return projects.map((project, index) => {
      const repositoryResult = repositoryInfoResults[index];
      const lockResult = lockResults[index];
      const processResult = processResults[index];

      const repository: GitRepositoryInfo | undefined =
        repositoryResult.status === 'fulfilled' ? repositoryResult.value ?? undefined : undefined;
      const isLocked: boolean = lockResult.status === 'fulfilled' ? Boolean(lockResult.value) : false;
      const hasRunningProcess: boolean =
        processResult.status === 'fulfilled' ? Boolean(processResult.value) : false;
      const launchStatus: LaunchStatus = this.determineLaunchStatus(hasRunningProcess, isLocked);

      return { project, repository, isLocked, launchStatus };
    });
  }

  private determineLaunchStatus(hasRunningProcess: boolean, isLocked: boolean): LaunchStatus {
    if (hasRunningProcess) {
      return 'running';
    }
    if (isLocked) {
      return 'crashed';
    }
    return 'idle';
  }
}

export class LaunchCancelledError extends Error {
  constructor() {
    super('Launch cancelled by user');
    this.name = 'LaunchCancelledError';
  }
}

export class LaunchProjectUseCase {
  constructor(
    private readonly editorPathResolver: IEditorPathResolver,
    private readonly processLauncher: IProcessLauncher,
    private readonly unityHubProjectsReader: IUnityHubProjectsReader,
    private readonly unityProjectOptionsReader: IUnityProjectOptionsReader,
    private readonly unityProcessLockChecker: IUnityProcessLockChecker,
  ) {}

  async execute(project: UnityProject): Promise<void> {
    const lockDecision = await this.unityProcessLockChecker.check(project.path);
    if (lockDecision === 'skip') {
      throw new LaunchCancelledError();
    }

    const editorPath = await this.editorPathResolver.resolve(project.version);
    const extraArgs = await this.unityProjectOptionsReader.readCliArgs(project.path);
    const launchArgs = ['-projectPath', project.path, ...extraArgs];

    await this.processLauncher.launch(editorPath, launchArgs, {
      detached: true,
    });
    await this.unityHubProjectsReader.updateLastModified(project.path, new Date());
  }
}

export class TerminateProjectUseCase {
  constructor(
    private readonly unityProcessReader: IUnityProcessReader,
    private readonly unityProcessTerminator: IUnityProcessTerminator,
    private readonly unityTempDirectoryCleaner: IUnityTempDirectoryCleaner,
  ) {}

  async execute(
    project: UnityProject,
  ): Promise<{ readonly terminated: boolean; readonly message?: string }> {
    const unityProcess = await this.unityProcessReader.findByProjectPath(project.path);
    if (!unityProcess) {
      return {
        terminated: false,
        message: 'No Unity process is running for this project.',
      };
    }

    const termination = await this.unityProcessTerminator.terminate(unityProcess);
    if (!termination.terminated) {
      return {
        terminated: false,
        message: 'Failed to terminate the Unity process.',
      };
    }

    // Clean Temp only for stage 2 or 3 (sigterm/sigkill). Skip for 'graceful'.
    if (termination.stage === 'sigterm' || termination.stage === 'sigkill') {
      try {
        await this.unityTempDirectoryCleaner.clean(project.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(`Failed to clean Temp directory after termination: ${message}`);
      }
    }

    return {
      terminated: true,
    };
  }
}
