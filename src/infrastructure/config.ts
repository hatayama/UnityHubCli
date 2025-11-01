import { mkdir, readFile, writeFile } from 'node:fs/promises';

export type SortPrimary = 'updated' | 'name';
export type SortDirection = 'asc' | 'desc';

export type SortPreferences = {
  readonly favoritesFirst: boolean;
  readonly primary: SortPrimary;
  readonly direction: SortDirection;
};

export type VisibilityPreferences = {
  readonly showBranch: boolean;
  readonly showPath: boolean;
};

export type AppConfig = {
  readonly sort: SortPreferences;
  readonly visibility: VisibilityPreferences;
};

const defaultSortPreferences: SortPreferences = {
  favoritesFirst: true,
  primary: 'updated',
  direction: 'desc',
};

const defaultVisibilityPreferences: VisibilityPreferences = {
  showBranch: true,
  showPath: true,
};

const defaultAppConfig: AppConfig = {
  sort: defaultSortPreferences,
  visibility: defaultVisibilityPreferences,
};

const getConfigDir = (): string => {
  if (process.platform === 'win32') {
    const appdata: string = process.env.APPDATA ?? '';
    return appdata ? `${appdata}\\UnityHubCli` : 'UnityHubCli';
  }
  const home: string = process.env.HOME ?? '';
  return `${home}/Library/Application Support/UnityHubCli`;
};

const getConfigPath = (): string => `${getConfigDir()}/config.json`;

const isValidPrimary = (value: unknown): value is SortPrimary => value === 'updated' || value === 'name';
const isValidDirection = (value: unknown): value is SortDirection => value === 'asc' || value === 'desc';

const sanitizeSort = (input: unknown): SortPreferences => {
  if (!input || typeof input !== 'object') {
    return defaultSortPreferences;
  }

  const record = input as Record<string, unknown>;
  const favoritesFirst: boolean = typeof record.favoritesFirst === 'boolean' ? record.favoritesFirst : defaultSortPreferences.favoritesFirst;
  const primary: SortPrimary = isValidPrimary(record.primary) ? record.primary : defaultSortPreferences.primary;
  const direction: SortDirection = isValidDirection(record.direction) ? record.direction : defaultSortPreferences.direction;

  return { favoritesFirst, primary, direction };
};

const sanitizeVisibility = (input: unknown): VisibilityPreferences => {
  if (!input || typeof input !== 'object') {
    return defaultVisibilityPreferences;
  }
  const record = input as Record<string, unknown>;
  const showBranch: boolean = typeof record.showBranch === 'boolean' ? record.showBranch : defaultVisibilityPreferences.showBranch;
  const showPath: boolean = typeof record.showPath === 'boolean' ? record.showPath : defaultVisibilityPreferences.showPath;
  return { showBranch, showPath };
};

const sanitizeAppConfig = (input: unknown): AppConfig => {
  if (!input || typeof input !== 'object') {
    return defaultAppConfig;
  }
  const record = input as Record<string, unknown>;
  const sort: SortPreferences = sanitizeSort(record.sort);
  const visibility: VisibilityPreferences = sanitizeVisibility(record.visibility);
  return { sort, visibility };
};

const readAppConfig = async (): Promise<AppConfig> => {
  try {
    const content = await readFile(getConfigPath(), 'utf8');
    const json = JSON.parse(content) as unknown;
    return sanitizeAppConfig(json);
  } catch {
    return defaultAppConfig;
  }
};

const writeAppConfig = async (config: AppConfig): Promise<void> => {
  try {
    await mkdir(getConfigDir(), { recursive: true });
  } catch {
    // ignore mkdir error (we'll try writing anyway)
  }
  const json = JSON.stringify(sanitizeAppConfig(config), undefined, 2);
  await writeFile(getConfigPath(), json, 'utf8');
};

export const readSortPreferences = async (): Promise<SortPreferences> => {
  const config = await readAppConfig();
  return config.sort;
};

export const writeSortPreferences = async (prefs: SortPreferences): Promise<void> => {
  const current = await readAppConfig();
  const next: AppConfig = { ...current, sort: sanitizeSort(prefs) };
  await writeAppConfig(next);
};

export const getDefaultSortPreferences = (): SortPreferences => defaultSortPreferences;

export const readVisibilityPreferences = async (): Promise<VisibilityPreferences> => {
  const config = await readAppConfig();
  return config.visibility;
};

export const writeVisibilityPreferences = async (prefs: VisibilityPreferences): Promise<void> => {
  const current = await readAppConfig();
  const next: AppConfig = { ...current, visibility: sanitizeVisibility(prefs) };
  await writeAppConfig(next);
};

export const getDefaultVisibilityPreferences = (): VisibilityPreferences => defaultVisibilityPreferences;

