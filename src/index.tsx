import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';

import { LaunchEditorOnlyUseCase, LaunchProjectUseCase, LaunchWithEditorUseCase, ListProjectsUseCase, TerminateProjectUseCase } from './application/usecases.js';
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

const SHELL_INIT_MARKER_START = '# >>> unity-hub-cli >>>';
const SHELL_INIT_MARKER_END = '# <<< unity-hub-cli <<<';

const getVersion = (): string => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(currentDir, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
  return packageJson.version;
};

const getShellConfigPath = (): string | undefined => {
  const shell = process.env['SHELL'] ?? '';
  const home = homedir();

  if (shell.includes('zsh')) {
    return join(home, '.zshrc');
  }
  if (shell.includes('bash')) {
    const bashrcPath = join(home, '.bashrc');
    const profilePath = join(home, '.bash_profile');
    return existsSync(bashrcPath) ? bashrcPath : profilePath;
  }
  if (shell.includes('fish')) {
    return join(home, '.config', 'fish', 'config.fish');
  }
  // Windows PowerShell (no $SHELL environment variable)
  if (process.platform === 'win32') {
    return join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  }
  return undefined;
};

const getShellInitScriptWithMarkers = (): string => {
  const script = getShellInitScript();
  return `${SHELL_INIT_MARKER_START}\n${script}\n${SHELL_INIT_MARKER_END}`;
};

const askConfirmation = (question: string): Promise<boolean> => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

const previewShellInit = (): void => {
  const configPath = getShellConfigPath();
  console.log('=== Shell Integration Preview ===\n');
  console.log(`Target file: ${configPath ?? 'Unknown (unsupported shell)'}\n`);
  console.log('Content to be added:\n');
  console.log(getShellInitScriptWithMarkers());
};

const installShellInit = (): { success: boolean; message: string } => {
  const configPath = getShellConfigPath();
  if (!configPath) {
    return { success: false, message: 'Unsupported shell. Please copy the function from the README into your shell config manually.' };
  }

  const scriptWithMarkers = getShellInitScriptWithMarkers();
  const markerPattern = new RegExp(
    `${SHELL_INIT_MARKER_START}[\\s\\S]*?${SHELL_INIT_MARKER_END}`,
    'g',
  );

  let content = '';
  if (existsSync(configPath)) {
    content = readFileSync(configPath, 'utf-8');
  }

  const existingMatch = content.match(markerPattern);
  if (existingMatch && existingMatch[0] === scriptWithMarkers) {
    return { success: true, message: `Shell integration is already up to date in ${configPath}` };
  }

  let newContent: string;
  let action: string;
  if (existingMatch) {
    newContent = content.replace(markerPattern, scriptWithMarkers);
    action = 'updated';
  } else {
    newContent = content.trimEnd() + '\n\n' + scriptWithMarkers + '\n';
    action = 'installed';
  }

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, newContent, 'utf-8');
  return { success: true, message: `Shell integration ${action} in ${configPath}` };
};

const getNodePath = (): string => {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'where node' : 'which node';
  try {
    const result = execSync(command, { encoding: 'utf-8' }).trim().split('\n')[0];
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // Fall through to default
  }
  return 'node';
};

const getUnityHubCliPath = (): string => {
  const isWindows = process.platform === 'win32';
  try {
    const prefix = execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
    const binDir = isWindows ? prefix : `${prefix}/bin`;
    const cliPath = isWindows ? `${binDir}/unity-hub-cli.cmd` : `${binDir}/unity-hub-cli`;
    if (existsSync(cliPath)) {
      return cliPath;
    }
  } catch {
    // Fall through to default
  }
  return 'unity-hub-cli';
};

const getNpmCommand = (): string => {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
};

const NPM_VIEW_TIMEOUT_MS = 30_000;
const NPM_INSTALL_TIMEOUT_MS = 10 * 60_000;

type SemverIdentifier = number | string;
type ParsedSemver = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly SemverIdentifier[];
};

const parseSemver = (version: string): ParsedSemver | undefined => {
  const trimmed = version.trim().replace(/^v/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return undefined;
  }

  const prereleaseRaw = match[4];
  const prerelease: SemverIdentifier[] = prereleaseRaw
    ? prereleaseRaw.split('.').map((identifier) => {
        const numeric = /^[0-9]+$/.test(identifier) ? Number(identifier) : undefined;
        return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : identifier;
      })
    : [];

  return { major, minor, patch, prerelease };
};

const compareSemverIdentifiers = (a: SemverIdentifier, b: SemverIdentifier): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof a === 'number' && typeof b === 'string') {
    return -1;
  }
  if (typeof a === 'string' && typeof b === 'number') {
    return 1;
  }
  const aStr = String(a);
  const bStr = String(b);
  if (aStr === bStr) {
    return 0;
  }
  return aStr < bStr ? -1 : 1;
};

