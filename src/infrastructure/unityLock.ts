import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type {
  IUnityProcessLockChecker,
  IUnityProcessReader,
  IUnityProjectLockReader,
  IUnityTempDirectoryCleaner,
} from '../application/ports.js';

const execFileAsync = promisify(execFile);

const buildBringToFrontScript = (pid: number): string => {
  return `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`;
};

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export class UnityLockChecker implements IUnityProcessLockChecker {
  constructor(
    private readonly unityProcessReader: IUnityProcessReader,
    private readonly tempDirectoryCleaner: IUnityTempDirectoryCleaner,
  ) {}

  async check(projectPath: string): Promise<'allow' | 'skip'> {
    const activeProcess = await this.unityProcessReader.findByProjectPath(projectPath);
    if (activeProcess) {
      console.log(
        `Unity process already running for project: ${activeProcess.projectPath} (PID: ${activeProcess.pid})`,
      );
      await this.bringUnityToFront(activeProcess.pid);
      return 'skip';
    }

    const lockfilePath = join(projectPath, 'Temp', 'UnityLockfile');
    const hasLockfile = await pathExists(lockfilePath);
    if (!hasLockfile) {
      return 'allow';
    }

    console.log(`UnityLockfile found without active Unity process: ${lockfilePath}`);
    console.log('Assuming previous crash. Cleaning Temp directory and continuing launch.');

    try {
      await this.tempDirectoryCleaner.clean(projectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to clean Temp directory: ${message}`);
    }

    try {
      await rm(lockfilePath, { force: true });
      console.log('Deleted UnityLockfile.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete UnityLockfile: ${message}`);
    }

    console.log('Continuing launch.');
    return 'allow';
  }

  private async bringUnityToFront(pid: number): Promise<void> {
    if (process.platform !== 'darwin') {
      return;
    }

    try {
      const script = buildBringToFrontScript(pid);
      await execFileAsync('osascript', ['-e', script]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to bring Unity to front: ${message}`);
    }
  }
}

export class UnityLockStatusReader implements IUnityProjectLockReader {
  async isLocked(projectPath: string): Promise<boolean> {
    const lockfilePath = join(projectPath, 'Temp', 'UnityLockfile');
    return await pathExists(lockfilePath);
  }
}
