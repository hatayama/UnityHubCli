import clipboard from 'clipboardy';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { LaunchStatus, ProjectView } from '../application/usecases.js';
import { LaunchCancelledError } from '../application/usecases.js';
import type { GitBranch, GitRepositoryInfo, UnityProject } from '../domain/models.js';
import type { SortDirection, SortPreferences, SortPrimary } from '../infrastructure/config.js';
import { getDefaultSortPreferences, readSortPreferences, writeSortPreferences } from '../infrastructure/config.js';

type TerminateResult = { readonly terminated: boolean; readonly message?: string };

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
const defaultHintMessage =
  'Select: j/k · Open: o · Quit: q · Refresh: r · CopyPath: c · Sort: s · Close: ctrl + c';
const PROJECT_COLOR = '#abd8e7';
const BRANCH_COLOR = '#e3839c';
const PATH_COLOR = '#719bd8';
const LOCK_COLOR = 'yellow';
const STATUS_LABELS: Record<LaunchStatus, string> = {
  idle: '',
  running: '[running]',
  crashed: '[crash]',
};

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

// display width helpers to keep box borders aligned in terminals
const isControl = (code: number): boolean => (code >= 0 && code < 32) || (code >= 0x7f && code < 0xa0);
const isFullwidth = (code: number): boolean => {
  if (
    code >= 0x1100 &&
    (code <= 0x115f || // Hangul Jamo
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) || // CJK ... Yi
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xfe10 && code <= 0xfe19) || // Vertical forms
      (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
      (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1f64f) || // Emojis
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      (code >= 0x20000 && code <= 0x3fffd))
  ) {
    return true;
  }
  return false;
};
const charWidth = (char: string): number => {
  const code = char.codePointAt(0);
  if (code === undefined) return 0;
  if (isControl(code)) return 0;
  return isFullwidth(code) ? 2 : 1;
};
const stringWidth = (text: string): number => {
  let width = 0;
  for (const ch of text) {
    width += charWidth(ch);
  }
  return width;
};
const truncateToWidth = (text: string, maxWidth: number): string => {
  let width = 0;
  let result = '';
  for (const ch of text) {
    const w = charWidth(ch);
    if (width + w > maxWidth) break;
    result += ch;
    width += w;
  }
  return result;
};

type AppProps = {
  readonly projects: readonly ProjectView[];
  readonly onLaunch: (project: UnityProject) => Promise<void>;
  readonly onTerminate: (project: UnityProject) => Promise<TerminateResult>;
  readonly onRefresh?: () => Promise<ProjectView[]>;
  readonly useGitRootName?: boolean;
  readonly showBranch?: boolean;
  readonly showPath?: boolean;
};

