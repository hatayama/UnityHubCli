import clipboard from 'clipboardy';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProjectView } from '../application/usecases.js';
import { LaunchCancelledError } from '../application/usecases.js';
import type { GitRepositoryInfo, UnityProject } from '../domain/models.js';
import type { SortDirection, SortPrimary } from '../infrastructure/config.js';

import { LayoutManager, getLayoutMode } from './components/LayoutManager.js';
import { ProjectList } from './components/ProjectList.js';
import { SortPanel } from './components/SortPanel.js';
import { useSortPreferences } from './hooks/useSortPreferences.js';
import { useVisibleCount } from './hooks/useVisibleCount.js';
import { shortenHomePath, buildCdCommand } from './utils/path.js';

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


const minimumVisibleProjectCount: number = 4;
const defaultHintMessage =
  'Select: j/k · Open: o · Quit: q · Refresh: r · CopyPath: c · Sort: s · Close: ctrl + c';
 

 

const getCopyTargetPath = (view: ProjectView): string => {
  const root = view.repository?.root;
  return root && root.length > 0 ? root : view.project.path;
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
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const linesPerProject = (showBranch ? 1 : 0) + (showPath ? 1 : 0) + 2;
  const panelHeight: number = 6; // borders(2) + title(1) + items(3)
  const visibleCount: number = useVisibleCount(stdout, linesPerProject, isSortMenuOpen, panelHeight, minimumVisibleProjectCount);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState<string>(defaultHintMessage);
  const [windowStart, setWindowStart] = useState(0);
  const [releasedProjects, setReleasedProjects] = useState<ReadonlySet<string>>(new Set());
  const [launchedProjects, setLaunchedProjects] = useState<ReadonlySet<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortMenuIndex, setSortMenuIndex] = useState(0);
  const { sortPreferences, setSortPreferences } = useSortPreferences();

  

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
    const handleSigint = () => {
      exit();
    };

    process.on('SIGINT', handleSigint);

    return () => {
      process.off('SIGINT', handleSigint);
    };
  }, [exit]);

  

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
    const projectView = sortedProjects[index];
    const projectPath = projectView ? getCopyTargetPath(projectView) : undefined;
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
      setHint(`Copied command: cd ${displayPath}`);
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
      const cdTarget = getCopyTargetPath(projectView);
      const command = buildCdCommand(cdTarget);
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
        setIsSortMenuOpen(false);
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

  
 

  // no-op: avoid unused variable warnings; width is accessible via stdout when needed

  return (
    <LayoutManager
      layoutMode={getLayoutMode()}
      panelVisible={isSortMenuOpen}
      list={
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          width={typeof stdout?.columns === 'number' ? stdout.columns : undefined}
        >
          {sortedProjects.length === 0 ? (
            <Text>No Unity Hub projects were found.</Text>
          ) : (
            <ProjectList
              visibleProjects={visibleProjects}
              startIndex={startIndex}
              selectedIndex={index}
              linesPerProject={linesPerProject}
              showBranch={showBranch}
              showPath={showPath}
              useGitRootName={useGitRootName}
              releasedProjects={releasedProjects}
              launchedProjects={launchedProjects}
              totalProjects={sortedProjects.length}
            />
          )}
        </Box>
      }
      panel={
        <Box flexDirection="column" width={typeof stdout?.columns === 'number' ? stdout.columns : undefined}>
          <Text>Sort Settings</Text>
          <Box marginTop={1}>
            <SortPanel
              sortPreferences={sortPreferences}
              focusedIndex={sortMenuIndex}
              width={typeof stdout?.columns === 'number' ? stdout.columns : undefined}
            />
          </Box>
        </Box>
      }
      statusBar={
        isSortMenuOpen ? (
          <Text wrap="truncate">Select: j/k, Toggle: Space, Back: Esc</Text>
        ) : (
          <Text wrap="truncate">{hint}</Text>
        )
      }
    />
  );
};
