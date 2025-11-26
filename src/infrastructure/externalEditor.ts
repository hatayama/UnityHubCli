import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';

import type {
  ExternalEditorResult,
  IExternalEditorLauncher,
  IExternalEditorPathReader,
} from '../application/ports.js';

const execFileAsync = promisify(execFile);

const PLIST_DOMAIN = 'com.unity3d.UnityEditor5.x';
const PLIST_KEY = 'kScriptsDefaultApp';

/**
 * Reads the external editor path from Unity's preferences on macOS.
 * Uses the `defaults` command to read from the plist file.
 */
export class MacExternalEditorPathReader implements IExternalEditorPathReader {
  /**
   * Reads the external editor configuration from Unity preferences.
   * @returns The external editor result with status and path information.
   */
  async read(): Promise<ExternalEditorResult> {
    let configuredPath: string;
    try {
      const result = await execFileAsync('defaults', ['read', PLIST_DOMAIN, PLIST_KEY]);
      configuredPath = result.stdout.trim();
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

    const name = basename(configuredPath, '.app');
    return { status: 'found', path: configuredPath, name };
  }
}

/**
 * Launches an external editor application on macOS.
 * Uses the `open -a` command to launch the application.
 */
export class MacExternalEditorLauncher implements IExternalEditorLauncher {
  /**
   * Launches the external editor with the specified project root.
   * @param editorPath - The path to the editor application.
   * @param projectRoot - The project root directory to open.
   */
  async launch(editorPath: string, projectRoot: string): Promise<void> {
    await execFileAsync('open', ['-a', editorPath, projectRoot]);
  }
}
