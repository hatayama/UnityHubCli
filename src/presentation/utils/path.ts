const homeDirectory: string = process.env.HOME ?? process.env.USERPROFILE ?? '';
const normalizedHomeDirectory: string = homeDirectory.replace(/\\/g, '/');
const homePrefix: string = normalizedHomeDirectory ? `${normalizedHomeDirectory}/` : '';

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
    const escapedForWindows: string = targetPath.replace(/"/g, '""');
    return `cd "${escapedForWindows}"`;
  }
  const escapedForPosix: string = targetPath.replace(/'/g, "'\\''");
  return `cd '${escapedForPosix}'`;
};