const compareSemver = (a: ParsedSemver, b: ParsedSemver): number => {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }

  const aHasPre = a.prerelease.length > 0;
  const bHasPre = b.prerelease.length > 0;
  if (!aHasPre && !bHasPre) {
    return 0;
  }
  if (!aHasPre && bHasPre) {
    return 1;
  }
  if (aHasPre && !bHasPre) {
    return -1;
  }

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i += 1) {
    const aId = a.prerelease[i];
    const bId = b.prerelease[i];
    if (aId === undefined && bId === undefined) {
      return 0;
    }
    if (aId === undefined) {
      return -1;
    }
    if (bId === undefined) {
      return 1;
    }
    const cmp = compareSemverIdentifiers(aId, bId);
    if (cmp !== 0) {
      return cmp;
    }
  }
  return 0;
};

type NpmViewLatestVersionResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: 'timeout' | 'spawn_failed' | 'nonzero_exit' | 'empty_output' };

const readLatestVersionFromNpm = (): NpmViewLatestVersionResult => {
  const npmCommand = getNpmCommand();
  const result = spawnSync(npmCommand, ['view', 'unity-hub-cli', 'version'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: NPM_VIEW_TIMEOUT_MS,
  });

  if (result.signal) {
    return { ok: false, reason: 'timeout' };
  }

  if (result.error) {
    const errorCode = (result.error as NodeJS.ErrnoException).code;
    if (errorCode === 'ETIMEDOUT') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'spawn_failed' };
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    return { ok: false, reason: 'nonzero_exit' };
  }

  const version = result.stdout.trim();
  if (!version) {
    return { ok: false, reason: 'empty_output' };
  }
  return { ok: true, version };
};

type NpmInstallLatestResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'timeout' | 'spawn_failed' | 'nonzero_exit' };

const installLatestVersionGlobally = (): NpmInstallLatestResult => {
  const npmCommand = getNpmCommand();
  const result = spawnSync(
    npmCommand,
    ['install', '-g', 'unity-hub-cli@latest', '--ignore-scripts', '--no-fund'],
    {
      stdio: 'inherit',
      timeout: NPM_INSTALL_TIMEOUT_MS,
    },
  );

  if (result.signal) {
    return { ok: false, reason: 'timeout' };
  }
  if (result.error) {
    const errorCode = (result.error as NodeJS.ErrnoException).code;
    if (errorCode === 'ETIMEDOUT') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'spawn_failed' };
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    return { ok: false, reason: 'nonzero_exit' };
  }
  return { ok: true };
};

// Uses temp file instead of command substitution $() to avoid subshell issues:
// 1. $() creates a non-interactive subshell where PATH may not be properly inherited
// 2. TUI rendering fails when stdout is captured by command substitution
// With temp file: stdout (path) goes to file, stderr (TUI) goes to terminal
const getShellInitScript = (): string => {
  const shell = process.env['SHELL'] ?? '';
  const isWindows = process.platform === 'win32';
  const nodePath = getNodePath();
  const cliPath = getUnityHubCliPath();

  if (shell.includes('fish')) {
    return `function unity-hub
  set -l tmpfile (mktemp)
  ${nodePath} ${cliPath} --output-path-on-exit > $tmpfile
  set -l dir (cat $tmpfile)
  rm -f $tmpfile
  if test -n "$dir"
    cd $dir
  end
end`;
  }

  if (shell.includes('bash') || shell.includes('zsh')) {
    return `unity-hub() {
  local tmpfile=$(mktemp)
  ${nodePath} ${cliPath} --output-path-on-exit >| "$tmpfile"
  local dir=$(cat "$tmpfile")
  rm -f "$tmpfile"
  if [ -n "$dir" ]; then
    cd "$dir"
  fi
}`;
  }

  // Windows PowerShell (no $SHELL set)
  if (isWindows) {
    return `function unity-hub {
  $tmpfile = [System.IO.Path]::GetTempFileName()
  & "${cliPath}" --output-path-on-exit > $tmpfile
  $dir = Get-Content $tmpfile
  Remove-Item $tmpfile
  if ($dir) {
    Set-Location $dir
  }
}`;
  }

  // Default: bash/zsh compatible
  return `unity-hub() {
  local tmpfile=$(mktemp)
  ${nodePath} ${cliPath} --output-path-on-exit >| "$tmpfile"
  local dir=$(cat "$tmpfile")
  rm -f "$tmpfile"
  if [ -n "$dir" ]; then
    cd "$dir"
  fi
}`;
};

