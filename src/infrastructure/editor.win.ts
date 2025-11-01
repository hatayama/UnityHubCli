import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { IEditorPathResolver } from '../application/ports.js';
import type { EditorVersion } from '../domain/models.js';

const buildCandidateBases = (): readonly string[] => {
  const candidates: string[] = [];
  const programFiles: string = process.env.PROGRAMFILES ?? 'C:\\Program Files';
  const programW6432: string | undefined = process.env.ProgramW6432 ?? process.env.PROGRAMFILES;
  const localAppData: string | undefined = process.env.LOCALAPPDATA;

  candidates.push(join(programFiles, 'Unity', 'Hub', 'Editor'));
  if (programW6432) {
    candidates.push(join(programW6432, 'Unity', 'Hub', 'Editor'));
  }
  if (localAppData) {
    candidates.push(join(localAppData, 'Unity', 'Hub', 'Editor'));
  }

  return Array.from(new Set(candidates));
};

export class WinEditorPathResolver implements IEditorPathResolver {
  async resolve(version: EditorVersion): Promise<string> {
    const tried: string[] = [];
    for (const base of buildCandidateBases()) {
      const candidate = join(base, version.value, 'Editor', 'Unity.exe');
      try {
        await access(candidate, constants.F_OK);
        return candidate;
      } catch {
        tried.push(candidate);
      }
    }
    throw new Error(`Unity Editor not found for version ${version.value}. Tried: ${tried.join(' , ')}`);
  }
}


