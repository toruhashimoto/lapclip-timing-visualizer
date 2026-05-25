// Vanilla (no-framework) renderer for the bookmarklet build. Builds the F1-style
// overlay as plain DOM so the bundle stays tiny and can run with zero deps,
// inline or via a one-line loader. Reuses the framework-agnostic parser +
// time/gap logic; only the rendering is reimplemented without React.
import type { LapClipData, TeamData } from '../types'
import { formatTimeMs, formatGapMs } from '../utils/formatTime'
import { gapBandForRider, classifyGap } from '../utils/classifyGap'
import { lapSplits, perLapBest } from '../utils/normalizeTeams'

// Gap-band key -> concrete colour (the shared bands use Tailwind class names,
// which don't exist in our isolated Shadow DOM, so we map to hex here).
const COLOR: Record<string, string> = {
  best: '#a855f7',
  close: '#10b981',
  contender: '#facc15',
  losing: '#f97316',
  offpace: '#ef4444',
  none: '#3f3f46',
}

export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
.wrap { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; background: #09090b; color: #e4e4e7; overflow-y: auto; }
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #18181b; border-bottom: 1px solid #27272a; position: sticky; top: 0; z-index: 2; }
.title { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #fafafa; }
.sub { font-size: 11px; color: #a1a1aa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp { flex: 1; }
button { font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 6px; border: 1px solid #3f3f46; background: #27272a; color: #e4e4e7; cursor: pointer; }
button.primary { border-color: #7c3aed; background: #6d28d9; color: #fff; font-weight: 600; }
button.on { border-color: #7c3aed; background: #3b0764; color: #e9d5ff; }
.note { padding: 4px 10px; font-size: 11px; color: #fbbf24; background: rgba(120,53,15,.35); }
.scroll { flex: 1; overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #71717a; padding: 6px 8px; border-bottom: 1px solid #3f3f46; position: sticky; top: 0; background: #09090b; }
td { padding: 6px 8px; border-bottom: 1px solid #1f1f23; white-space: nowrap; }
.rank { font-weight: 700; text-align: center; width: 34px; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Consolas, monospace; }
.name { white-space: normal; min-width: 8rem; }
.team { color: #a1a1aa; font-size: 11px; }
.r { text-align: right; }
.barcell { width: 130px; }
.track { background: #1f1f23; border-radius: 9999px; height: 8px; width: 100%; }
.fill { height: 8px; border-radius: 9999px; min-width: 2px; }
.empty { padding: 48px 16px; text-align: center; color: #71717a; font-size: 13px; }
.best { color: #c084fc; font-weight: 600; }
`

export function h(
  tag: string,
  attrs: Record<string, string> = {},
  ...kids: Array<Node | string>
): HTMLElement {
  const e = document.createElement(tag)
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k]
    else e.setAttribute(k, attrs[k])
  }
  for (const kid of kids) e.append(typeof kid === 'string' ? document.createTextNode(kid) : kid)
  return e
}

function gapBar(gapMs: number | null, scaleMs: number, color: string): HTMLElement {
  const track = h('div', { class: 'track' })
  const pct = gapMs == null ? 0 : Math.min(100, (gapMs / scaleMs) * 100)
  track.append(h('div', { class: 'fill', style: `width:${pct}%;background:${color}` }))
  return track
}

export function renderIndividual(data: LapClipData): HTMLElement {
  const riders = data.riders
  if (!riders.length)
    return h('div', { class: 'empty' }, 'この公式ページから読み取れる結果がまだありません。')

  let maxGap = 0
  for (const r of riders) if (r.gapMs != null && r.gapMs > maxGap) maxGap = r.gapMs
  const scale = Math.min(30000, Math.max(1000, maxGap))

  const head = h(
    'tr',
    {},
    h('th', { class: 'rank' }, 'P'),
    h('th', {}, 'No'),
    h('th', {}, 'Team'),
    h('th', {}, 'Rider'),
    h('th', { class: 'r' }, '中間'),
    h('th', { class: 'r' }, 'Finish'),
    h('th', { class: 'r' }, 'Gap'),
    h('th', { class: 'barcell' }, ''),
  )
  const body = h('tbody')
  for (const r of riders) {
    const band = gapBandForRider(r)
    const gapText = r.finishMs == null ? '' : formatGapMs(r.gapMs)
    body.append(
      h(
        'tr',
        {},
        h('td', { class: 'rank' }, r.rank != null ? String(r.rank) : '–'),
        h('td', { class: 'mono' }, r.bib),
        h('td', { class: 'team' }, r.teamCode ?? ''),
        h('td', { class: 'name' }, r.name),
        h('td', { class: 'r mono' }, formatTimeMs(r.intermediateMs)),
        h('td', { class: 'r mono' }, formatTimeMs(r.finishMs)),
        h('td', { class: 'r mono', style: `color:${COLOR[band.key]}` }, gapText || '–'),
        h('td', { class: 'barcell' }, gapBar(r.gapMs, scale, COLOR[band.key])),
      ),
    )
  }
  const table = h('table', {}, h('thead', {}, head), body)
  return h('div', { class: 'scroll' }, table)
}

export function renderTeam(data: TeamData): HTMLElement {
  const teams = data.teams
  const laps = Math.max(1, data.laps)
  if (!teams.length)
    return h('div', { class: 'empty' }, 'この公式ページから読み取れるチーム結果がまだありません。')

  const best = perLapBest(teams, laps)
  let maxGap = 0
  for (const t of teams) if (t.gapMs != null && t.gapMs > maxGap) maxGap = t.gapMs
  const scale = Math.min(60000, Math.max(1000, maxGap))

  const headCells = [
    h('th', { class: 'rank' }, 'P'),
    h('th', {}, 'Team'),
  ]
  for (let i = 0; i < laps; i++) headCells.push(h('th', { class: 'r' }, `Lap ${i + 1}`))
  headCells.push(h('th', { class: 'r' }, 'Total'), h('th', { class: 'r' }, 'Gap'), h('th', { class: 'barcell' }, ''))
  const head = h('tr', {}, ...headCells)

  const anyLap = teams.some((t) => t.lapsCumMs.some((x) => x != null))
  const body = h('tbody')
  for (const t of teams) {
    const band = classifyGap(t.gapMs)
    const cells = [
      h('td', { class: 'rank' }, t.rank != null ? String(t.rank) : '–'),
      h('td', { class: 'name' }, h('span', { class: 'team' }, t.teamCode ? `[${t.teamCode}] ` : ''), document.createTextNode(t.teamName)),
    ]
    const sp = lapSplits(t)
    for (let i = 0; i < laps; i++) {
      const v = sp[i]
      const isBest = v != null && best[i] != null && v === best[i]
      cells.push(h('td', { class: isBest ? 'r mono best' : 'r mono' }, v != null ? formatTimeMs(v) : '–'))
    }
    cells.push(
      h('td', { class: 'r mono' }, formatTimeMs(t.finishMs)),
      h('td', { class: 'r mono', style: `color:${COLOR[band.key]}` }, t.finishMs == null ? '–' : formatGapMs(t.gapMs)),
      h('td', { class: 'barcell' }, gapBar(t.gapMs, scale, COLOR[band.key])),
    )
    body.append(h('tr', {}, ...cells))
  }
  const table = h('table', {}, h('thead', {}, head), body)
  const wrap = h('div', { class: 'scroll' }, table)
  if (!anyLap) {
    wrap.prepend(
      h('div', { class: 'note' }, '周回データが公式ページにありません（FINISH only）。'),
    )
  }
  return wrap
}
