import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import type {
  IUnityProcessReader,
  IUnityProcessTerminator,
} from '../application/ports.js';
import type { UnityProcess } from '../domain/models.js';

const execFileAsync = promisify(execFile);

const UNITY_EXECUTABLE_PATTERN = /Unity\.app\/Contents\/MacOS\/Unity/i;
const PROJECT_PATH_PATTERN = /-(?:projectPath|projectpath)(?:=|\s+)("[^"]+"|'[^']+'|[^\s"']+)/i;
const PROCESS_LIST_ARGS = ['-axo', 'pid=,command=', '-ww'];
const PROCESS_LIST_COMMAND = 'ps';
const TERMINATE_TIMEOUT_MILLIS = 5_000;
const TERMINATE_POLL_INTERVAL_MILLIS = 200;
const GRACEFUL_QUIT_TIMEOUT_MILLIS = 3_000;
const GRACEFUL_QUIT_POLL_INTERVAL_MILLIS = 200;

const delay = async (duration: number): Promise<void> => {
  await new Promise<void>((resolveDelay) => {
    setTimeout(() => {
      resolveDelay();
    }, duration);
  });
};

const normalizePath = (target: string): string => {
  const resolved = resolve(target);
  if (resolved.endsWith('/')) {
    return resolved.slice(0, -1);
  }
  return resolved;
};

const arePathsEqual = (left: string, right: string): boolean => {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return normalizedLeft.localeCompare(normalizedRight, undefined, { sensitivity: 'base' }) === 0;
};

const extractProjectPath = (command: string): string | undefined => {
  const match = command.match(PROJECT_PATH_PATTERN);
  if (!match) {
    return undefined;
  }

  const raw = match[1];
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const isUnityMainProcess = (command: string): boolean => {
  return UNITY_EXECUTABLE_PATTERN.test(command);
};

const isUnityAuxiliaryProcess = (command: string): boolean => {
  const normalized = command.toLowerCase();
  if (normalized.includes('-batchmode')) {
    return true;
  }
  return normalized.includes('assetimportworker');
};

const isProcessMissingError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const nodeError = error as NodeJS.ErrnoException;
  return nodeError.code === 'ESRCH';
};

const ensureProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isProcessMissingError(error)) {
      return false;
    }
    throw error;
  }
};

export class MacUnityProcessReader implements IUnityProcessReader {
  async findByProjectPath(projectPath: string): Promise<UnityProcess | undefined> {
    const normalizedTarget = normalizePath(projectPath);
    const processes = await this.listUnityProcesses();

    return processes.find((candidate) => arePathsEqual(candidate.projectPath, normalizedTarget));
  }

  private async listUnityProcesses(): Promise<UnityProcess[]> {
    let stdout: string;
    try {
      const result = await execFileAsync(PROCESS_LIST_COMMAND, PROCESS_LIST_ARGS);
      stdout = result.stdout;
    } catch (error) {
      throw new Error(`Failed to retrieve Unity process list: ${error instanceof Error ? error.message : String(error)}`);
    }

    const lines = stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

    return lines
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        if (!match) {
          return undefined;
        }

        const pidValue = Number.parseInt(match[1] ?? '', 10);
        if (!Number.isFinite(pidValue)) {
          return undefined;
        }

        const command = match[2] ?? '';
        if (!isUnityMainProcess(command)) {
          return undefined;
        }
        if (isUnityAuxiliaryProcess(command)) {
          return undefined;
        }

        const projectArgument = extractProjectPath(command);
        if (!projectArgument) {
          return undefined;
        }

        return {
          pid: pidValue,
          projectPath: normalizePath(projectArgument),
        } satisfies UnityProcess;
      })
      .filter((process): process is UnityProcess => Boolean(process));
  }
}

export class MacUnityProcessTerminator implements IUnityProcessTerminator {
  async terminate(
    unityProcess: UnityProcess,
  ): Promise<{ readonly terminated: boolean; readonly stage?: 'graceful' | 'sigterm' | 'sigkill' }> {
    // Try graceful quit on macOS first (simulate Command+Q to trigger Unity's own cleanup)
    let attemptedGraceful: boolean = false;
    if (process.platform === 'darwin') {
      attemptedGraceful = true;
      try {
        const script = [
          'tell application "System Events"',
          `  set frontmost of (first process whose unix id is ${unityProcess.pid}) to true`,
          '  keystroke "q" using {command down}',
          'end tell',
        ].join('\n');
        await execFileAsync('osascript', ['-e', script]);

        const deadlineGraceful = Date.now() + GRACEFUL_QUIT_TIMEOUT_MILLIS;
        while (Date.now() < deadlineGraceful) {
          await delay(GRACEFUL_QUIT_POLL_INTERVAL_MILLIS);
          const alive = ensureProcessAlive(unityProcess.pid);
          if (!alive) {
            return { terminated: true, stage: 'graceful' };
          }
        }
      } catch {
        // Ignore AppleScript errors and fall back to SIGTERM
      }
    }

    // Stage 2: SIGTERM (gentle termination)
    try {
      process.kill(unityProcess.pid, 'SIGTERM');
    } catch (error) {
      if (isProcessMissingError(error)) {
        // Process already exited, likely due to the graceful attempt
        return { terminated: true, stage: attemptedGraceful ? 'graceful' : 'sigterm' };
      }
      throw new Error(
        `Failed to terminate the Unity process (PID: ${unityProcess.pid}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const deadline = Date.now() + TERMINATE_TIMEOUT_MILLIS;
    while (Date.now() < deadline) {
      await delay(TERMINATE_POLL_INTERVAL_MILLIS);
      const alive = ensureProcessAlive(unityProcess.pid);
      if (!alive) {
        return { terminated: true, stage: 'sigterm' };
      }
    }

    // Stage 3: SIGKILL (forceful termination)
    try {
      process.kill(unityProcess.pid, 'SIGKILL');
    } catch (error) {
      if (isProcessMissingError(error)) {
        return { terminated: true, stage: 'sigkill' };
      }
      throw new Error(
        `Failed to forcefully terminate the Unity process (PID: ${unityProcess.pid}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await delay(TERMINATE_POLL_INTERVAL_MILLIS);
    const aliveAfterKill = ensureProcessAlive(unityProcess.pid);
    return aliveAfterKill ? { terminated: false } : { terminated: true, stage: 'sigkill' };
  }
}
