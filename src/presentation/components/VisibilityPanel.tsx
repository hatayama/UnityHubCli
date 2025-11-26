import { Box, Text } from 'ink';
import React from 'react';

import type { VisibilityPreferences } from '../../infrastructure/config.js';
import { useThemeColors } from '../theme.js';

type VisibilityPanelProps = {
  readonly visibility: VisibilityPreferences;
  readonly focusedIndex: number; // 0: Show branch, 1: Show path
  readonly width?: number;
};

const lineForBranch = (on: boolean): string => `Show branch: ${on ? 'ON' : 'OFF'}`;
const lineForPath = (on: boolean): string => `Show path: ${on ? 'ON' : 'OFF'}`;

export const VisibilityPanel: React.FC<VisibilityPanelProps> = ({ visibility, focusedIndex, width }) => {
  const branchLine = lineForBranch(visibility.showBranch);
  const pathLine = lineForPath(visibility.showPath);
  const colors = useThemeColors();

  const Item: React.FC<{ label: string; selected: boolean }> = ({ label, selected }) => {
    const prefix = selected ? '> ' : '  ';
    return (
      <Text>
        {selected ? <Text color={colors.focus}>{prefix}</Text> : prefix}
        {label}
      </Text>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.border}
      paddingX={1}
      width={width}
    >
      <Item label={branchLine} selected={focusedIndex === 0} />
      <Item label={pathLine} selected={focusedIndex === 1} />
    </Box>
  );
};


