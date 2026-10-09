import type { LapHistory } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear, niceStep } from './svgAxis'

const W = 560
const H = 240
const M = { l: 44, r: 10, t: 10, b: 24 }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}`

// ④ Lap-time chart for the selected riders (seconds per lap).
export function LapTimeChart({ history, selected }: { history: LapHistory; selected: string[] }) {
  const laps = lapRange(history)
  const series = selected
    .map((bib) => history.riders.find((r) => r.bib === bib))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      bib: r.bib,
      pts: history.lapNumbers
        .map((lap) => ({ lap, s: r.laps.get(lap)?.lapMs }))
        .filter((p): p is { lap: number; s: number } => p.s != null)
        .map((p) => ({ lap: p.lap, s: p.s / 1000 })),
    }))
  const all = series.flatMap((s) => s.pts.map((p) => p.s))

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">ラップタイム推移</h2>
      {all.length === 0 ? (
        <p className="px-3 py-10 text-center text-xs text-zinc-500">★ で選手を選ぶと表示されます（最大5名を色分け）</p>
      ) : (
        (() => {
          const lo = Math.floor(Math.min(...all))
          const hi = Math.ceil(Math.max(...all))
          const x = linear(1, Math.max(2, laps.length), M.l + 6, W - M.r - 6)
          const y = linear(lo, hi, H - M.b, M.t)
          const st = niceStep(hi - lo || 1)
          const ticks: number[] = []
          for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) ticks.push(v)
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ラップタイム推移">
              <ValueAxis ticks={ticks} y={y} x0={M.l} x1={W - M.r} format={fmt} />
              <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />
              {series.map((s, i) => (
                <polyline
                  key={s.bib}
                  points={s.pts.map((p) => `${x(p.lap)},${y(p.s)}`).join(' ')}
                  fill="none"
                  stroke={RIDER_COLORS[i % RIDER_COLORS.length]}
                  strokeWidth={1.8}
                />
              ))}
            </svg>
          )
        })()
      )}
    </section>
  )
}
