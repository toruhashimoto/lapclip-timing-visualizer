// Vite returns the compiled CSS as a default string export for `?inline`
// imports. The userscript injects that string into a Shadow DOM, so Tailwind's
// styles stay isolated from the official LapClip page.
declare module '*.css?inline' {
  const css: string
  export default css
}
