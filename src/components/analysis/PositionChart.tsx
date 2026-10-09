import type { LapHistory } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear } from './svgAxis'

const W = 560
const H = 260
const M = { l: 34, r: 10, t: 10, b: 24 }

// ③ Position chart: x = lap, y = 通過順位 (1 at the top). Selected riders are
// coloured; everyone else is a faint grey line.
export function PositionChart({ history, selected }: { history: LapHistory; selected: string[] }) {
  const laps = lapRange(history)
  let maxPos = 1
  for (const r of history.riders) for (const p of r.laps.values()) if (p.pos != null) maxPos = Math.max(maxPos, p.pos)
  const x = linear(1, Math.max(2, laps.length), M.l + 6, W - M.r - 6)
  const y = linear(1, maxPos, M.t, H - M.b)
  const ticks = [1, ...[10, 20, 30, 50, 75, 100, 150].filter((v) => v < maxPos), maxPos]

  const line = (bib: string) => {
    const r = history.riders.find((rr) => rr.bib === bib)
    if (!r) return ''
    return history.lapNumbers
      .map((lap) => r.laps.get(lap))
      .map((p, i) => (p?.pos != null ? `${x(history.lapNumbers[i])},${y(p.pos)}` : null))
      .filter(Boolean)
      .join(' ')
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">順位推移</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="順位推移">
        <ValueAxis ticks={ticks} y={y} x0={M.l} x1={W - M.r} format={(v) => String(v)} />
        <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />
        {history.riders
          .filter((r) => !selected.includes(r.bib))
          .map((r) => (
            <polyline key={r.bib} points={line(r.bib)} fill="none" stroke="#3f3f46" strokeWidth={0.6} />
          ))}
        {selected.map((bib, i) => (
          <polyline key={bib} points={line(bib)} fill="none" stroke={RIDER_COLORS[i % RIDER_COLORS.length]} strokeWidth={2} />
        ))}
      </svg>
    </section>
  )
}
