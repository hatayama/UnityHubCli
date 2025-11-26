import { basename } from 'node:path';

import { Box } from 'ink';
import React, { useMemo } from 'react';

import type { LaunchStatus, ProjectView } from '../../application/usecases.js';
import type { GitBranch, GitRepositoryInfo } from '../../domain/models.js';
import { useThemeColors } from '../theme.js';
import { shortenHomePath } from '../utils/path.js';

import { ProjectRow } from './ProjectRow.js';
const STATUS_LABELS: Record<LaunchStatus, string> = {
  idle: '',
  running: '[running]',
  crashed: '',
};

const extractRootFolder = (repository?: GitRepositoryInfo): string | undefined => {
  if (!repository?.root) {
    return undefined;
  }
  const base: string = basename(repository.root);
  return base || undefined;
};

const formatProjectName = (
  projectTitle: string,
  repository: GitRepositoryInfo | undefined,
  useGitRootName: boolean,
): string => {
  if (!useGitRootName) {
    return projectTitle;
  }
  const rootFolder = extractRootFolder(repository);
  if (!rootFolder) {
    return projectTitle;
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

type ProjectListProps = {
  readonly visibleProjects: readonly ProjectView[];
  readonly startIndex: number;
  readonly selectedIndex: number;
  readonly linesPerProject: number;
  readonly showBranch: boolean;
  readonly showPath: boolean;
  readonly useGitRootName: boolean;
  readonly releasedProjects: ReadonlySet<string>;
  readonly launchedProjects: ReadonlySet<string>;
  readonly totalProjects: number;
};

export const ProjectList: React.FC<ProjectListProps> = ({
  visibleProjects,
  startIndex,
  selectedIndex,
  linesPerProject,
  showBranch,
  showPath,
  useGitRootName,
  releasedProjects,
  launchedProjects,
  totalProjects,
}) => {
  const colors = useThemeColors();
  const scrollbarChars = useMemo(() => {
    const totalLines = totalProjects * linesPerProject;
    const windowProjects = visibleProjects.length;
    const visibleLines = windowProjects * linesPerProject;

    if (totalLines === 0 || visibleLines === 0) {
      return [] as string[];
    }

    if (totalLines <= visibleLines) {
      // No scrolling is needed; return spaces to visually hide the scrollbar
      return Array.from({ length: visibleLines }, () => ' ');
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
  }, [linesPerProject, startIndex, totalProjects, visibleProjects.length]);

  const rows = useMemo(() => {
    return visibleProjects.map(({ project, repository, launchStatus }, offset) => {
      const rowIndex = startIndex + offset;
      const isSelected = rowIndex === selectedIndex;
      const selectionBar: string = isSelected ? '┃' : ' ';
      const projectName: string = formatProjectName(project.title, repository, useGitRootName);
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
      const statusColor: string | undefined = displayStatus === 'running' ? colors.status : undefined;

      return (
        <ProjectRow
          key={project.id}
          isSelected={isSelected}
          selectionBar={selectionBar}
          projectName={projectName}
          projectColor={colors.projectName}
          versionLabel={versionLabel}
          updatedText={updatedText}
          statusLabel={statusLabel}
          statusColor={statusColor}
          branchLine={branchLine}
          pathLine={pathLine}
          showBranch={showBranch}
          showPath={showPath}
          scrollbar={{
            title: titleScrollbar,
            branch: branchScrollbar,
            path: pathScrollbar,
            spacer: spacerScrollbar,
          }}
          showSpacer={offset < visibleProjects.length - 1}
        />
      );
    });
  }, [
    launchedProjects,
    releasedProjects,
    scrollbarChars,
    selectedIndex,
    showBranch,
    showPath,
    startIndex,
    useGitRootName,
    visibleProjects,
    linesPerProject,
  ]);

  return <Box flexDirection="column">{rows.length === 0 ? null : rows}</Box>;
};


