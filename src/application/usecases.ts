import type { GitRepositoryInfo, UnityProject } from '../domain/models.js';

import type {
  ExternalEditorResult,
  IEditorPathResolver,
  IExternalEditorLauncher,
  IExternalEditorPathReader,
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
         
        console.error(`Failed to clean Temp directory after termination: ${message}`);
      }
    }

    return {
      terminated: true,
    };
  }
}

export type LaunchWithEditorResult = {
  readonly unityLaunched: boolean;
  readonly editorLaunched: boolean;
  readonly message: string;
};

export type LaunchEditorOnlyResult = {
  readonly editorLaunched: boolean;
  readonly message: string;
};

/**
 * Launches a Unity project along with the configured external editor.
 * If the external editor fails to launch, Unity will still be opened.
 */
export class LaunchWithEditorUseCase {
  constructor(
    private readonly launchProjectUseCase: LaunchProjectUseCase,
    private readonly externalEditorPathReader: IExternalEditorPathReader,
    private readonly externalEditorLauncher: IExternalEditorLauncher,
  ) {}

  /**
   * Launches the Unity project and attempts to open the external editor.
   * @param project - The Unity project to launch.
   * @returns The result of the launch operation.
   */
  async execute(project: UnityProject): Promise<LaunchWithEditorResult> {
    const editorResult = await this.externalEditorPathReader.read();

    let editorLaunched = false;
    let editorMessage = '';

    if (editorResult.status === 'found') {
      editorLaunched = await this.tryLaunchEditor(editorResult, project.path);
      editorMessage = editorLaunched ? ` + ${editorResult.name}` : ' (Editor launch failed)';
    } else {
      editorMessage = this.buildEditorStatusMessage(editorResult);
    }

    await this.launchProjectUseCase.execute(project);

    return {
      unityLaunched: true,
      editorLaunched,
      message: `Launched: ${project.title}${editorMessage}`,
    };
  }

  /**
   * Attempts to launch the external editor.
   * @param editorResult - The found external editor result.
   * @param projectPath - The path to the project root.
   * @returns Whether the editor was successfully launched.
   */
  private async tryLaunchEditor(
    editorResult: Extract<ExternalEditorResult, { status: 'found' }>,
    projectPath: string,
  ): Promise<boolean> {
    try {
      await this.externalEditorLauncher.launch(editorResult.path, projectPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Builds a status message for non-found editor results.
   * @param editorResult - The external editor result.
   * @returns The status message.
   */
  private buildEditorStatusMessage(editorResult: ExternalEditorResult): string {
    if (editorResult.status === 'not_configured') {
      return ' (Editor not configured)';
    }
    if (editorResult.status === 'not_found') {
      return ` (Editor not found: ${editorResult.configuredPath})`;
    }
    return '';
  }
}

/**
 * Launches only the external editor without starting Unity.
 */
export class LaunchEditorOnlyUseCase {
  constructor(
    private readonly externalEditorPathReader: IExternalEditorPathReader,
    private readonly externalEditorLauncher: IExternalEditorLauncher,
  ) {}

  /**
   * Launches only the external editor for the specified project.
   * @param project - The Unity project to open in the editor.
   * @returns The result of the launch operation.
   */
  async execute(project: UnityProject): Promise<LaunchEditorOnlyResult> {
    const editorResult = await this.externalEditorPathReader.read();

    if (editorResult.status === 'not_configured') {
      return {
        editorLaunched: false,
        message: 'Editor not configured in Unity preferences',
      };
    }

    if (editorResult.status === 'not_found') {
      return {
        editorLaunched: false,
        message: `Editor not found: ${editorResult.configuredPath}`,
      };
    }

    const launched = await this.tryLaunchEditor(editorResult, project.path);
    return {
      editorLaunched: launched,
      message: launched
        ? `Launched: ${editorResult.name}`
        : `Failed to launch ${editorResult.name}`,
    };
  }

  /**
   * Attempts to launch the external editor.
   * @param editorResult - The found external editor result.
   * @param projectPath - The path to the project root.
   * @returns Whether the editor was successfully launched.
   */
  private async tryLaunchEditor(
    editorResult: Extract<ExternalEditorResult, { status: 'found' }>,
    projectPath: string,
  ): Promise<boolean> {
    try {
      await this.externalEditorLauncher.launch(editorResult.path, projectPath);
      return true;
    } catch {
      return false;
    }
  }
}
