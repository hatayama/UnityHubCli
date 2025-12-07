import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import type { IUnityProcessReader, IUnityProcessTerminator } from '../application/ports.js';
import type { UnityProcess } from '../domain/models.js';
import { getMsysDisabledEnv } from '../presentation/utils/path.js';

const execFileAsync = promisify(execFile);

const PROJECT_PATH_PATTERN = /-(?:projectPath|projectpath)(?:=|\s+)("[^"]+"|'[^']+'|[^\s"']+)/i;
const TERMINATE_TIMEOUT_MILLIS = 5_000;
const TERMINATE_POLL_INTERVAL_MILLIS = 200;

const delay = async (duration: number): Promise<void> => {
  await new Promise<void>((resolveDelay) => {
    setTimeout(() => {
      resolveDelay();
    }, duration);
  });
};

const normalizePath = (target: string): string => {
  const resolved = resolve(target);
  if (resolved.endsWith('/') || resolved.endsWith('\\')) {
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
    return false;
  }
};

type PsProcessRow = {
  readonly ProcessId: number;
  readonly CommandLine?: string | null;
};

const parsePowershellJson = (jsonText: string): PsProcessRow[] => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed) {
      return [];
    }
    if (Array.isArray(parsed)) {
      return parsed.filter((r): r is PsProcessRow => r && typeof r === 'object' && typeof (r as PsProcessRow).ProcessId === 'number');
    }
    const single = parsed as Record<string, unknown>;
    if (typeof single.ProcessId === 'number') {
      return [single as unknown as PsProcessRow];
    }
    return [];
  } catch {
    return [];
  }
};

export class WinUnityProcessReader implements IUnityProcessReader {
  async findByProjectPath(projectPath: string): Promise<UnityProcess | undefined> {
    const normalizedTarget = normalizePath(projectPath);
    const processes = await this.listUnityProcesses();
    return processes.find((candidate) => arePathsEqual(candidate.projectPath, normalizedTarget));
  }

  private async listUnityProcesses(): Promise<UnityProcess[]> {
    const psCommand = [
      "$ErrorActionPreference = 'SilentlyContinue';",
      "$procs = Get-CimInstance Win32_Process -Filter \"Name='Unity.exe'\";",
      '$procs | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress',
    ].join(' ');

    let stdout: string;
    try {
      const result = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          psCommand,
        ],
        { encoding: 'utf8', env: getMsysDisabledEnv() },
      );
      stdout = (result.stdout ?? '').trim();
    } catch (error) {
      throw new Error(`Failed to retrieve Unity process list: ${error instanceof Error ? error.message : String(error)}`);
    }

    const rows = parsePowershellJson(stdout);
    return rows
      .map((row) => {
        const pidValue = row.ProcessId;
        if (!Number.isFinite(pidValue)) {
          return undefined;
        }
        const commandLine = row.CommandLine ?? '';
        const projectArgument = extractProjectPath(commandLine);
        if (!projectArgument) {
          return undefined;
        }
        return {
          pid: pidValue,
          projectPath: normalizePath(projectArgument),
        } satisfies UnityProcess;
      })
      .filter((p): p is UnityProcess => Boolean(p));
  }
}

export class WinUnityProcessTerminator implements IUnityProcessTerminator {
  async terminate(
    unityProcess: UnityProcess,
  ): Promise<{ readonly terminated: boolean; readonly stage?: 'graceful' | 'sigterm' | 'sigkill' }> {
    // Stage 1: Stop-Process (gentle)
    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Stop-Process -Id ${unityProcess.pid}`,
        ],
        { env: getMsysDisabledEnv() },
      );
    } catch {
      if (!ensureProcessAlive(unityProcess.pid)) {
        return { terminated: true, stage: 'sigterm' };
      }
      // fallthrough to force
    }

    const deadline = Date.now() + TERMINATE_TIMEOUT_MILLIS;
    while (Date.now() < deadline) {
      await delay(TERMINATE_POLL_INTERVAL_MILLIS);
      const alive = ensureProcessAlive(unityProcess.pid);
      if (!alive) {
        return { terminated: true, stage: 'sigterm' };
      }
    }

    // Stage 2: Stop-Process -Force
    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Stop-Process -Id ${unityProcess.pid} -Force`,
        ],
        { env: getMsysDisabledEnv() },
      );
    } catch {
      if (!ensureProcessAlive(unityProcess.pid)) {
        return { terminated: true, stage: 'sigkill' };
      }
      return { terminated: false };
    }

    await delay(TERMINATE_POLL_INTERVAL_MILLIS);
    const aliveAfterKill = ensureProcessAlive(unityProcess.pid);
    return aliveAfterKill ? { terminated: false } : { terminated: true, stage: 'sigkill' };
  }
}


