import { execFile, spawn } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import type {
  ExternalEditorResult,
  IExternalEditorLauncher,
  IExternalEditorPathReader,
} from '../application/ports.js';

const execFileAsync = promisify(execFile);

const REGISTRY_PATH = 'HKEY_CURRENT_USER\\Software\\Unity Technologies\\Unity Editor 5.x';

/**
 * Parses the registry query output to extract the external editor path.
 * @param stdout - The output from reg query command.
 * @returns The configured editor path, or undefined if not found.
 */
const parseRegistryOutput = (stdout: string): string | undefined => {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const match = line.match(/kScriptsDefaultApp[^\s]*\s+REG_SZ\s+(.+)/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
};

/**
 * Reads the external editor path from Unity's preferences on Windows.
 * Uses the `reg query` command to read from the Windows registry.
 */
export class WinExternalEditorPathReader implements IExternalEditorPathReader {
  /**
   * Reads the external editor configuration from Unity preferences.
   * @returns The external editor result with status and path information.
   */
  async read(): Promise<ExternalEditorResult> {
    let configuredPath: string | undefined;
    try {
      const result = await execFileAsync('reg', [
        'query',
        REGISTRY_PATH,
        '/v',
        'kScriptsDefaultApp',
      ]);
      configuredPath = parseRegistryOutput(result.stdout);
    } catch {
      return { status: 'not_configured' };
    }

    if (!configuredPath) {
      return { status: 'not_configured' };
    }

    try {
      await access(configuredPath, constants.F_OK);
    } catch {
      return { status: 'not_found', configuredPath };
    }

    const name = basename(configuredPath, '.exe');
    return { status: 'found', path: configuredPath, name };
  }
}

/**
 * Launches an external editor application on Windows.
 * Uses spawn with detached mode to launch the application independently.
 */
export class WinExternalEditorLauncher implements IExternalEditorLauncher {
  /**
   * Launches the external editor with the specified project root.
   * If a .sln file exists with the project name, it will be opened directly.
   * This allows Rider to open the solution without showing a selection dialog.
   * @param editorPath - The path to the editor executable.
   * @param projectRoot - The project root directory to open.
   */
  async launch(editorPath: string, projectRoot: string): Promise<void> {
    const projectName = basename(projectRoot);
    const slnFilePath = join(projectRoot, `${projectName}.sln`);
    const targetPath = existsSync(slnFilePath) ? slnFilePath : projectRoot;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editorPath, [targetPath], {
        detached: true,
        stdio: 'ignore',
      });

      const handleError = (error: Error): void => {
        child.off('spawn', handleSpawn);
        reject(error);
      };

      const handleSpawn = (): void => {
        child.off('error', handleError);
        child.unref();
        resolve();
      };

      child.once('error', handleError);
      child.once('spawn', handleSpawn);
    });
  }
}
