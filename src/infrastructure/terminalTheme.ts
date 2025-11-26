import { createInterface, Interface } from 'node:readline';

/**
 * ターミナルのテーマ種別
 */
export type TerminalTheme = 'dark' | 'light';

/**
 * RGB色情報
 */
type RgbColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/**
 * OSC 11レスポンスからRGB値をパースする
 * @param response OSC 11のレスポンス文字列
 * @returns パースされたRGB値、パース失敗時はundefined
 */
const parseOsc11Response = (response: string): RgbColor | undefined => {
  // OSC 11 response format: \033]11;rgb:RRRR/GGGG/BBBB\007
  // または \033]11;rgb:RR/GG/BB\007 の形式もある
  const rgbMatch = response.match(/rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
  if (!rgbMatch) {
    return undefined;
  }

  const [, rHex, gHex, bHex] = rgbMatch;
  if (!rHex || !gHex || !bHex) {
    return undefined;
  }

  // 16bit値（4桁）の場合は上位8bitを使用、8bit値（2桁）の場合はそのまま
  const normalizeColorValue = (hex: string): number => {
    const value = parseInt(hex, 16);
    if (hex.length === 4) {
      // 16bit値を8bitに変換
      return Math.floor(value / 256);
    }
    return value;
  };

  return {
    r: normalizeColorValue(rHex),
    g: normalizeColorValue(gHex),
    b: normalizeColorValue(bHex),
  };
};

/**
 * RGB値から相対輝度を計算する（sRGB色空間）
 * W3C WCAG 2.0の相対輝度計算式を使用
 * @param color RGB色情報
 * @returns 0-1の範囲の相対輝度値
 */
const calculateRelativeLuminance = (color: RgbColor): number => {
  const toLinear = (value: number): number => {
    const normalized = value / 255;
    if (normalized <= 0.03928) {
      return normalized / 12.92;
    }
    return Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(color.r);
  const gLinear = toLinear(color.g);
  const bLinear = toLinear(color.b);

  // W3C WCAG 2.0 相対輝度係数
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

/**
 * 輝度値からテーマを判定する
 * @param luminance 相対輝度値（0-1）
 * @returns ダークまたはライトテーマ
 */
const determineThemeFromLuminance = (luminance: number): TerminalTheme => {
  // 輝度が0.5未満ならダーク、0.5以上ならライト
  const darkThreshold = 0.5;
  return luminance < darkThreshold ? 'dark' : 'light';
};

/**
 * OSC 11クエリでターミナルの背景色を取得する
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns 背景色のRGB値、取得失敗時はundefined
 */
const queryTerminalBackgroundColor = async (timeoutMs: number): Promise<RgbColor | undefined> => {
  // TTYでない場合は検出不可
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  return new Promise((resolve) => {
    let responseBuffer = '';
    let resolved = false;

    // rawモードを有効化してエスケープシーケンスを読み取る
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const rl: Interface = createInterface({
      input: process.stdin,
      escapeCodeTimeout: timeoutMs,
    });

    // eslint-disable-next-line prefer-const -- assigned after onData/cleanup definitions
    let timeoutId: ReturnType<typeof setTimeout>;

    const onData = (chunk: Buffer): void => {
      responseBuffer += chunk.toString();

      // OSC 11レスポンスを検出
      // 終端は BEL (\x07) または ST (\x1b\\)
      if (responseBuffer.includes('\x07') || responseBuffer.includes('\x1b\\')) {
        if (!resolved) {
          resolved = true;
          const color = parseOsc11Response(responseBuffer);
          cleanup();
          resolve(color);
        }
      }
    };

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      rl.close();
      process.stdin.off('data', onData);
      // rawモードを解除
      if (process.stdin.isTTY && process.stdin.isRaw) {
        process.stdin.setRawMode(false);
      }
    };

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(undefined);
      }
    }, timeoutMs);

    process.stdin.on('data', onData);

    // OSC 11クエリを送信
    // \x1b]11;?\x07 = ESC ] 11 ; ? BEL
    process.stdout.write('\x1b]11;?\x07');
  });
};

/**
 * ターミナルのテーマを検出する
 * OSC 11クエリを使用してターミナルの背景色を取得し、
 * 輝度からダーク/ライトテーマを判定する
 * @param timeoutMs タイムアウト時間（ミリ秒）、デフォルト100ms
 * @returns 検出されたテーマ、検出失敗時は'dark'
 */
export const detectTerminalTheme = async (timeoutMs: number = 100): Promise<TerminalTheme> => {
  const backgroundColor = await queryTerminalBackgroundColor(timeoutMs);

  if (!backgroundColor) {
    // 検出失敗時はダークをデフォルトとする
    return 'dark';
  }

  const luminance = calculateRelativeLuminance(backgroundColor);
  return determineThemeFromLuminance(luminance);
};

