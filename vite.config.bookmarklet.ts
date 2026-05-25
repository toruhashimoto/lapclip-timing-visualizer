import { defineConfig } from 'vite'

// Builds the standalone PC bookmarklet bundle (dist/lapclip-bookmarklet.js):
// a single self-executing IIFE, vanilla DOM, no framework, no runtime deps.
// It runs on the official LapClip page, reads the DOM, and overlays the F1 UI —
// no network, no storage, no redistribution. Host it (GitHub Pages/Release) and
// load via a one-line `javascript:` bookmarklet, or inline the whole file.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    lib: {
      entry: 'src/bookmarklet/main.ts',
      name: 'LapClipBookmarklet',
      formats: ['iife'],
      fileName: () => 'lapclip-bookmarklet.js',
    },
    rollupOptions: {
      output: { entryFileNames: 'lapclip-bookmarklet.js' },
    },
  },
})