export const App: React.FC<AppProps> = ({
  projects,
  onLaunch,
  onTerminate,
  onRefresh,
  useGitRootName = true,
  showBranch = true,
  showPath = true,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [projectViews, setProjectViews] = useState<readonly ProjectView[]>(projects);
  const [visibleCount, setVisibleCount] = useState<number>(minimumVisibleProjectCount);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState<string>(defaultHintMessage);
  const [windowStart, setWindowStart] = useState(0);
  const [releasedProjects, setReleasedProjects] = useState<ReadonlySet<string>>(new Set());
  const [launchedProjects, setLaunchedProjects] = useState<ReadonlySet<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortMenuIndex, setSortMenuIndex] = useState(0);
  const [sortPreferences, setSortPreferences] = useState<SortPreferences>(getDefaultSortPreferences());
  const [renderEpoch, setRenderEpoch] = useState(0);
  const linesPerProject = (showBranch ? 1 : 0) + (showPath ? 1 : 0) + 2;

  const forceFullRepaint = useCallback((): void => {
    if (!stdout) {
      return;
    }
    // Clear entire screen and scrollback, move cursor to home.
    stdout.write('\x1B[2J\x1B[3J\x1B[H');
  }, [stdout]);

  const sortedProjects = useMemo(() => {
    const fallbackTime = 0;

    const getNameKey = (view: ProjectView): string => {
      const rootName = extractRootFolder(view.repository);
      const base = rootName || view.project.title;
      return base.toLocaleLowerCase();
    };

    const tieBreaker = (view: ProjectView): string => view.project.path.toLocaleLowerCase();

    const compareByUpdated = (a: ProjectView, b: ProjectView, direction: SortDirection): number => {
      const timeA = a.project.lastModified?.getTime() ?? fallbackTime;
      const timeB = b.project.lastModified?.getTime() ?? fallbackTime;
      if (timeA === timeB) {
        return 0;
      }
      return direction === 'desc' ? timeB - timeA : timeA - timeB;
    };

    const compareByName = (a: ProjectView, b: ProjectView, direction: SortDirection): number => {
      const keyA = getNameKey(a);
      const keyB = getNameKey(b);
      if (keyA === keyB) {
        return 0;
      }
      return direction === 'desc' ? keyB.localeCompare(keyA) : keyA.localeCompare(keyB);
    };

    return [...projectViews].sort((a, b) => {
      if (sortPreferences.favoritesFirst && a.project.favorite !== b.project.favorite) {
        return a.project.favorite ? -1 : 1;
      }

      const primary: SortPrimary = sortPreferences.primary;
      const direction: SortDirection = sortPreferences.direction;

      if (primary === 'updated') {
        const updatedOrder = compareByUpdated(a, b, direction);
        if (updatedOrder !== 0) {
          return updatedOrder;
        }
        const nameOrder = compareByName(a, b, 'asc');
        if (nameOrder !== 0) {
          return nameOrder;
        }
        return tieBreaker(a).localeCompare(tieBreaker(b));
      }

      const nameOrder = compareByName(a, b, direction);
      if (nameOrder !== 0) {
        return nameOrder;
      }
      const updatedOrder = compareByUpdated(a, b, 'desc');
      if (updatedOrder !== 0) {
        return updatedOrder;
      }
      return tieBreaker(a).localeCompare(tieBreaker(b));
    });
  }, [projectViews, sortPreferences]);

  useEffect(() => {
    void (async () => {
      try {
        const prefs = await readSortPreferences();
        setSortPreferences(prefs);
      } catch {
        // ignore and keep defaults
      }
    })();
  }, []);

  useEffect(() => {
    void writeSortPreferences(sortPreferences);
  }, [sortPreferences]);

  useEffect(() => {
    const handleSigint = () => {
      exit();
    };

    process.on('SIGINT', handleSigint);

    return () => {
      process.off('SIGINT', handleSigint);
    };
  }, [exit]);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (!stdout || typeof stdout.columns !== 'number' || typeof stdout.rows !== 'number') {
        setVisibleCount(minimumVisibleProjectCount);
        return;
      }

      const borderRows = 2;
      const hintRows = 1;
      const reservedRows = borderRows + hintRows;
      const availableRows = Math.max(0, stdout.rows - reservedRows);
      const rowsPerProject = Math.max(linesPerProject, 1);
      const calculatedCount = Math.max(1, Math.floor(availableRows / rowsPerProject));
      setVisibleCount(calculatedCount);
    };

    updateVisibleCount();
    stdout?.on('resize', updateVisibleCount);

    return () => {
      stdout?.off('resize', updateVisibleCount);
    };
  }, [linesPerProject, stdout]);

  const limit = Math.max(1, visibleCount);

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

  const launchSelected = useCallback(async () => {
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
      setLaunchedProjects((previous) => {
        const next = new Set(previous);
        next.add(project.id);
        return next;
      });
      setReleasedProjects((previous) => {
        if (!previous.has(project.id)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(project.id);
        return next;
      });
      setHint(`Launched: ${project.title}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
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

  const terminateSelected = useCallback(async () => {
    const projectView = sortedProjects[index];
    if (!projectView) {
      setHint('No project to terminate');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
      return;
    }

    try {
      const result = await onTerminate(projectView.project);
      if (!result.terminated) {
        setHint(result.message ?? 'No running Unity for this project');
        setTimeout(() => {
          setHint(defaultHintMessage);
        }, 3000);
        return;
      }

      setHint(`Stopped Unity: ${projectView.project.title}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
      setLaunchedProjects((previous) => {
        if (!previous.has(projectView.project.id)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(projectView.project.id);
        return next;
      });
      setReleasedProjects((previous) => {
        const next = new Set(previous);
        next.add(projectView.project.id);
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(`Failed to stop: ${message}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
    }
  }, [index, onTerminate, sortedProjects]);

  useEffect(() => {
    setProjectViews(projects);
    setReleasedProjects(new Set());
    setLaunchedProjects(new Set());
  }, [projects]);

  const refreshProjects = useCallback(async () => {
    if (!onRefresh) {
      setHint('Refresh not available');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
      return;
    }

    if (isRefreshing) {
      setHint('Already refreshing');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
      return;
    }

    setIsRefreshing(true);
    setHint('Refreshing projects...');

    try {
      const updatedProjects = await onRefresh();
      setProjectViews(updatedProjects);
      setReleasedProjects(new Set());
      setLaunchedProjects(new Set());
      setIndex((previousIndex) => {
        if (updatedProjects.length === 0) {
          return 0;
        }

        const previousProject = sortedProjects[previousIndex]?.project;
        if (!previousProject) {
          return Math.min(previousIndex, updatedProjects.length - 1);
        }

        const nextIndex = updatedProjects.findIndex(
          (candidate) => candidate.project.id === previousProject.id,
        );
        if (nextIndex === -1) {
          return Math.min(previousIndex, updatedProjects.length - 1);
        }

        return nextIndex;
      });
      setWindowStart(0);
      setHint('Project list refreshed');
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(`Failed to refresh: ${message}`);
      setTimeout(() => {
        setHint(defaultHintMessage);
      }, 3000);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh, sortedProjects]);

  useInput((input, key) => {
    if (isSortMenuOpen) {
      if (key.escape || input === '\u001b') {
        clearOverlay();
        forceFullRepaint();
        setIsSortMenuOpen(false);
        setRenderEpoch((prev) => prev + 1);
        return;
      }

      if (input === 'j') {
        setSortMenuIndex((prev) => {
          const last = 2; // 0..2 (Primary, Direction, Favorites)
          const next = prev + 1;
          return next > last ? 0 : next;
        });
        return;
      }
      if (input === 'k') {
        setSortMenuIndex((prev) => {
          const last = 2;
          const next = prev - 1;
          return next < 0 ? last : next;
        });
        return;
      }

      const toggleCurrent = (): void => {
        if (sortMenuIndex === 0) {
          setSortPreferences((prev) => ({ ...prev, primary: prev.primary === 'updated' ? 'name' : 'updated' }));
          return;
        }
        if (sortMenuIndex === 1) {
          setSortPreferences((prev) => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
          return;
        }
        setSortPreferences((prev) => ({ ...prev, favoritesFirst: !prev.favoritesFirst }));
      };

      if (input === ' ') {
        toggleCurrent();
      }
      return;
    }

    if (input === 'S' || input === 's') {
      setIsSortMenuOpen(true);
      return;
    }

    if (input === 'j' || key.downArrow) {
      move(1);
    }

    if (input === 'k' || key.upArrow) {
      move(-1);
    }

    if (input === 'q') {
      void terminateSelected();
      return;
    }

    if (input === 'o') {
      void launchSelected();
      return;
    }

    if (input === 'r') {
      void refreshProjects();
      return;
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
    const totalProjects = projectViews.length;
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
  }, [linesPerProject, projectViews.length, startIndex, visibleProjects]);

  const rows = useMemo(() => {
    return visibleProjects.map(({ project, repository, launchStatus }, offset) => {
      const rowIndex = startIndex + offset;
      const isSelected = rowIndex === index;
      const selectionBar: string = isSelected ? '┃' : ' ';
      const projectName: string = formatProjectName(project, repository, useGitRootName);
      const versionLabel: string = `(${project.version.value})`;
      const updatedText: string | undefined = formatUpdatedText(project.lastModified);
      const pathLine: string = shortenHomePath(project.path);
      const branchLine: string = formatBranch(repository?.branch);
      const hasReleasedLock = releasedProjects.has(project.id);
      const isLocallyLaunched = launchedProjects.has(project.id);
      const displayStatus: LaunchStatus = (() => {
        if (isLocallyLaunched) {
          return 'running';
        }

        if (hasReleasedLock) {
          return 'idle';
        }

        return launchStatus;
      })();

      const baseScrollbarIndex = offset * linesPerProject;
      const titleScrollbar = scrollbarChars[baseScrollbarIndex] ?? ' ';
      const branchScrollbar = showBranch ? scrollbarChars[baseScrollbarIndex + 1] ?? ' ' : ' ';
      const pathScrollbar = showPath
        ? scrollbarChars[baseScrollbarIndex + 1 + (showBranch ? 1 : 0)] ?? ' '
        : ' ';
      const spacerScrollbar = scrollbarChars[baseScrollbarIndex + linesPerProject - 1] ?? ' ';

      const statusLabel: string = STATUS_LABELS[displayStatus];
      const statusColor: string | undefined = displayStatus === 'running' ? LOCK_COLOR : displayStatus === 'crashed' ? 'red' : undefined;

      return (
        <Box key={project.id} flexDirection="row">
          {/* left selection indicator */}
          <Box width={1} flexDirection="column" alignItems="center" marginLeft={isSelected ? 1 : 0}>
            <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text>
            {showBranch ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
            {showPath ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
          </Box>
          <Box flexGrow={1} flexDirection="column" marginLeft={isSelected ? 2 : 1}>
            <Text wrap="truncate">
              <Text color={PROJECT_COLOR} bold>
                {projectName}
              </Text>
              <Text> {versionLabel}</Text>
              {updatedText ? (
                <Text>{`  ${updatedText}`}</Text>
              ) : null}
              {statusLabel && statusColor ? (
                <Text color={statusColor}>{`  ${statusLabel}`}</Text>
              ) : null}
            </Text>
            {showBranch ? (
              <Text color={BRANCH_COLOR} wrap="truncate">{branchLine}</Text>
            ) : null}
            {showPath ? (
              <Text color={PATH_COLOR} wrap="truncate">{pathLine}</Text>
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
  }, [
    index,
    launchedProjects,
    releasedProjects,
    scrollbarChars,
    showBranch,
    showPath,
    startIndex,
    useGitRootName,
    visibleProjects,
  ]);

  // Overlay painter: draws popup on top of the list without clearing background
  useEffect(() => {
    if (!isSortMenuOpen || !stdout) {
      return;
    }

    const columns: number = typeof stdout.columns === 'number' ? stdout.columns : 80;
    const contentRows: number = rows.length === 0 ? 1 : visibleProjects.length * linesPerProject;
    // top + bottom borders: kept for documentation
    // const borderRows = 2;
    // const hintRows = 1;

    const contentWidth: number = Math.max(10, columns - 2);
    const modalInnerWidth: number = Math.min(60, Math.max(28, contentWidth - 6));
    const modalWidth: number = Math.min(contentWidth, modalInnerWidth);
    const leftPadding: number = Math.max(0, Math.floor((contentWidth - modalWidth) / 2));

    const title = 'Sort Menu (Select: j/k, Toggle: Space, Close: Esc)';
    const linePrimary = `Primary: ${sortPreferences.primary === 'updated' ? 'Updated' : 'Name (Git root)'}`;
    const lineDirection = `Direction: ${
      sortPreferences.primary === 'updated'
        ? sortPreferences.direction === 'desc'
          ? 'New to Old'
          : 'Old to New'
        : sortPreferences.direction === 'asc'
          ? 'A to Z'
          : 'Z to A'
    }`;
    const lineFav = `Favorites first: ${sortPreferences.favoritesFirst ? 'ON' : 'OFF'}`;

    const innerWidth = modalWidth - 2;
    const BORDER_ON = '\u001B[32m';
    const BORDER_OFF = '\u001B[39m';
    const buildContentLine = (label: string, selected: boolean): string => {
      const arrow = selected ? '> ' : '  ';
      const plainFull = `${arrow}${label}`;
      const visible = stringWidth(plainFull) > innerWidth ? `${truncateToWidth(plainFull, Math.max(0, innerWidth - 3))}...` : plainFull;
      const pad = Math.max(0, innerWidth - stringWidth(visible));
      const colored = selected ? `\u001B[32m${visible}\u001B[39m` : visible;
      return `${BORDER_ON}│${BORDER_OFF}${colored}${' '.repeat(pad)}${BORDER_ON}│${BORDER_OFF}`;
    };

    const contentLines: string[] = [
      (() => {
        const visibleTitle = stringWidth(title) > innerWidth ? `${truncateToWidth(title, Math.max(0, innerWidth - 3))}...` : title;
        const pad = Math.max(0, innerWidth - stringWidth(visibleTitle));
        return `${BORDER_ON}│${BORDER_OFF}${visibleTitle}${' '.repeat(pad)}${BORDER_ON}│${BORDER_OFF}`;
      })(),
      `${BORDER_ON}│${BORDER_OFF}${' '.repeat(innerWidth)}${BORDER_ON}│${BORDER_OFF}`,
      buildContentLine(linePrimary, sortMenuIndex === 0),
      buildContentLine(lineDirection, sortMenuIndex === 1),
      buildContentLine(lineFav, sortMenuIndex === 2),
    ];

    const topBorder = `${BORDER_ON}┌${'─'.repeat(modalWidth - 2)}┐${BORDER_OFF}`;
    const bottomBorder = `${BORDER_ON}└${'─'.repeat(modalWidth - 2)}┘${BORDER_OFF}`;
    const overlayLines = [topBorder, ...contentLines, bottomBorder];
    const overlayHeight = overlayLines.length;

    const overlayTopWithinContent = Math.max(0, Math.floor((contentRows - overlayHeight) / 2));
    const overlayTopRelativeToComponent = 1 + overlayTopWithinContent; // inside border
    const bottomIndex = contentRows + 2; // hint line index
    const moveUp = Math.max(0, bottomIndex - overlayTopRelativeToComponent);
    const moveRight = 1 + leftPadding; // inside left border + padding

    // save cursor
    stdout.write('\u001B7');
    // move up to overlay top
    if (moveUp > 0) {
      stdout.write(`\u001B[${moveUp}A`);
    }
    // ensure column 1
    stdout.write('\r');

    // draw overlay (clear exact region first to avoid artifacts)
    for (let i = 0; i < overlayLines.length; i++) {
      // start of line
      stdout.write('\r');
      if (moveRight > 0) {
        stdout.write(`\u001B[${moveRight}C`);
      }
      // clear region width
      stdout.write(' '.repeat(Math.max(0, modalWidth)));
      // move cursor left by modal width
      stdout.write(`\u001B[${Math.max(0, modalWidth)}D`);
      // draw line
      stdout.write(overlayLines[i]);
      if (i < overlayLines.length - 1) {
        stdout.write('\r\n');
      }
    }

    // restore cursor
    stdout.write('\u001B8');
  }, [
    isSortMenuOpen,
    linesPerProject,
    rows,
    sortPreferences,
    sortMenuIndex,
    stdout,
    visibleProjects.length,
  ]);

  const clearOverlay = useCallback((): void => {
    if (!stdout) {
      return;
    }
    const columns: number = typeof stdout.columns === 'number' ? stdout.columns : 80;
    const contentRows: number = rows.length === 0 ? 1 : visibleProjects.length * linesPerProject;
    const contentWidth: number = Math.max(10, columns - 2);
    const modalInnerWidth: number = Math.min(60, Math.max(28, contentWidth - 6));
    const modalWidth: number = Math.min(contentWidth, modalInnerWidth);
    const leftPadding: number = Math.max(0, Math.floor((contentWidth - modalWidth) / 2));

    const overlayHeight = 6; // borders(2) + title(1) + items(3)
    const overlayTopWithinContent = Math.max(0, Math.floor((contentRows - overlayHeight) / 2));
    const overlayTopRelativeToComponent = 1 + overlayTopWithinContent; // inside border
    const bottomIndex = contentRows + 2; // hint line index
    const moveUp = Math.max(0, bottomIndex - overlayTopRelativeToComponent);
    const moveRight = 1 + leftPadding; // inside left border + padding

    stdout.write('\u001B7');
    if (moveUp > 0) {
      stdout.write(`\u001B[${moveUp}A`);
    }
    stdout.write('\r');
    for (let i = 0; i < overlayHeight; i++) {
      stdout.write('\r');
      if (moveRight > 0) {
        stdout.write(`\u001B[${moveRight}C`);
      }
      stdout.write(' '.repeat(Math.max(0, modalWidth)));
      if (i < overlayHeight - 1) {
        stdout.write('\r\n');
      }
    }
    stdout.write('\u001B8');
  }, [linesPerProject, rows.length, visibleProjects.length, stdout]);

  // no-op: avoid unused variable warnings; width is accessible via stdout when needed

  return (
    <Box key={renderEpoch} flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor="green">
        {rows.length === 0 ? (
          <Text>No Unity Hub projects were found.</Text>
        ) : (
          rows
        )}
      </Box>
      <Box>
        <Text wrap="truncate">{hint}</Text>
      </Box>
    </Box>
  );
};
