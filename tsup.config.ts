import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  splitting: false,
  dts: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
