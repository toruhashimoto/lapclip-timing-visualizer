import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import monkey from 'vite-plugin-monkey'

// Builds the Tampermonkey userscript (dist/lapclip-visualizer.user.js).
// Browser-only: it reads the official LapClip page DOM and overlays the F1 UI.
// No server, no fetching, no redistribution — @grant none, no @connect.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    monkey({
      entry: 'src/userscript/main.tsx',
      userscript: {
        name: 'LapClip Timing Visualizer',
        namespace: 'https://github.com/toruhashimoto/lapclip-timing-visualizer',
        version: '0.1.0',
        description:
          'LapClip公式ページをF1風タイミングUIに変換する非公式の表示補助ツール（ブラウザ内のみ動作・外部送信なし）',
        author: 'toruhashimoto',
        match: ['https://matrix-sports.jp/lap/result.php*'],
        'run-at': 'document-end',
        grant: 'none',
      },
      build: {
        fileName: 'lapclip-visualizer.user.js',
      },
    }),
  ],
})
