import process from 'node:process';

import { render } from 'ink';

import { ListProjectsUseCase, LaunchProjectUseCase } from './application/usecases.js';
import { MacEditorPathResolver } from './infrastructure/editor.js';
import { GitRepositoryInfoReader } from './infrastructure/git.js';
import { NodeProcessLauncher } from './infrastructure/process.js';
import { UnityHubProjectsReader } from './infrastructure/unityhub.js';
import { UnityLockChecker } from './infrastructure/unityLock.js';
import { App } from './presentation/App.js';

const bootstrap = async (): Promise<void> => {
  const unityHubReader = new UnityHubProjectsReader();
  const gitRepositoryInfoReader = new GitRepositoryInfoReader();
  const listProjectsUseCase = new ListProjectsUseCase(
    unityHubReader,
    gitRepositoryInfoReader,
    unityHubReader,
  );
  const editorPathResolver = new MacEditorPathResolver();
  const processLauncher = new NodeProcessLauncher();
  const lockChecker = new UnityLockChecker();
  const launchProjectUseCase = new LaunchProjectUseCase(
    editorPathResolver,
    processLauncher,
    unityHubReader,
    unityHubReader,
    lockChecker,
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
