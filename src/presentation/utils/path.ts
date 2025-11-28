const homeDirectory: string = process.env.HOME ?? process.env.USERPROFILE ?? '';
const normalizedHomeDirectory: string = homeDirectory.replace(/\\/g, '/');
const homePrefix: string = normalizedHomeDirectory ? `${normalizedHomeDirectory}/` : '';

/**
 * Detects if the current environment is Git Bash (MSYS/MINGW64).
 * Used to determine if MSYS path conversion should be disabled.
 */
export const isGitBashEnvironment = (): boolean => {
  if (process.platform !== 'win32') {
    return false;
  }
  return Boolean(process.env.MSYSTEM) || /bash/i.test(process.env.SHELL ?? '');
};

/**
 * Returns environment variables with MSYS path conversion disabled.
 * Use this when spawning Windows executables from Git Bash to prevent
 * automatic path conversion (e.g., C:\path being converted to /c/path).
 */
export const getMsysDisabledEnv = (): NodeJS.ProcessEnv => {
  if (!isGitBashEnvironment()) {
    return process.env;
  }
  return {
    ...process.env,
    MSYS_NO_PATHCONV: '1',
    MSYS2_ARG_CONV_EXCL: '*',
  };
};

export const shortenHomePath = (targetPath: string): string => {
  if (!normalizedHomeDirectory) {
    return targetPath;
  }
  const normalizedTarget: string = targetPath.replace(/\\/g, '/');
  if (normalizedTarget === normalizedHomeDirectory) {
    return '~';
  }
  if (homePrefix && normalizedTarget.startsWith(homePrefix)) {
    return `~/${normalizedTarget.slice(homePrefix.length)}`;
  }
  return targetPath;
};

export const buildCdCommand = (targetPath: string): string => {
  if (process.platform === 'win32') {
    const isGitBash: boolean = Boolean(process.env.MSYSTEM) || /bash/i.test(process.env.SHELL ?? '');
    if (isGitBash) {
      const windowsPath: string = targetPath;
      const msysPath: string = windowsPath
        .replace(/^([A-Za-z]):[\\/]/, (_, drive: string) => `/${drive.toLowerCase()}/`)
        .replace(/\\/g, '/');
      const escapedForPosix: string = msysPath.replace(/'/g, "'\\''");
      return `cd '${escapedForPosix}'`;
    }
    const escapedForWindows: string = targetPath.replace(/"/g, '""');
    return `cd "${escapedForWindows}"`;
  }
  const escapedForPosix: string = targetPath.replace(/'/g, "'\\''");
  return `cd '${escapedForPosix}'`;
};


