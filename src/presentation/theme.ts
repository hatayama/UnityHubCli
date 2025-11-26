import type { Context, FC, ReactNode } from 'react';
import { createContext, createElement, useContext } from 'react';

import type { TerminalTheme } from '../infrastructure/terminalTheme.js';

/**
 * Color palette type definition
 */
export type ColorPalette = {
  /** Color for project name */
  readonly projectName: string;
  /** Color for branch line */
  readonly branch: string;
  /** Color for path line */
  readonly path: string;
  /** Color for border and selection indicator */
  readonly border: string;
  /** Color for status (running) display */
  readonly status: string;
  /** Color for focus state */
  readonly focus: string;
};

/**
 * Dark theme color palette
 * Uses bright colors with high contrast against dark backgrounds
 */
const darkPalette: ColorPalette = {
  projectName: '#abd8e7', // Light cyan
  branch: '#e3839c', // Pink
  path: '#719bd8', // Blue
  border: 'green', // Green
  status: 'yellow', // Yellow
  focus: 'green', // Green
};

/**
 * Light theme color palette
 * Uses dark colors with high contrast against light backgrounds
 */
const lightPalette: ColorPalette = {
  projectName: '#0044aa', // Deep blue
  branch: '#991144', // Deep magenta
  path: '#1a4570', // Deep blue
  border: '#006400', // Dark green
  status: '#cc6600', // Dark orange (more visible)
  focus: '#006400', // Dark green
};

/**
 * Get color palette based on theme
 * @param theme Terminal theme
 * @returns Corresponding color palette
 */
export const getColorPalette = (theme: TerminalTheme): ColorPalette => {
  return theme === 'dark' ? darkPalette : lightPalette;
};

/**
 * Theme context value type
 */
type ThemeContextValue = {
  readonly theme: TerminalTheme;
  readonly colors: ColorPalette;
};

/**
 * Default value (dark theme)
 */
const defaultThemeContext: ThemeContextValue = {
  theme: 'dark',
  colors: darkPalette,
};

/**
 * Theme context
 */
export const ThemeContext: Context<ThemeContextValue> = createContext<ThemeContextValue>(defaultThemeContext);

/**
 * Custom hook to get color palette from theme context
 * @returns Color palette for current theme
 */
export const useThemeColors = (): ColorPalette => {
  const context = useContext(ThemeContext);
  return context.colors;
};

/**
 * Custom hook to get theme type from theme context
 * @returns Current theme type
 */
export const useTheme = (): TerminalTheme => {
  const context = useContext(ThemeContext);
  return context.theme;
};

/**
 * ThemeProvider props type
 */
export type ThemeProviderProps = {
  readonly theme: TerminalTheme;
  readonly children: ReactNode;
};

/**
 * Provider component that provides theme
 */
export const ThemeProvider: FC<ThemeProviderProps> = ({ theme, children }) => {
  const value: ThemeContextValue = {
    theme,
    colors: getColorPalette(theme),
  };

  return createElement(ThemeContext.Provider, { value }, children);
};
