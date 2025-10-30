const homeDirectory: string = process.env.HOME ?? process.env.USERPROFILE ?? '';
const homePrefix: string = homeDirectory ? `${homeDirectory}/` : '';

export const shortenHomePath = (targetPath: string): string => {
  if (!homeDirectory) {
    return targetPath;
  }
  if (targetPath === homeDirectory) {
    return '~';
  }
  if (homePrefix && targetPath.startsWith(homePrefix)) {
    return `~/${targetPath.slice(homePrefix.length)}`;
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


