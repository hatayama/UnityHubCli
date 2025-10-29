import { mkdir, readFile, writeFile } from 'node:fs/promises';

export type SortPrimary = 'updated' | 'name';
export type SortDirection = 'asc' | 'desc';

export type SortPreferences = {
  readonly favoritesFirst: boolean;
  readonly primary: SortPrimary;
  readonly direction: SortDirection;
};

const defaultPreferences: SortPreferences = {
  favoritesFirst: true,
  primary: 'updated',
  direction: 'desc',
};

const getConfigDir = (): string => {
  const home: string = process.env.HOME ?? '';
  return `${home}/Library/Application Support/UnityHubCli`;
};

const getConfigPath = (): string => `${getConfigDir()}/config.json`;

const isValidPrimary = (value: unknown): value is SortPrimary => value === 'updated' || value === 'name';
const isValidDirection = (value: unknown): value is SortDirection => value === 'asc' || value === 'desc';

const sanitizePreferences = (input: unknown): SortPreferences => {
  if (!input || typeof input !== 'object') {
    return defaultPreferences;
  }

  const record = input as Record<string, unknown>;
  const favoritesFirst: boolean = typeof record.favoritesFirst === 'boolean' ? record.favoritesFirst : defaultPreferences.favoritesFirst;
  const primary: SortPrimary = isValidPrimary(record.primary) ? record.primary : defaultPreferences.primary;
  const direction: SortDirection = isValidDirection(record.direction) ? record.direction : defaultPreferences.direction;

  return { favoritesFirst, primary, direction };
};

export const readSortPreferences = async (): Promise<SortPreferences> => {
  try {
    const content = await readFile(getConfigPath(), 'utf8');
    const json = JSON.parse(content) as unknown;
    return sanitizePreferences(json);
  } catch {
    return defaultPreferences;
  }
};

export const writeSortPreferences = async (prefs: SortPreferences): Promise<void> => {
  try {
    await mkdir(getConfigDir(), { recursive: true });
  } catch {
    // ignore mkdir error (we'll try writing anyway)
  }

  const sanitized = sanitizePreferences(prefs);
  const json = JSON.stringify(sanitized, undefined, 2);
  await writeFile(getConfigPath(), json, 'utf8');
};

export const getDefaultSortPreferences = (): SortPreferences => defaultPreferences;


