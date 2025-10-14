import { Box, Text, useApp, useInput, useStdout } from 'ink';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProjectView } from '../application/usecases.js';
import { LaunchCancelledError } from '../application/usecases.js';
import type { GitBranch, GitRepositoryInfo, UnityProject } from '../domain/models.js';

const extractRootFolder = (repository?: GitRepositoryInfo): string | undefined => {
  if (!repository?.root) {
    return undefined;
  }

  const segments = repository.root.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  return segments[segments.length - 1];
};

const formatProjectName = (
  project: UnityProject,
  repository: GitRepositoryInfo | undefined,
  useGitRootName: boolean,
): string => {
  if (!useGitRootName) {
    return `${project.title} (${project.version.value})`;
  }

  const rootFolder = extractRootFolder(repository);
  if (!rootFolder) {
    return `${project.title} (${project.version.value})`;
  }

  return `${rootFolder} (${project.version.value})`;
};

const formatBranch = (branch?: GitBranch): string => {
  if (!branch) {
    return '-';
  }
  if (branch.type === 'branch') {
    return branch.name;
  }
  return `detached@${branch.sha}`;
};

const homeDirectory = process.env.HOME ?? '';
const homePrefix = homeDirectory ? `${homeDirectory}/` : '';
const minimumVisibleProjectCount: number = 4;
const defaultHintMessage = 'Move with arrows or j/k · Launch with o · Exit with Ctrl+C twice';
const PROJECT_COLOR = '#abd8e7';
const BRANCH_COLOR = '#e3839c';
const PATH_COLOR = '#719bd8';

