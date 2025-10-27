import type { GitRepositoryInfo, UnityProject } from '../domain/models.js';

import type {
  IEditorPathResolver,
  IGitRepositoryInfoReader,
  IProcessLauncher,
  IUnityHubProjectsReader,
  IUnityProcessLockChecker,
  IUnityProjectLockReader,
  IUnityProjectOptionsReader,
} from './ports.js';

export type ProjectView = {
  readonly project: UnityProject;
  readonly repository?: GitRepositoryInfo;
  readonly isLocked: boolean;
};

export class ListProjectsUseCase {
  constructor(
    private readonly unityHubProjectsReader: IUnityHubProjectsReader,
    private readonly gitRepositoryInfoReader: IGitRepositoryInfoReader,
    private readonly unityProjectOptionsReader: IUnityProjectOptionsReader,
    private readonly lockReader: IUnityProjectLockReader,
  ) {}

  async execute(): Promise<ProjectView[]> {
    const projects = await this.unityHubProjectsReader.listProjects();
    const [repositoryInfoResults, lockResults] = await Promise.all([
      Promise.allSettled(
        projects.map((project) => this.gitRepositoryInfoReader.readRepositoryInfo(project.path)),
      ),
      Promise.allSettled(projects.map((project) => this.lockReader.isLocked(project.path))),
    ]);

    return projects.map((project, index) => {
      const repositoryResult = repositoryInfoResults[index];
      const lockResult = lockResults[index];

      const repository: GitRepositoryInfo | undefined =
        repositoryResult.status === 'fulfilled' ? repositoryResult.value ?? undefined : undefined;
      const isLocked: boolean = lockResult.status === 'fulfilled' ? Boolean(lockResult.value) : false;

      return { project, repository, isLocked };
    });
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
