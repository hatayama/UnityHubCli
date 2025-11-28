import { execFile } from 'node:child_process';
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

/** Editors that prefer opening .sln files directly (IDEs with solution support) */
const slnPreferringEditors = ['rider', 'visual studio'];

/** Checks if the editor prefers .sln files based on app name */
const prefersSlnFile = (editorPath: string): boolean => {
  const editorName = basename(editorPath, '.app').toLowerCase();
  return slnPreferringEditors.some((name) => editorName.includes(name));
};

/**
 * Launches an external editor application on macOS.
 * Uses the `open -a` command to launch the application.
 */
export class MacExternalEditorLauncher implements IExternalEditorLauncher {
  /**
   * Launches the external editor with the specified project root.
   * For Rider/Visual Studio: opens .sln file directly if it exists.
   * For VS Code/Cursor and others: opens the project folder.
   * @param editorPath - The path to the editor application.
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
    await execFileAsync('open', ['-a', editorPath, targetPath]);
  }
}