const shortenHomePath = (targetPath: string): string => {
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

type AppProps = {
  readonly projects: readonly ProjectView[];
  readonly onLaunch: (project: UnityProject) => Promise<void>;
  readonly useGitRootName?: boolean;
  readonly showBranch?: boolean;
  readonly showPath?: boolean;
};

export const App: React.FC<AppProps> = ({
  projects,
  onLaunch,
  useGitRootName = true,
  showBranch = true,
  showPath = true,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [visibleCount, setVisibleCount] = useState<number>(minimumVisibleProjectCount);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState<string>('Move with j/k · Launch with o · Exit with Ctrl+C twice');
  const [pendingExit, setPendingExit] = useState(false);
  const linesPerProject = (showBranch ? 1 : 0) + (showPath ? 1 : 0) + 2;

  const sortedProjects = useMemo(() => {
    const fallbackTime = 0;
    const toSortKey = (view: ProjectView): string => {
      if (useGitRootName) {
        const rootName = extractRootFolder(view.repository);
        if (rootName) {
          return rootName.toLocaleLowerCase();
        }
      }
      return view.project.title.toLocaleLowerCase();
    };

    const toTieBreaker = (view: ProjectView): string => view.project.path.toLocaleLowerCase();

    return [...projects].sort((a, b) => {
      if (a.project.favorite !== b.project.favorite) {
        return a.project.favorite ? -1 : 1;
      }

      const timeA = a.project.lastModified?.getTime() ?? fallbackTime;
      const timeB = b.project.lastModified?.getTime() ?? fallbackTime;
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      const keyA = toSortKey(a);
      const keyB = toSortKey(b);
      if (keyA === keyB) {
        return toTieBreaker(a).localeCompare(toTieBreaker(b));
      }
      return keyA.localeCompare(keyB);
    });
  }, [projects, useGitRootName]);

  useEffect(() => {
    const handleSigint = () => {
      if (!pendingExit) {
        setPendingExit(true);
        setHint('Press Ctrl+C again to exit');
        setTimeout(() => {
          setPendingExit(false);
          setHint(defaultHintMessage);
        }, 2000);
        return;
      }
      exit();
    };

    process.on('SIGINT', handleSigint);

    return () => {
      process.off('SIGINT', handleSigint);
    };
  }, [exit, pendingExit]);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (!stdout || typeof stdout.columns !== 'number' || typeof stdout.rows !== 'number') {
        setVisibleCount(minimumVisibleProjectCount);
        return;
      }

      const reservedRows = 6;
      const availableRows = stdout.rows - reservedRows;
      const rowsPerProject = Math.max(linesPerProject, 1);
      const calculatedCount = Math.max(
        minimumVisibleProjectCount,
        Math.floor(availableRows / rowsPerProject),
      );
      setVisibleCount(calculatedCount);
    };

    updateVisibleCount();
    stdout?.on('resize', updateVisibleCount);

    return () => {
      stdout?.off('resize', updateVisibleCount);
    };
  }, [linesPerProject, stdout]);

  const move = useCallback(
    (delta: number) => {
      setIndex((prev) => {
        if (sortedProjects.length === 0) {
          return 0;
        }

        let next = prev + delta;
        if (next < 0) {
          next = 0;
        }
        if (next >= sortedProjects.length) {
          next = sortedProjects.length - 1;
        }
        return next;
      });
    },
    [sortedProjects.length],
  );

  const launchSelected = useCallback(async () => {
    const project = sortedProjects[index]?.project;
    if (!project) {
      return;
    }

    try {
      await onLaunch(project);
      setHint(`Launched Unity: ${project.title}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
    } catch (error) {
      if (error instanceof LaunchCancelledError) {
        setHint('Launch cancelled');
        setTimeout(() => {
          setHint(defaultHintMessage);
        }, 3000);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setHint(`Failed to launch: ${message}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
    }
  }, [index, onLaunch, sortedProjects]);

  useInput((input, key) => {
    if (input === 'j' || key.downArrow) {
      move(1);
    }

    if (input === 'k' || key.upArrow) {
      move(-1);
    }

    if (input === 'o') {
      void launchSelected();
    }
  });

  const { startIndex, visibleProjects } = useMemo(() => {
    const limit = Math.max(minimumVisibleProjectCount, visibleCount);

    if (sortedProjects.length <= limit) {
      return {
        startIndex: 0,
        endIndex: sortedProjects.length,
        visibleProjects: sortedProjects,
      };
    }

    const halfWindow = Math.floor(limit / 2);
    let start = index - halfWindow;
    let end = index + halfWindow + (limit % 2);

    if (start < 0) {
      start = 0;
      end = limit;
    }

    if (end > sortedProjects.length) {
      end = sortedProjects.length;
      start = Math.max(0, end - limit);
    }

    return {
      startIndex: start,
      visibleProjects: sortedProjects.slice(start, end),
    };
  }, [index, sortedProjects, visibleCount]);

  const scrollbarChars = useMemo(() => {
    const totalProjects = projects.length;
    const totalLines = totalProjects * linesPerProject;
    const windowProjects = visibleProjects.length;
    const visibleLines = windowProjects * linesPerProject;

    if (totalLines === 0 || visibleLines === 0) {
      return [];
    }

    if (totalLines <= visibleLines) {
      return Array.from({ length: visibleLines }, () => '█');
    }

    const trackLength = visibleLines;
    const sliderSize = Math.max(1, Math.round((visibleLines / totalLines) * trackLength));
    const maxSliderStart = Math.max(0, trackLength - sliderSize);
    const topLine = startIndex * linesPerProject;
    const denominator = Math.max(1, totalLines - visibleLines);
    const sliderStart = Math.min(
      maxSliderStart,
      Math.round((topLine / denominator) * maxSliderStart),
    );

    return Array.from({ length: trackLength }, (_, position) => {
      if (position >= sliderStart && position < sliderStart + sliderSize) {
        return '█';
      }
      return '|';
    });
  }, [linesPerProject, projects.length, startIndex, visibleProjects]);

  const rows = useMemo(() => {
    return visibleProjects.map(({ project, repository }, offset) => {
      const rowIndex = startIndex + offset;
      const isSelected = rowIndex === index;
      const arrow: string = isSelected ? '>' : ' ';
      const titleLine: string = formatProjectName(project, repository, useGitRootName);
      const pathLine: string = shortenHomePath(project.path);
      const branchLine: string = formatBranch(repository?.branch);
      const baseScrollbarIndex = offset * linesPerProject;
      const titleScrollbar = scrollbarChars[baseScrollbarIndex] ?? ' ';
      const branchScrollbar = showBranch ? scrollbarChars[baseScrollbarIndex + 1] ?? ' ' : ' ';
      const pathScrollbar = showPath
        ? scrollbarChars[baseScrollbarIndex + 1 + (showBranch ? 1 : 0)] ?? ' '
        : ' ';
      const spacerScrollbar = scrollbarChars[baseScrollbarIndex + linesPerProject - 1] ?? ' ';

      const versionStart = titleLine.indexOf('(');
      const versionText = versionStart >= 0 ? titleLine.slice(versionStart) : '';
      const nameText = versionStart >= 0 ? titleLine.slice(0, versionStart).trimEnd() : titleLine;

      return (
        <Box key={project.id} flexDirection="row">
          <Box flexGrow={1} flexDirection="column">
            <Text>
              <Text color={isSelected ? 'green' : PROJECT_COLOR} bold>
                {arrow} {nameText}
              </Text>
              {versionText ? <Text color={isSelected ? 'green' : undefined}> {versionText}</Text> : null}
            </Text>
            {showBranch ? (
              <Text color={isSelected ? 'green' : BRANCH_COLOR}>
                {'  '}
                {branchLine}
              </Text>
            ) : null}
            {showPath ? (
              <Text color={isSelected ? 'green' : PATH_COLOR}>
                {'  '}
                {pathLine}
              </Text>
            ) : null}
            <Text> </Text>
          </Box>
          <Box marginLeft={1} width={1} flexDirection="column" alignItems="center">
            <Text>{titleScrollbar}</Text>
            {showBranch ? <Text>{branchScrollbar}</Text> : null}
            {showPath ? <Text>{pathScrollbar}</Text> : null}
            <Text>{spacerScrollbar}</Text>
          </Box>
        </Box>
      );
    });
  }, [index, scrollbarChars, showBranch, showPath, startIndex, useGitRootName, visibleProjects]);

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor="green">
        {rows.length === 0 ? (
          <Text>Unity Hubのプロジェクトが見つかりませんでした</Text>
        ) : (
          rows
        )}
      </Box>
      <Box marginTop={1}>
        <Text>{hint}</Text>
      </Box>
    </Box>
  );
};
