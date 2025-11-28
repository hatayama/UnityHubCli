import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { isGitBashEnvironment, getMsysDisabledEnv, buildCdCommand } from './path.js';

describe('isGitBashEnvironment', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables before each test
    delete process.env.MSYSTEM;
    delete process.env.SHELL;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns false on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.MSYSTEM = 'MINGW64';
    expect(isGitBashEnvironment()).toBe(false);
  });

  it('returns true when MSYSTEM is set to MINGW64', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.MSYSTEM = 'MINGW64';
    expect(isGitBashEnvironment()).toBe(true);
  });

  it('returns true when MSYSTEM is set to MINGW32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.MSYSTEM = 'MINGW32';
    expect(isGitBashEnvironment()).toBe(true);
  });

  it('returns true when MSYSTEM is set to MSYS', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.MSYSTEM = 'MSYS';
    expect(isGitBashEnvironment()).toBe(true);
  });

  it('returns false when only SHELL contains bash (avoids false positives)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.SHELL = '/usr/bin/bash';
    expect(isGitBashEnvironment()).toBe(false);
  });

  it('returns false on Windows without MSYSTEM (e.g., PowerShell, CMD)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(isGitBashEnvironment()).toBe(false);
  });

  it('returns false on Windows with WSL-like SHELL but no MSYSTEM', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.SHELL = '/bin/bash';
    expect(isGitBashEnvironment()).toBe(false);
  });
});

describe('getMsysDisabledEnv', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MSYSTEM;
    delete process.env.MSYS_NO_PATHCONV;
    delete process.env.MSYS2_ARG_CONV_EXCL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns process.env unchanged when not in Git Bash', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const result = getMsysDisabledEnv();
    expect(result).toBe(process.env);
  });

  it('returns env with MSYS_NO_PATHCONV and MSYS2_ARG_CONV_EXCL when in Git Bash', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.MSYSTEM = 'MINGW64';
    const result = getMsysDisabledEnv();
    expect(result.MSYS_NO_PATHCONV).toBe('1');
    expect(result.MSYS2_ARG_CONV_EXCL).toBe('*');
  });

  it('preserves existing environment variables when in Git Bash', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.MSYSTEM = 'MINGW64';
    process.env.MY_CUSTOM_VAR = 'test_value';
    const result = getMsysDisabledEnv();
    expect(result.MY_CUSTOM_VAR).toBe('test_value');
  });
});

describe('buildCdCommand', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MSYSTEM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('on Windows with Git Bash (MSYSTEM set)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.MSYSTEM = 'MINGW64';
    });

    it('converts Windows path to MSYS path format', () => {
      const result = buildCdCommand('C:\\Users\\test\\project');
      expect(result).toBe("cd '/c/Users/test/project'");
    });

    it('handles lowercase drive letters', () => {
      const result = buildCdCommand('d:\\projects\\unity');
      expect(result).toBe("cd '/d/projects/unity'");
    });

    it('escapes single quotes in path', () => {
      const result = buildCdCommand("C:\\Users\\test's\\project");
      expect(result).toBe("cd '/c/Users/test'\\''s/project'");
    });

    it('handles paths with forward slashes', () => {
      const result = buildCdCommand('C:/Users/test/project');
      expect(result).toBe("cd '/c/Users/test/project'");
    });
  });

  describe('on Windows without Git Bash (PowerShell/CMD)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('uses double quotes for Windows paths', () => {
      const result = buildCdCommand('C:\\Users\\test\\project');
      expect(result).toBe('cd "C:\\Users\\test\\project"');
    });

    it('escapes double quotes in path', () => {
      const result = buildCdCommand('C:\\Users\\"test"\\project');
      expect(result).toBe('cd "C:\\Users\\""test""\\project"');
    });
  });

  describe('on Unix/macOS', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });

    it('uses single quotes for Unix paths', () => {
      const result = buildCdCommand('/Users/test/project');
      expect(result).toBe("cd '/Users/test/project'");
    });

    it('escapes single quotes in path', () => {
      const result = buildCdCommand("/Users/test's/project");
      expect(result).toBe("cd '/Users/test'\\''s/project'");
    });
  });
});
