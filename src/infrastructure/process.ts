import { spawn } from 'node:child_process';

import type { IProcessLauncher } from '../application/ports.js';
import { getMsysDisabledEnv } from '../presentation/utils/path.js';

export class NodeProcessLauncher implements IProcessLauncher {
  async launch(command: string, args: readonly string[], options?: { detached?: boolean }): Promise<void> {
    const detached = options?.detached ?? false;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        detached,
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
