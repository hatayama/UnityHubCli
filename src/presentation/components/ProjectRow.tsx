import { Box, Text, useStdout } from 'ink';
import React from 'react';

type ScrollbarChars = {
  readonly title: string;
  readonly branch: string;
  readonly path: string;
  readonly spacer: string;
};

type ProjectRowProps = {
  readonly isSelected: boolean;
  readonly selectionBar: string;
  readonly projectName: string;
  readonly projectColor: string;
  readonly versionLabel: string;
  readonly updatedText?: string;
  readonly statusLabel?: string;
  readonly statusColor?: string;
  readonly branchLine: string;
  readonly pathLine: string;
  readonly showBranch: boolean;
  readonly showPath: boolean;
  readonly scrollbar: ScrollbarChars;
};

export const ProjectRow: React.FC<ProjectRowProps> = ({
  isSelected,
  selectionBar,
  projectName,
  projectColor,
  versionLabel,
  updatedText,
  statusLabel,
  statusColor,
  branchLine,
  pathLine,
  showBranch,
  showPath,
  scrollbar,
}) => {
  const { stdout } = useStdout();
  const computedCenterWidth: number | undefined =
    typeof stdout?.columns === 'number' ? Math.max(0, stdout.columns - 6) : undefined;
  const centerWidth: number | undefined =
    typeof computedCenterWidth === 'number'
      ? Math.max(0, computedCenterWidth - (isSelected ? 1 : 0))
      : undefined;
  return (
    <Box flexDirection="row">
      {/* left selection indicator */}
      <Box width={1} flexDirection="column" alignItems="center" marginLeft={0}>
        <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text>
        {showBranch ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
        {showPath ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
      </Box>
      <Box flexDirection="column" marginLeft={isSelected ? 2 : 1} width={centerWidth}>
        <Text wrap="truncate">
          <Text color={projectColor} bold>
            {projectName}
          </Text>
          <Text> {versionLabel}</Text>
          {updatedText ? <Text>{`  ${updatedText}`}</Text> : null}
          {statusLabel && statusColor ? <Text color={statusColor}>{`  ${statusLabel}`}</Text> : null}
        </Text>
        {showBranch ? (
          <Text color="#e3839c" wrap="truncate">{branchLine}</Text>
        ) : null}
        {showPath ? (
          <Text color="#719bd8" wrap="truncate">{pathLine}</Text>
        ) : null}
        <Text> </Text>
      </Box>
      <Box marginLeft={1} width={1} flexDirection="column" alignItems="center">
        <Text>{scrollbar.title}</Text>
        {showBranch ? <Text>{scrollbar.branch}</Text> : null}
        {showPath ? <Text>{scrollbar.path}</Text> : null}
        <Text>{scrollbar.spacer}</Text>
      </Box>
    </Box>
  );
};


