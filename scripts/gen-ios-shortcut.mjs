// Generates the iOS Safari Shortcut payload: the vanilla overlay bundle (same as
// the PC bookmarklet) plus the `completion()` call that the Shortcuts
// "Run JavaScript on Web Page" action requires. Run via `npm run build:ios-shortcut`
// (which builds the bookmarklet bundle first).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('ios-shortcut', { recursive: true })
const bundle = readFileSync('dist/lapclip-bookmarklet.js', 'utf8')
const out =
  bundle +
  '\n// iOS Shortcuts "Run JavaScript on Web Page" must call completion():\n' +
  'typeof completion === "function" && completion("LapClip Visualizer");\n'
writeFileSync('ios-shortcut/lapclip-visualizer-ios.js', out)
console.log('wrote ios-shortcut/lapclip-visualizer-ios.js (' + out.length + ' chars)')
