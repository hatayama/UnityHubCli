import type { Context, FC, ReactNode } from 'react';
import { createContext, createElement, useContext } from 'react';

import type { TerminalTheme } from '../infrastructure/terminalTheme.js';

/**
 * カラーパレットの型定義
 */
export type ColorPalette = {
  /** プロジェクト名の色 */
  readonly projectName: string;
  /** ブランチ行の色 */
  readonly branch: string;
  /** パス行の色 */
  readonly path: string;
  /** 枠線・選択インジケータの色 */
  readonly border: string;
  /** ステータス（running）表示の色 */
  readonly status: string;
  /** フォーカス状態の色 */
  readonly focus: string;
};

/**
 * ダークテーマ用カラーパレット
 * 黒背景に対してコントラストの高い明るい色を使用
 */
const darkPalette: ColorPalette = {
  projectName: '#abd8e7', // 明るいシアン
  branch: '#e3839c', // ピンク
  path: '#719bd8', // 青
  border: 'green', // グリーン
  status: 'yellow', // 黄色
  focus: 'green', // グリーン
};

/**
 * ライトテーマ用カラーパレット
 * 白背景に対してコントラストの高い暗い色を使用
 */
const lightPalette: ColorPalette = {
  projectName: '#0044aa', // より濃い青
  branch: '#991144', // より濃いマゼンタ
  path: '#1a4570', // より濃い青
  border: '#006400', // ダークグリーン
  status: '#cc6600', // 濃いオレンジ（より目立つ）
  focus: '#006400', // ダークグリーン
};

/**
 * テーマに応じたカラーパレットを取得する
 * @param theme ターミナルテーマ
 * @returns 対応するカラーパレット
 */
export const getColorPalette = (theme: TerminalTheme): ColorPalette => {
  return theme === 'dark' ? darkPalette : lightPalette;
};

/**
 * テーマContextの型
 */
type ThemeContextValue = {
  readonly theme: TerminalTheme;
  readonly colors: ColorPalette;
};

/**
 * デフォルト値（ダークテーマ）
 */
const defaultThemeContext: ThemeContextValue = {
  theme: 'dark',
  colors: darkPalette,
};

/**
 * テーマContext
 */
export const ThemeContext: Context<ThemeContextValue> = createContext<ThemeContextValue>(defaultThemeContext);

/**
 * テーマContextからカラーパレットを取得するカスタムフック
 * @returns 現在のテーマに対応するカラーパレット
 */
export const useThemeColors = (): ColorPalette => {
  const context = useContext(ThemeContext);
  return context.colors;
};

/**
 * テーマContextからテーマ種別を取得するカスタムフック
 * @returns 現在のテーマ種別
 */
export const useTheme = (): TerminalTheme => {
  const context = useContext(ThemeContext);
  return context.theme;
};

/**
 * ThemeProviderのprops型
 */
export type ThemeProviderProps = {
  readonly theme: TerminalTheme;
  readonly children: ReactNode;
};

/**
 * テーマを提供するProviderコンポーネント
 */
export const ThemeProvider: FC<ThemeProviderProps> = ({ theme, children }) => {
  const value: ThemeContextValue = {
    theme,
    colors: getColorPalette(theme),
  };

  return createElement(ThemeContext.Provider, { value }, children);
};

