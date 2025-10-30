const homeDirectory: string = process.env.HOME ?? '';
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
  // User requested unquoted path in the cd command
  return `cd ${targetPath}`;
};


