import { Box, Text } from 'ink';
import React from 'react';

import type { SortPreferences } from '../../infrastructure/config.js';
import { useThemeColors } from '../theme.js';

type SortPanelProps = {
  readonly sortPreferences: SortPreferences;
  readonly focusedIndex: number; // 0: Primary, 1: Direction, 2: Favorites
  readonly width?: number;
};

const lineForPrimary = (primary: SortPreferences['primary']): string => {
  return `Primary: ${primary === 'updated' ? 'Updated' : 'Name (Git root)'}`;
};

const lineForDirection = (prefs: SortPreferences): string => {
  if (prefs.primary === 'updated') {
    return `Direction: ${prefs.direction === 'desc' ? 'New to Old' : 'Old to New'}`;
  }
  return `Direction: ${prefs.direction === 'asc' ? 'A to Z' : 'Z to A'}`;
};

const lineForFavorites = (favoritesFirst: boolean): string => {
  return `Favorites first: ${favoritesFirst ? 'ON' : 'OFF'}`;
};

export const SortPanel: React.FC<SortPanelProps> = ({ sortPreferences, focusedIndex, width }) => {
  const primaryLine = lineForPrimary(sortPreferences.primary);
  const directionLine = lineForDirection(sortPreferences);
  const favoritesLine = lineForFavorites(sortPreferences.favoritesFirst);
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
      <Item label={primaryLine} selected={focusedIndex === 0} />
      <Item label={directionLine} selected={focusedIndex === 1} />
      <Item label={favoritesLine} selected={focusedIndex === 2} />
    </Box>
  );
};


