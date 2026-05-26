// Generates the iPhone/iPad Safari bookmarklet payload from the same vanilla
// overlay bundle as the PC bookmarklet (dist/lapclip-bookmarklet.js).
// Output: ios-bookmarklet/bookmarklet.txt — a single, clean `javascript:` line
// meant to be copied on an iPhone and pasted into an edited Safari bookmark.
// Run via `npm run build:ios-bookmarklet` (which builds the bundle first).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('ios-bookmarklet', { recursive: true })
const bundle = readFileSync('dist/lapclip-bookmarklet.js', 'utf8')
const oneLiner = 'javascript:' + encodeURIComponent(bundle)
writeFileSync('ios-bookmarklet/bookmarklet.txt', oneLiner + '\n')
console.log('wrote ios-bookmarklet/bookmarklet.txt (' + oneLiner.length + ' chars)')
