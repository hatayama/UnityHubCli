import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { IUnityTempDirectoryCleaner } from '../application/ports.js';

const TEMP_DIRECTORY_NAME = 'Temp';

export class UnityTempDirectoryCleaner implements IUnityTempDirectoryCleaner {
  async clean(projectPath: string): Promise<void> {
    const tempDirectoryPath = join(projectPath, TEMP_DIRECTORY_NAME);

    try {
      await rm(tempDirectoryPath, {
        recursive: true,
        force: true,
      });
    } catch {
      // rm with force=true should not throw, but guard just in case without interrupting the flow
    }
  }
}
