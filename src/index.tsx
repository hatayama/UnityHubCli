import process from 'node:process';

import { render } from 'ink';
import React from 'react';

import { LaunchProjectUseCase, LaunchWithEditorUseCase, ListProjectsUseCase, TerminateProjectUseCase } from './application/usecases.js';
import { MacEditorPathResolver } from './infrastructure/editor.js';
import { WinEditorPathResolver } from './infrastructure/editor.win.js';
import { MacExternalEditorLauncher, MacExternalEditorPathReader } from './infrastructure/externalEditor.js';
import { WinExternalEditorLauncher, WinExternalEditorPathReader } from './infrastructure/externalEditor.win.js';
import { GitRepositoryInfoReader } from './infrastructure/git.js';
import { NodeProcessLauncher } from './infrastructure/process.js';
import type { TerminalTheme } from './infrastructure/terminalTheme.js';
import { detectTerminalTheme } from './infrastructure/terminalTheme.js';
import { MacUnityHubProjectsReader } from './infrastructure/unityhub.js';
import { WinUnityHubProjectsReader } from './infrastructure/unityhub.win.js';
import { UnityLockChecker, UnityLockStatusReader } from './infrastructure/unityLock.js';
import { MacUnityProcessReader, MacUnityProcessTerminator } from './infrastructure/unityProcess.js';
import { WinUnityProcessReader, WinUnityProcessTerminator } from './infrastructure/unityProcess.win.js';
import { UnityTempDirectoryCleaner } from './infrastructure/unityTemp.js';
import { App } from './presentation/App.js';
import { ThemeProvider } from './presentation/theme.js';

const bootstrap = async (): Promise<void> => {
  const isWindows = process.platform === 'win32';
  const unityHubReader = isWindows ? new WinUnityHubProjectsReader() : new MacUnityHubProjectsReader();
  const gitRepositoryInfoReader = new GitRepositoryInfoReader();
  const lockStatusReader = new UnityLockStatusReader();
  const unityProcessReader = isWindows ? new WinUnityProcessReader() : new MacUnityProcessReader();
  const unityTempDirectoryCleaner = new UnityTempDirectoryCleaner();
  const listProjectsUseCase = new ListProjectsUseCase(
    unityHubReader,
    gitRepositoryInfoReader,
    unityHubReader,
    lockStatusReader,
    unityProcessReader,
  );
  const editorPathResolver = isWindows ? new WinEditorPathResolver() : new MacEditorPathResolver();
  const processLauncher = new NodeProcessLauncher();
  const lockChecker = new UnityLockChecker(unityProcessReader, unityTempDirectoryCleaner);
  const unityProcessTerminator = isWindows ? new WinUnityProcessTerminator() : new MacUnityProcessTerminator();
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
  const externalEditorPathReader = isWindows
    ? new WinExternalEditorPathReader()
    : new MacExternalEditorPathReader();
  const externalEditorLauncher = isWindows
    ? new WinExternalEditorLauncher()
    : new MacExternalEditorLauncher();
  const launchWithEditorUseCase = new LaunchWithEditorUseCase(
    launchProjectUseCase,
    externalEditorPathReader,
    externalEditorLauncher,
  );
  const useGitRootName = !process.argv.includes('--no-git-root-name');

  try {
    const rawModeSupported: boolean = Boolean(
      process.stdin.isTTY && typeof (process.stdin as unknown as { setRawMode?: unknown }).setRawMode === 'function',
    );
    if (!rawModeSupported) {
      const message = [
        'Interactive input (Raw mode) is not available in this terminal.',
        'Please run in PowerShell / cmd.exe, or use Git Bash in a ConPTY-based terminal (Windows Terminal, VS Code/Cursor integrated terminal).',
        'For MinTTY Git Bash, use one of the following:',
        ' - winpty cmd.exe /c npx unity-hub-cli',
        ' - winpty powershell.exe -NoProfile -Command npx unity-hub-cli',
        '(If already built) npm run build && winpty node dist/index.js',
        'Details: https://github.com/vadimdemedes/ink/#israwmodesupported',
      ].join('\n');
      // eslint-disable-next-line no-console
      console.error(message);
      process.exitCode = 1;
      return;
    }

    // Detect terminal background color to determine theme
    const theme: TerminalTheme = await detectTerminalTheme();

    const projects = await listProjectsUseCase.execute();
    const { waitUntilExit } = render(
      <ThemeProvider theme={theme}>
        <App
          projects={projects}
          onLaunch={(project) => launchProjectUseCase.execute(project)}
          onLaunchWithEditor={(project) => launchWithEditorUseCase.execute(project)}
          onTerminate={(project) => terminateProjectUseCase.execute(project)}
          onRefresh={() => listProjectsUseCase.execute()}
          useGitRootName={useGitRootName}
        />
      </ThemeProvider>,
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

// Avoid top-level await to prevent Node's "unsettled top-level await" warning
// Fire-and-forget with error capture via internal try/catch; extra catch as safety.
void bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});
