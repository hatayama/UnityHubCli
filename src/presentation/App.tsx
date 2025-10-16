import clipboard from 'clipboardy';
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
    return project.title;
  }

  const rootFolder = extractRootFolder(repository);
  if (!rootFolder) {
    return project.title;
  }

  return rootFolder;
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

const formatRelativeTime = (lastModified?: Date): string | undefined => {
  if (!lastModified) {
    return undefined;
  }

  const now: Date = new Date();
  const diffMillis: number = now.getTime() - lastModified.getTime();
  if (Number.isNaN(diffMillis)) {
    return undefined;
  }

  const safeMillis: number = Math.max(0, diffMillis);
  const secondsPerMinute: number = 60;
  const secondsPerHour: number = secondsPerMinute * 60;
  const secondsPerDay: number = secondsPerHour * 24;
  const secondsPerMonth: number = secondsPerDay * 30;
  const secondsPerYear: number = secondsPerDay * 365;
  const totalSeconds: number = Math.floor(safeMillis / 1000);

  if (totalSeconds < 45) {
    return 'a few seconds ago';
  }
  if (totalSeconds < 45 * secondsPerMinute) {
    const minutes: number = Math.max(1, Math.floor(totalSeconds / secondsPerMinute));
    const suffix: string = minutes === 1 ? 'minute' : 'minutes';
    return `${minutes} ${suffix} ago`;
  }
  if (totalSeconds < 30 * secondsPerHour) {
    const hours: number = Math.max(1, Math.floor(totalSeconds / secondsPerHour));
    const suffix: string = hours === 1 ? 'hour' : 'hours';
    return `${hours} ${suffix} ago`;
  }
  if (totalSeconds < secondsPerMonth) {
    const days: number = Math.max(1, Math.floor(totalSeconds / secondsPerDay));
    const suffix: string = days === 1 ? 'day' : 'days';
    return `${days} ${suffix} ago`;
  }
  if (totalSeconds < secondsPerYear) {
    const months: number = Math.max(1, Math.floor(totalSeconds / secondsPerMonth));
    const suffix: string = months === 1 ? 'month' : 'months';
    return `${months} ${suffix} ago`;
  }

  const years: number = Math.max(1, Math.floor(totalSeconds / secondsPerYear));
  const suffix: string = years === 1 ? 'year' : 'years';
  return `${years} ${suffix} ago`;
};

const UPDATED_LABEL = 'Last:';

const formatUpdatedText = (lastModified?: Date): string | undefined => {
  const relativeTime: string | undefined = formatRelativeTime(lastModified);
  if (!relativeTime) {
    return undefined;
  }
  return `${UPDATED_LABEL} ${relativeTime}`;
};

const homeDirectory = process.env.HOME ?? '';
const homePrefix = homeDirectory ? `${homeDirectory}/` : '';
const minimumVisibleProjectCount: number = 4;
const defaultHintMessage = 'Move with arrows or j/k · Launch & exit with o · Copy cd path with c · Exit with Ctrl+C twice';
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

