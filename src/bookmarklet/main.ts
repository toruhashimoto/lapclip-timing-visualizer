// PC bookmarklet entry. Runs ON the official LapClip result page (the user
// clicks the bookmarklet there), reads that page's DOM, and overlays the F1
// timing UI in a Shadow DOM. No network requests, no storage, no redistribution.
// Clicking the bookmarklet again (or "更新") just re-reads the current DOM.
import type { Mode } from '../types'
import { parseIndividual, parseTeam, detectMode } from '../userscript/parseDom'
import { normalizeRiders } from '../utils/normalizeRiders'
import { normalizeTeams } from '../utils/normalizeTeams'
import { STYLES, h, renderIndividual, renderTeam } from './render'

const HOST_ID = 'lc-bm-host'

function mount() {
  // Already open → just refresh (re-parse the live DOM).
  const existing = document.getElementById(HOST_ID)
  if (existing) {
    existing.dispatchEvent(new CustomEvent('lc-refresh'))
    return
  }

  const host = h('div', { id: HOST_ID })
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLES
  shadow.appendChild(style)

  let mode: Mode = detectMode()

  const title = h('span', { class: 'title' }, 'LapClip Timing')
  const sub = h('span', { class: 'sub' }, '')
  const indBtn = h('button', {}, '個人')
  const teamBtn = h('button', {}, 'チーム')
  const refreshBtn = h('button', { class: 'primary' }, '更新')
  const closeBtn = h('button', {}, '元の表示に戻す')
  const bar = h(
    'div',
    { class: 'bar' },
    title,
    sub,
    h('span', { class: 'sp' }),
    indBtn,
    teamBtn,
    refreshBtn,
    closeBtn,
  )
  const note = h(
    'div',
    { class: 'note' },
    '非公式の表示補助ツールです。公式結果は LapClip の表示を確認してください。',
  )
  const bodyHost = h('div', {
    style: 'flex:1;display:flex;flex-direction:column;min-height:0',
  })

  const wrap = h('div', { class: 'wrap' }, bar, note, bodyHost)
  shadow.appendChild(wrap)

  function render() {
    try {
      if (mode === 'team') {
        const td = parseTeam()
        td.teams = normalizeTeams(td.teams)
        sub.textContent = [td.eventName, td.categoryName].filter(Boolean).join(' / ')
        bodyHost.replaceChildren(renderTeam(td))
      } else {
        const d = parseIndividual()
        d.riders = normalizeRiders(d.riders)
        sub.textContent = [d.eventName, d.categoryName].filter(Boolean).join(' / ')
        bodyHost.replaceChildren(renderIndividual(d))
      }
    } catch (e) {
      // Never break the official page if parsing fails.
      bodyHost.replaceChildren(
        h('div', { class: 'empty' }, '解析に失敗しました。公式ページはそのままご利用ください。'),
      )
      console.warn('[LapClip Bookmarklet] parse failed; page intact', e)
    }
    indBtn.className = mode === 'individual' ? 'on' : ''
    teamBtn.className = mode === 'team' ? 'on' : ''
  }

  indBtn.onclick = () => {
    mode = 'individual'
    render()
  }
  teamBtn.onclick = () => {
    mode = 'team'
    render()
  }
  refreshBtn.onclick = render
  host.addEventListener('lc-refresh', render)
  closeBtn.onclick = () => host.remove() // restore the untouched official page

  render()
}

try {
  mount()
} catch (e) {
  console.warn('[LapClip Bookmarklet] mount failed; official page intact', e)
}
