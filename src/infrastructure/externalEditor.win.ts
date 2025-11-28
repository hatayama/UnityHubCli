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
import { getMsysDisabledEnv } from '../presentation/utils/path.js';

const execFileAsync = promisify(execFile);

const REGISTRY_PATH = 'HKEY_CURRENT_USER\\Software\\Unity Technologies\\Unity Editor 5.x';

/**
 * Decodes a REG_BINARY value (hex string) to a UTF-8 string.
 * @param hex - The hex string from registry output.
 * @returns The decoded string.
 */
const decodeRegBinary = (hex: string): string => {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte !== 0) {
      bytes.push(byte);
    }
  }
  return Buffer.from(bytes).toString('utf8');
};

/**
 * Parses the registry query output to extract the external editor path.
 * Unity stores kScriptsDefaultApp with a hash suffix (e.g., kScriptsDefaultApp_h2657262712)
 * and as REG_BINARY containing the path as hex-encoded string.
 * @param stdout - The output from reg query command.
 * @returns The configured editor path, or undefined if not found.
 */
const parseRegistryOutput = (stdout: string): string | undefined => {
  const lines = stdout.split('\n');
  for (const line of lines) {
    // Match kScriptsDefaultApp with optional hash suffix, supporting both REG_SZ and REG_BINARY
    const szMatch = line.match(/kScriptsDefaultApp[^\s]*\s+REG_SZ\s+(.+)/i);
    if (szMatch?.[1]) {
      return szMatch[1].trim();
    }
    const binaryMatch = line.match(/kScriptsDefaultApp[^\s]*\s+REG_BINARY\s+([0-9A-Fa-f]+)/i);
    if (binaryMatch?.[1]) {
      return decodeRegBinary(binaryMatch[1]);
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
      // Query entire registry path since Unity uses hash suffixes (e.g., kScriptsDefaultApp_h2657262712)
      const result = await execFileAsync(
        'reg',
        ['query', REGISTRY_PATH],
        { env: getMsysDisabledEnv() },
      );
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

/** Editors that prefer opening .sln files directly (IDEs with solution support) */
const slnPreferringEditors = ['rider', 'devenv', 'visualstudio'];

/** Checks if the editor prefers .sln files based on executable name */
const prefersSlnFile = (editorPath: string): boolean => {
  const editorName = basename(editorPath, '.exe').toLowerCase();
  return slnPreferringEditors.some((name) => editorName.includes(name));
};

/**
 * Launches an external editor application on Windows.
 * Uses spawn with detached mode to launch the application independently.
 */
export class WinExternalEditorLauncher implements IExternalEditorLauncher {
  /**
   * Launches the external editor with the specified project root.
   * For Rider/Visual Studio: opens .sln file directly if it exists.
   * For VS Code/Cursor and others: opens the project folder.
   * @param editorPath - The path to the editor executable.
   * @param projectRoot - The project root directory to open.
   */
  async launch(editorPath: string, projectRoot: string): Promise<void> {
    let targetPath = projectRoot;
    if (prefersSlnFile(editorPath)) {
      const projectName = basename(projectRoot);
      const slnFilePath = join(projectRoot, `${projectName}.sln`);
      if (existsSync(slnFilePath)) {
        targetPath = slnFilePath;
      }
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editorPath, [targetPath], {
        detached: true,
        stdio: 'ignore',
        env: getMsysDisabledEnv(),
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
