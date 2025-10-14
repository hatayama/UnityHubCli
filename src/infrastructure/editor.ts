import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { IEditorPathResolver } from '../application/ports.js';
import type { EditorVersion } from '../domain/models.js';

const UNITY_EDITOR_BASE = '/Applications/Unity/Hub/Editor';
const UNITY_BINARY_PATH = 'Unity.app/Contents/MacOS/Unity';

export class MacEditorPathResolver implements IEditorPathResolver {
  async resolve(version: EditorVersion): Promise<string> {
    const editorPath = join(UNITY_EDITOR_BASE, version.value, UNITY_BINARY_PATH);

    try {
      await access(editorPath, constants.X_OK);
    } catch {
      throw new Error(`対応するUnity Editorが見つかりません（${version.value}）`);
    }

    return editorPath;
  }
}
