import { Box, Text } from 'ink';
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
  return (
    <Box flexDirection="row">
      {/* left selection indicator */}
      <Box width={1} flexDirection="column" alignItems="center" marginLeft={isSelected ? 1 : 0}>
        <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text>
        {showBranch ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
        {showPath ? <Text color={isSelected ? 'green' : undefined}>{selectionBar}</Text> : null}
      </Box>
      <Box flexGrow={1} flexDirection="column" marginLeft={isSelected ? 2 : 1}>
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


