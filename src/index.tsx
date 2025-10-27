import process from 'node:process';

import { render } from 'ink';

import { LaunchProjectUseCase, ListProjectsUseCase, TerminateProjectUseCase } from './application/usecases.js';
import { MacEditorPathResolver } from './infrastructure/editor.js';
import { GitRepositoryInfoReader } from './infrastructure/git.js';
import { NodeProcessLauncher } from './infrastructure/process.js';
import { UnityHubProjectsReader } from './infrastructure/unityhub.js';
import { UnityLockChecker, UnityLockStatusReader } from './infrastructure/unityLock.js';
import { MacUnityProcessReader, MacUnityProcessTerminator } from './infrastructure/unityProcess.js';
import { UnityTempDirectoryCleaner } from './infrastructure/unityTemp.js';
import { App } from './presentation/App.js';

const bootstrap = async (): Promise<void> => {
  const unityHubReader = new UnityHubProjectsReader();
  const gitRepositoryInfoReader = new GitRepositoryInfoReader();
  const lockStatusReader = new UnityLockStatusReader();
  const unityProcessReader = new MacUnityProcessReader();
  const listProjectsUseCase = new ListProjectsUseCase(
    unityHubReader,
    gitRepositoryInfoReader,
    unityHubReader,
    lockStatusReader,
  );
  const editorPathResolver = new MacEditorPathResolver();
  const processLauncher = new NodeProcessLauncher();
  const lockChecker = new UnityLockChecker(unityProcessReader);
  const unityProcessTerminator = new MacUnityProcessTerminator();
  const unityTempDirectoryCleaner = new UnityTempDirectoryCleaner();
  const launchProjectUseCase = new LaunchProjectUseCase(
    editorPathResolver,
    processLauncher,
    unityHubReader,
    unityHubReader,
    lockChecker,
  );
  const terminateProjectUseCase = new TerminateProjectUseCase(
    unityProcessReader,
    unityProcessTerminator,
    unityTempDirectoryCleaner,
  );
  const useGitRootName = !process.argv.includes('--no-git-root-name');
  const showBranch = !process.argv.includes('--hide-branch');
  const showPath = !process.argv.includes('--hide-path');

  try {
    const projects = await listProjectsUseCase.execute();
    const { waitUntilExit } = render(
      <App
        projects={projects}
        onLaunch={(project) => launchProjectUseCase.execute(project)}
        onTerminate={(project) => terminateProjectUseCase.execute(project)}
        useGitRootName={useGitRootName}
        showBranch={showBranch}
        showPath={showPath}
      />,
    );
    await waitUntilExit();
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(message);
    process.exitCode = 1;
  }
};

await bootstrap();
