import { execFile } from 'node:child_process';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import readline from 'node:readline';
import { promisify } from 'node:util';

import type {
  IUnityProcessLockChecker,
  IUnityProcessReader,
  IUnityProjectLockReader,
} from '../application/ports.js';

type PromptInterface = { rl: readline.Interface; close: () => void };

const RAW_PROMPT_MESSAGE = "Delete UnityLockfile and continue? Type 'y' to continue; anything else aborts: ";
const execFileAsync = promisify(execFile);

const buildBringToFrontScript = (pid: number): string => {
  return `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`;
};

const isRawModeSupported = (): boolean => {
  const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void };
  return Boolean(stdin?.isTTY && typeof stdin.setRawMode === 'function' && process.stdout.isTTY);
};

const createPromptInterface = (): PromptInterface | undefined => {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const close = (): void => rl.close();
    return { rl, close };
  }

  try {
    if (process.platform === 'win32') {
      const inCandidates = ['\\\\.\\CONIN$', 'CONIN$'];
      const outCandidates = ['\\\\.\\CONOUT$', 'CONOUT$'];
      for (const inPath of inCandidates) {
        for (const outPath of outCandidates) {
          try {
            const input = createReadStream(inPath);
            const output = createWriteStream(outPath);
            const rl = readline.createInterface({ input, output });
            const close = (): void => {
              rl.close();
              input.destroy();
              output.end();
            };
            return { rl, close };
          } catch {
            continue;
          }
        }
      }
    } else {
      const input = createReadStream('/dev/tty');
      const output = createWriteStream('/dev/tty');
      const rl = readline.createInterface({ input, output });
      const close = (): void => {
        rl.close();
        input.destroy();
        output.end();
      };
      return { rl, close };
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const promptYesNoSingleKey = async (): Promise<boolean> => {
  const stdin = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (mode: boolean) => void;
    isRaw?: boolean;
  };
  const supportsRaw = isRawModeSupported();
  const previousRaw = supportsRaw ? stdin.isRaw === true : false;
  const wasPaused = stdin.isPaused();

  return await new Promise<boolean>((resolve) => {
    const cleanup = (): void => {
      stdin.removeListener('data', handleData);
      if (wasPaused) {
        stdin.pause();
      }
      if (supportsRaw) {
        stdin.setRawMode(previousRaw);
      }
    };

    const handleData = (data: Buffer): void => {
      const char = data.toString();
      const firstByte = data[0] ?? 0;
      let result = false;

      if (char === 'y') {
        result = true;
      } else if (
        char === 'n' ||
        char === 'N' ||
        firstByte === 3 ||
        firstByte === 27 ||
        firstByte === 13
      ) {
        result = false;
      } else {
        result = false;
      }

      process.stdout.write('\n');
      cleanup();
      resolve(result);
    };

    process.stdout.write(RAW_PROMPT_MESSAGE);
    if (supportsRaw) {
      stdin.setRawMode(true);
    }
    if (wasPaused) {
      stdin.resume();
    }
    stdin.once('data', handleData);
  });
};

const promptYesNoLine = async (): Promise<boolean> => {
  const prompt = createPromptInterface();
  if (!prompt) {
    console.error('UnityLockfile exists. No interactive console available for confirmation.');
    return false;
  }

  const confirmed = await new Promise<boolean>((resolve) => {
    prompt.rl.question(RAW_PROMPT_MESSAGE, (answer: string) => {
      resolve(answer.trim() === 'y');
    });
  });

  prompt.close();
  return confirmed;
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
  constructor(private readonly unityProcessReader: IUnityProcessReader) {}

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

    console.log(`UnityLockfile found: ${lockfilePath}`);
    console.log('Another Unity process may be using this project.');

    const confirmed = isRawModeSupported()
      ? await promptYesNoSingleKey()
      : await promptYesNoLine();

    if (!confirmed) {
      console.log('Aborted by user.');
      return 'skip';
    }

    await rm(lockfilePath, { force: true });
    console.log('Deleted UnityLockfile. Continuing launch.');
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
