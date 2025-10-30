import { Box } from 'ink';
import React from 'react';

export type LayoutMode = 'bottomPanel' | 'rightPanel' | 'screenSwitch';

export const getLayoutMode = (): LayoutMode => {
  const value: string | undefined = process.env.UNITYHUBCLI_LAYOUT;
  if (value === 'right') return 'rightPanel';
  if (value === 'screen') return 'screenSwitch';
  return 'screenSwitch';
};

type LayoutManagerProps = {
  readonly layoutMode: LayoutMode;
  readonly panelVisible: boolean;
  readonly list: React.ReactNode;
  readonly panel: React.ReactNode;
  readonly statusBar: React.ReactNode;
};

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  layoutMode,
  panelVisible,
  list,
  panel,
  statusBar,
}) => {
  if (layoutMode === 'rightPanel') {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1}>{list}</Box>
          {panelVisible ? <Box marginLeft={1}>{panel}</Box> : null}
        </Box>
        <Box>{statusBar}</Box>
      </Box>
    );
  }

  if (layoutMode === 'screenSwitch') {
    return (
      <Box flexDirection="column">
        <Box>{panelVisible ? panel : list}</Box>
        <Box>{statusBar}</Box>
      </Box>
    );
  }

  // bottomPanel (default)
  return (
    <Box flexDirection="column">
      <Box>{list}</Box>
      {panelVisible ? <Box marginTop={1}>{panel}</Box> : null}
      <Box>{statusBar}</Box>
    </Box>
  );
};


