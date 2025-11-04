import { useEffect, useState } from 'react';

export const useVisibleCount = (
  stdout: NodeJS.WriteStream | undefined,
  linesPerProject: number,
  panelVisible: boolean,
  panelHeight: number,
  minimumVisibleProjectCount: number,
  statusBarRows: number,
): number => {
  const compute = (): number => {
    if (!stdout || typeof stdout.columns !== 'number' || typeof stdout.rows !== 'number') {
      return minimumVisibleProjectCount;
    }
    const borderRows = 2;
    const hintRows = Math.max(1, statusBarRows);
    const reservedRows = borderRows + hintRows + (panelVisible ? panelHeight + 1 : 0);
    const availableRows = Math.max(0, stdout.rows - reservedRows);
    const rowsPerProject = Math.max(linesPerProject, 1);
    const calculatedCount = Math.max(1, Math.floor(availableRows / rowsPerProject));
    return calculatedCount;
  };

  const [visibleCount, setVisibleCount] = useState<number>(compute);

  useEffect(() => {
    const updateVisible = () => setVisibleCount(compute());
    updateVisible();
    stdout?.on('resize', updateVisible);
    return () => {
      stdout?.off('resize', updateVisible);
    };
  }, [stdout, linesPerProject, panelVisible, panelHeight, statusBarRows]);

  return visibleCount;
};


