import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import overlayCss from './overlay.css?inline'
import { Overlay } from './Overlay'

// Root toggles between the full overlay and a small "show" button so the user
// can always get back to the untouched official LapClip page.
function Root() {
  const [visible, setVisible] = useState(true)
  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="pointer-events-auto fixed bottom-4 right-4 z-10 rounded-full bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-purple-500"
      >
        Timing Visualizer を表示
      </button>
    )
  }
  return <Overlay onHide={() => setVisible(false)} />
}

// Mount into a Shadow DOM so Tailwind styles stay isolated from the official
// page, and the official page's CSS can't leak into our UI. The host is a
// transparent fixed layer (pointer-events:none) — only our panel/button capture
// clicks, so when hidden the page underneath is fully usable.
function mount() {
  if (document.getElementById('lc-viz-host')) return
  const host = document.createElement('div')
  host.id = 'lc-viz-host'
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;pointer-events:none;'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = overlayCss
  shadow.appendChild(style)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)
  createRoot(mountPoint).render(<Root />)
}

try {
  mount()
} catch (e) {
  // If anything goes wrong, leave the official page exactly as it is.
  console.warn('[LapClip Visualizer] failed to mount; original page intact', e)
}
