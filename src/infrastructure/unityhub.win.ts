import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { IUnityHubProjectsReader, IUnityProjectOptionsReader } from '../application/ports.js';
import type { UnityProject } from '../domain/models.js';

const HUB_DIR = join(process.env.APPDATA ?? '', 'UnityHub');
const HUB_PROJECTS_PATH = join(HUB_DIR, 'projects-v1.json');

type UnityHubProjectEntry = {
  readonly title?: string | null;
  readonly path: string;
  readonly version: string;
  readonly lastModified?: number | null;
  readonly isFavorite?: boolean | null;
};

type UnityHubProjectsJson = {
  readonly schema_version?: string;
  readonly data?: Record<string, UnityHubProjectEntry>;
};

type ProjectsInfoJson = Record<string, { cliArgs?: string }>;

const schemaVersion = 'v1';

const toUnityProject = (entry: UnityHubProjectEntry): UnityProject => {
  const safePath = entry.path;
  if (!safePath) {
    throw new Error('Unity Hub entry is missing project path');
  }

  const version = entry.version;
  if (!version) {
    throw new Error(`Unity Hub entry ${safePath} is missing version`);
  }

  const lastModified = typeof entry.lastModified === 'number' ? new Date(entry.lastModified) : undefined;

  return {
    id: safePath,
    title: entry.title?.trim() || basename(safePath),
    path: safePath,
    version: { value: version },
    lastModified,
    favorite: entry.isFavorite === true,
  };
};

const normalizeValue = (value: string): string => value.toLocaleLowerCase();

const sortByFavoriteThenLastModified = (projects: readonly UnityProject[]): UnityProject[] => {
  return [...projects].sort((a, b) => {
    const favoriteRankA = a.favorite ? 0 : 1;
    const favoriteRankB = b.favorite ? 0 : 1;
    if (favoriteRankA !== favoriteRankB) {
      return favoriteRankA - favoriteRankB;
    }

    const fallbackTime = 0;
    const timeA = a.lastModified?.getTime() ?? fallbackTime;
    const timeB = b.lastModified?.getTime() ?? fallbackTime;
    if (timeA === timeB) {
      const titleA = normalizeValue(a.title);
      const titleB = normalizeValue(b.title);
      if (titleA === titleB) {
        return normalizeValue(a.path).localeCompare(normalizeValue(b.path));
      }
      return titleA.localeCompare(titleB);
    }
    return timeB - timeA;
  });
};

export class WinUnityHubProjectsReader implements IUnityHubProjectsReader, IUnityProjectOptionsReader {
  async listProjects(): Promise<UnityProject[]> {
    let content: string;
    try {
      content = await readFile(HUB_PROJECTS_PATH, 'utf8');
    } catch {
      throw new Error(
        `Unity Hub project list not found (${HUB_PROJECTS_PATH}).`,
      );
    }

    let json: UnityHubProjectsJson;
    try {
      json = JSON.parse(content) as UnityHubProjectsJson;
    } catch {
      throw new Error('Unable to read the Unity Hub project list (permissions/format error).');
    }

    if (json.schema_version && json.schema_version !== schemaVersion) {
      throw new Error(`Unsupported schema_version (${json.schema_version}).`);
    }

    const entries = Object.values(json.data ?? {});
    if (entries.length === 0) {
      return [];
    }

    const projects = entries.map(toUnityProject);
    return sortByFavoriteThenLastModified(projects);
  }

  async updateLastModified(projectPath: string, date: Date): Promise<void> {
    let content: string;
    try {
      content = await readFile(HUB_PROJECTS_PATH, 'utf8');
    } catch {
      throw new Error(
        `Unity Hub project list not found (${HUB_PROJECTS_PATH}).`,
      );
    }

    let json: UnityHubProjectsJson;
    try {
      json = JSON.parse(content) as UnityHubProjectsJson;
    } catch {
      throw new Error('Unable to read the Unity Hub project list (permissions/format error).');
    }

    if (!json.data) {
      return;
    }

    const projectKey = Object.keys(json.data).find((key) => json.data?.[key]?.path === projectPath);
    if (!projectKey) {
      return;
    }

    const original = json.data[projectKey];
    if (!original) {
      return;
    }

    json.data[projectKey] = {
      ...original,
      lastModified: date.getTime(),
    };

    await writeFile(HUB_PROJECTS_PATH, JSON.stringify(json, undefined, 2), 'utf8');
  }

  async readCliArgs(projectPath: string): Promise<readonly string[]> {
    const infoPath = join(HUB_DIR, 'projectsInfo.json');

    let content: string;
    try {
      content = await readFile(infoPath, 'utf8');
    } catch {
      return [];
    }

    let json: ProjectsInfoJson;
    try {
      json = JSON.parse(content) as ProjectsInfoJson;
    } catch {
      return [];
    }

    const entry = json[projectPath];
    if (!entry?.cliArgs) {
      return [];
    }

    const tokens = entry.cliArgs.match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g);
    if (!tokens) {
      return [];
    }

    return tokens.map((token) => token.replace(/^['"]|['"]$/g, ''));
  }
}