const bootstrap = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.includes('-v') || args.includes('--version')) {
    console.log(getVersion());
    return;
  }

  if (args[0] === 'update') {
    const currentVersion = getVersion();
    const latestVersionResult = readLatestVersionFromNpm();
    if (!latestVersionResult.ok) {
      if (latestVersionResult.reason === 'timeout') {
        console.error('Failed to read the latest version from npm (timeout). Please check your network/proxy settings and try again.');
      } else if (latestVersionResult.reason === 'spawn_failed') {
        console.error('Failed to run npm. Please ensure npm is installed and available in your PATH.');
      } else {
        console.error('Failed to read the latest version from npm. Please ensure you can access the npm registry.');
      }
      process.exitCode = 1;
      return;
    }

    const latestVersion = latestVersionResult.version;
    const parsedCurrent = parseSemver(currentVersion);
    const parsedLatest = parseSemver(latestVersion);
    if (parsedCurrent && parsedLatest) {
      const cmp = compareSemver(parsedLatest, parsedCurrent);
      if (cmp <= 0) {
        console.log(`Already up to date: ${currentVersion}`);
        if (cmp < 0) {
          console.log(`Current version is newer than npm latest: ${latestVersion}`);
        }
        return;
      }
    } else if (latestVersion === currentVersion) {
      console.log(`Already up to date: ${currentVersion}`);
      return;
    }

    console.log(`Current version: ${currentVersion}`);
    console.log(`Latest version:  ${latestVersion}`);
    console.log('This will update the global installation via npm: npm install -g unity-hub-cli@latest --ignore-scripts --no-fund');
    console.log('');

    if (!process.stdin.isTTY) {
      console.error('Interactive confirmation is not available in this environment (stdin is not a TTY).');
      process.exitCode = 1;
      return;
    }

    if (!parsedCurrent || !parsedLatest) {
      console.log('Warning: could not compare versions reliably; proceeding may downgrade your installation.');
      console.log('');
    }

    const confirmed = await askConfirmation('Proceed with update? (y/n): ');
    if (!confirmed) {
      console.log('Update cancelled.');
      return;
    }

    const installResult = installLatestVersionGlobally();
    if (!installResult.ok) {
      if (installResult.reason === 'timeout') {
        console.error('Update failed (timeout). Please check your network/proxy settings and try again.');
      } else if (installResult.reason === 'spawn_failed') {
        console.error('Failed to run npm. Please ensure npm is installed and available in your PATH.');
      } else {
        console.error('Update failed. Please check the npm output above.');
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Updated to: ${latestVersion}`);
    return;
  }

  if (args.includes('--shell-init')) {
    const isDryRun = args.includes('--dry-run');

    if (isDryRun) {
      previewShellInit();
      return;
    }

    const configPath = getShellConfigPath();
    if (!configPath) {
      console.log('Unsupported shell. Please copy the function from the README into your shell config manually.');
      process.exitCode = 1;
      return;
    }

    console.log(`This will install the unity-hub function to: ${configPath}\n`);
    previewShellInit();
    console.log('');

    if (!process.stdin.isTTY) {
      console.error('Interactive confirmation is not available in this environment (stdin is not a TTY).');
      process.exitCode = 1;
      return;
    }

    const confirmed = await askConfirmation('Proceed with installation? (y/n): ');
    if (!confirmed) {
      console.log('Installation cancelled.');
      return;
    }

    const result = installShellInit();
    console.log(result.message);
    process.exitCode = result.success ? 0 : 1;
    return;
  }

  const outputPathOnExit = args.includes('--output-path-on-exit');

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
  const launchEditorOnlyUseCase = new LaunchEditorOnlyUseCase(
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
       
      console.error(message);
      process.exitCode = 1;
      return;
    }

    // When outputPathOnExit is enabled, stdout is redirected to a file, so force color output
    if (outputPathOnExit && process.stderr.isTTY) {
      chalk.level = 3; // Force truecolor
    }

    // Detect terminal background color to determine theme
    const theme: TerminalTheme = await detectTerminalTheme();

    let lastOpenedPath: string | undefined;

    const projects = await listProjectsUseCase.execute();
    // When outputPathOnExit is enabled, render TUI to stderr so stdout can be used for path output
    const renderOptions = outputPathOnExit ? { stdout: process.stderr, stdin: process.stdin } : undefined;
    const { waitUntilExit } = render(
      <ThemeProvider theme={theme}>
        <App
          projects={projects}
          onLaunch={(project) => launchProjectUseCase.execute(project)}
          onLaunchWithEditor={(project) => launchWithEditorUseCase.execute(project)}
          onLaunchEditorOnly={(project) => launchEditorOnlyUseCase.execute(project)}
          onTerminate={(project) => terminateProjectUseCase.execute(project)}
          onRefresh={() => listProjectsUseCase.execute()}
          onToggleFavorite={(project) => unityHubReader.toggleFavorite(project.path)}
          useGitRootName={useGitRootName}
          outputPathOnExit={outputPathOnExit}
          onSetExitPath={(path) => {
            lastOpenedPath = path;
          }}
        />
      </ThemeProvider>,
      renderOptions,
    );
    await waitUntilExit();

    if (outputPathOnExit) {
      // When outputPathOnExit is enabled, TUI is on stderr, so clear stderr
      process.stderr.write('\x1B[2J\x1B[3J\x1B[H');
      if (lastOpenedPath) {
        process.stdout.write(lastOpenedPath);
      }
    } else {
      process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
     
    console.error(message);
    process.exitCode = 1;
  }
};

// Avoid top-level await to prevent Node's "unsettled top-level await" warning
// Fire-and-forget with error capture via internal try/catch; extra catch as safety.
void bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
   
  console.error(message);
  process.exitCode = 1;
});
