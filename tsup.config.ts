import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts', element: 'src/element.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'es2019',
    platform: 'browser',
    splitting: true,
    treeshake: true,
  },
  {
    entry: { warp: 'src/global.ts' },
    format: ['iife'],
    outExtension: () => ({ js: '.global.js' }),
    minify: true,
    sourcemap: true,
    clean: false,
    target: 'es2019',
    platform: 'browser',
    treeshake: true,
  },
])