const buildCdCommand = (targetPath: string): string => {
  const escapedPath = targetPath.replaceAll('"', '\\"');
  return `cd "${escapedPath}"`;
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
  const [hint, setHint] = useState<string>(defaultHintMessage);
  const [pendingExit, setPendingExit] = useState(false);
  const [windowStart, setWindowStart] = useState(0);
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

      const borderRows = 2;
      const hintRows = 1;
      const hintMarginRows = 1;
      const reservedRows = borderRows + hintRows + hintMarginRows;
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

  const limit = Math.max(minimumVisibleProjectCount, visibleCount);

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
      setWindowStart((prevStart) => {
        if (sortedProjects.length <= limit) {
          return 0;
        }

        const maxStart = Math.max(0, sortedProjects.length - limit);
        let nextStart = prevStart;

        if (delta > 0) {
          const nextIndex = Math.min(sortedProjects.length - 1, index + delta);
          if (nextIndex >= prevStart + limit) {
            nextStart = nextIndex - limit + 1;
          }
        } else if (delta < 0) {
          const nextIndex = Math.max(0, index + delta);
          if (nextIndex < prevStart) {
            nextStart = nextIndex;
          }
        }

        if (nextStart < 0) {
          nextStart = 0;
        }
        if (nextStart > maxStart) {
          nextStart = maxStart;
        }

        return nextStart;
      });
    },
    [index, limit, sortedProjects.length],
  );

  useEffect(() => {
    setWindowStart((prevStart) => {
      if (sortedProjects.length <= limit) {
        return prevStart === 0 ? prevStart : 0;
      }

      const maxStart = Math.max(0, sortedProjects.length - limit);
      let nextStart = prevStart;

      if (index < prevStart) {
        nextStart = index;
      } else if (index >= prevStart + limit) {
        nextStart = index - limit + 1;
      }

      if (nextStart < 0) {
        nextStart = 0;
      }
      if (nextStart > maxStart) {
        nextStart = maxStart;
      }

      return nextStart;
    });
  }, [index, limit, sortedProjects.length]);

  const copyProjectPath = useCallback(() => {
    const projectPath = sortedProjects[index]?.project.path;
    if (!projectPath) {
      setHint('No project to copy');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
      return;
    }

    try {
      const command = buildCdCommand(projectPath);
      clipboard.writeSync(command);
      const displayPath = shortenHomePath(projectPath);
      setHint(`Copied command: cd "${displayPath}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(`Failed to copy: ${message}`);
    }

    setTimeout(() => {
      setHint(defaultHintMessage);
    }, 2000);
  }, [index, sortedProjects]);

  const launchSelectedAndExit = useCallback(async () => {
    const projectView = sortedProjects[index];
    if (!projectView) {
      setHint('No project to launch');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
      return;
    }

    const { project } = projectView;
    try {
      const command = buildCdCommand(project.path);
      clipboard.writeSync(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(`Failed to copy: ${message}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
      return;
    }

    try {
      await onLaunch(project);
      stdout?.write('\u001B[2J\u001B[H');
      exit();
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
  }, [exit, index, onLaunch, sortedProjects, stdout]);

  useInput((input, key) => {
    if (input === 'j' || key.downArrow) {
      move(1);
    }

    if (input === 'k' || key.upArrow) {
      move(-1);
    }

    if (input === 'o') {
      void launchSelectedAndExit();
    }

    if (input === 'c') {
      copyProjectPath();
    }
  });

  const { startIndex, visibleProjects } = useMemo(() => {
    if (sortedProjects.length <= limit) {
      return {
        startIndex: 0,
        visibleProjects: sortedProjects,
      };
    }

    const maxStart = Math.max(0, sortedProjects.length - limit);
    const clampedStart = Math.min(Math.max(0, windowStart), maxStart);
    const end = Math.min(clampedStart + limit, sortedProjects.length);

    return {
      startIndex: clampedStart,
      visibleProjects: sortedProjects.slice(clampedStart, end),
    };
  }, [limit, sortedProjects, windowStart]);

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
      const projectName: string = formatProjectName(project, repository, useGitRootName);
      const versionLabel: string = `(${project.version.value})`;
      const updatedText: string | undefined = formatUpdatedText(project.lastModified);
      const pathLine: string = shortenHomePath(project.path);
      const branchLine: string = formatBranch(repository?.branch);
      const baseScrollbarIndex = offset * linesPerProject;
      const titleScrollbar = scrollbarChars[baseScrollbarIndex] ?? ' ';
      const branchScrollbar = showBranch ? scrollbarChars[baseScrollbarIndex + 1] ?? ' ' : ' ';
      const pathScrollbar = showPath
        ? scrollbarChars[baseScrollbarIndex + 1 + (showBranch ? 1 : 0)] ?? ' '
        : ' ';
      const spacerScrollbar = scrollbarChars[baseScrollbarIndex + linesPerProject - 1] ?? ' ';

      return (
        <Box key={project.id} flexDirection="row">
          <Box flexGrow={1} flexDirection="column">
            <Text>
              <Text color={isSelected ? 'green' : PROJECT_COLOR} bold>
                {arrow} {projectName}
              </Text>
              <Text color={isSelected ? 'green' : undefined}> {versionLabel}</Text>
              {updatedText ? (
                <Text color={isSelected ? 'green' : undefined}>{`  ${updatedText}`}</Text>
              ) : null}
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
