import { createInterface, Interface } from 'node:readline';

/**
 * Terminal theme type
 */
export type TerminalTheme = 'dark' | 'light';

/**
 * RGB color information
 */
type RgbColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/**
 * Parse RGB values from OSC 11 response
 * @param response OSC 11 response string
 * @returns Parsed RGB values, or undefined if parsing fails
 */
const parseOsc11Response = (response: string): RgbColor | undefined => {
  // OSC 11 response format: \033]11;rgb:RRRR/GGGG/BBBB\007
  // or \033]11;rgb:RR/GG/BB\007 format
  const rgbMatch = response.match(/rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
  if (!rgbMatch) {
    return undefined;
  }

  const [, rHex, gHex, bHex] = rgbMatch;
  if (!rHex || !gHex || !bHex) {
    return undefined;
  }

  // For 16-bit values (4 digits), use upper 8 bits; for 8-bit values (2 digits), use as-is
  const normalizeColorValue = (hex: string): number => {
    const value = parseInt(hex, 16);
    if (hex.length === 4) {
      // Convert 16-bit value to 8-bit
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
 * Calculate relative luminance from RGB values (sRGB color space)
 * Uses W3C WCAG 2.0 relative luminance formula
 * @param color RGB color information
 * @returns Relative luminance value in the range 0-1
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

  // W3C WCAG 2.0 relative luminance coefficients
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

/**
 * Determine theme from luminance value
 * @param luminance Relative luminance value (0-1)
 * @returns Dark or light theme
 */
const determineThemeFromLuminance = (luminance: number): TerminalTheme => {
  // Dark if luminance < 0.5, Light if >= 0.5
  const darkThreshold = 0.5;
  return luminance < darkThreshold ? 'dark' : 'light';
};

/**
 * Query terminal background color using OSC 11
 * @param timeoutMs Timeout in milliseconds
 * @returns Background color RGB values, or undefined if query fails
 */
const queryTerminalBackgroundColor = async (timeoutMs: number): Promise<RgbColor | undefined> => {
  // Cannot detect if not a TTY
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  return new Promise((resolve) => {
    let responseBuffer = '';
    let resolved = false;

    // Enable raw mode to read escape sequences
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

      // Detect OSC 11 response
      // Terminator is BEL (\x07) or ST (\x1b\\)
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
      // Disable raw mode
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

    // Send OSC 11 query
    // \x1b]11;?\x07 = ESC ] 11 ; ? BEL
    process.stdout.write('\x1b]11;?\x07');
  });
};

/**
 * Detect terminal theme
 * Queries the terminal background color using OSC 11 and
 * determines dark/light theme based on luminance
 * @param timeoutMs Timeout in milliseconds, default 100ms
 * @returns Detected theme, defaults to 'dark' on detection failure
 */
export const detectTerminalTheme = async (timeoutMs: number = 100): Promise<TerminalTheme> => {
  const backgroundColor = await queryTerminalBackgroundColor(timeoutMs);

  if (!backgroundColor) {
    // Default to dark on detection failure
    return 'dark';
  }

  const luminance = calculateRelativeLuminance(backgroundColor);
  return determineThemeFromLuminance(luminance);
};
