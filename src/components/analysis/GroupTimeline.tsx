import { useMemo } from 'react'
import { leaderTimes } from '../../analysis/groups'
import type { Group, LapHistory, RaceEvent } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear, niceStep } from './svgAxis'

type Props = {
  history: LapHistory
  byLap: Map<number, Group[]>
  events: RaceEvent[]
  selected: string[] // bibs, colour order
  highlightLap: number | null
}

const W = 960
const H = 340
const M = { l: 44, r: 16, t: 18, b: 26 }

// ① Group timeline: x = lap, y = gap to the lap leader (seconds, growing down).
// Each group is a vertical band (width ∝ √size); ◆ split / ● merge / × pulled.
export function GroupTimeline({ history, byLap, events, selected, highlightLap }: Props) {
  const laps = lapRange(history)
  const leaders = useMemo(() => leaderTimes(history), [history])
  const names = useMemo(() => new Map(history.riders.map((r) => [r.bib, r.name])), [history])

  const maxGapS = useMemo(() => {
    let m = 10
    for (const gs of byLap.values()) for (const g of gs) m = Math.max(m, (g.frontGapMs + g.spanMs) / 1000)
    return m
  }, [byLap])
  const maxSize = useMemo(() => {
    let m = 1
    for (const gs of byLap.values()) for (const g of gs) m = Math.max(m, g.riders.length)
    return m
  }, [byLap])

  const x = linear(1, Math.max(2, laps.length), M.l + 10, W - M.r - 10)
  const y = linear(0, maxGapS, M.t, H - M.b)
  const step = (W - M.l - M.r) / Math.max(1, laps.length)
  const maxBw = Math.min(22, step * 0.7)
  const yStep = niceStep(maxGapS)
  const ticks = Array.from({ length: Math.floor(maxGapS / yStep) + 1 }, (_, i) => i * yStep)

  const gapOf = (bib: string, lap: number): number | null => {
    const r = history.riders.find((rr) => rr.bib === bib)
    const p = r?.laps.get(lap)
    const lead = leaders.get(lap)
    return p && lead != null ? (p.cumMs - lead) / 1000 : null
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="集団タイムライン">
      {highlightLap != null && (
        <rect x={x(highlightLap) - step / 2} y={M.t} width={step} height={H - M.t - M.b} fill="#7c3aed" opacity={0.18} />
      )}
      <ValueAxis ticks={ticks} y={(v) => y(v)} x0={M.l} x1={W - M.r} format={(v) => `+${v}s`} />
      <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />

      {[...byLap].flatMap(([lap, groups]) =>
        groups.map((g, gi) => {
          const bw = Math.max(3, maxBw * Math.sqrt(g.riders.length / maxSize))
          const top = y(g.frontGapMs / 1000)
          const h = Math.max(3, y((g.frontGapMs + g.spanMs) / 1000) - top)
          const members = g.riders.map((b) => `No.${b} ${names.get(b) ?? ''}`).join('\n')
          return (
            <g key={`${lap}-${gi}`}>
              <rect x={x(lap) - bw / 2} y={top} width={bw} height={h} rx={2} fill="#a1a1aa" opacity={0.35 + 0.5 * (g.riders.length / maxSize)}>
                <title>{`L${lap} 集団 ${g.riders.length}名 +${(g.frontGapMs / 1000).toFixed(1)}s\n${members}`}</title>
              </rect>
              {g.riders.length > 1 && (
                <text x={x(lap) + bw / 2 + 2} y={top + 8} fontSize={8} fill="#a1a1aa">{g.riders.length}</text>
              )}
            </g>
          )
        }),
      )}

      {selected.map((bib, i) => {
        const pts = history.lapNumbers
          .map((lap) => ({ lap, g: gapOf(bib, lap) }))
          .filter((p): p is { lap: number; g: number } => p.g != null)
          .map((p) => `${x(p.lap)},${y(p.g)}`)
        return pts.length > 1 ? (
          <polyline key={bib} points={pts.join(' ')} fill="none" stroke={RIDER_COLORS[i % RIDER_COLORS.length]} strokeWidth={1.8} />
        ) : null
      })}

      {events.map((e, i) => {
        if (e.type === 'split') {
          const g = gapOf(e.b, e.lap)
          if (g == null) return null
          const cx = x(e.lap)
          const cy = y(g)
          return (
            <path key={i} d={`M${cx},${cy - 5} L${cx + 5},${cy} L${cx},${cy + 5} L${cx - 5},${cy} Z`} fill={e.transient ? '#78350f' : '#f59e0b'}>
              <title>{`L${e.lap} ${e.kind} No.${e.a} ⇢ No.${e.b}`}</title>
            </path>
          )
        }
        if (e.type === 'merge')
          return (
            <circle key={i} cx={x(e.lap)} cy={M.t - 8} r={4} fill="#38bdf8">
              <title>{`L${e.lap} 合流 ${e.size}名`}</title>
            </circle>
          )
        return (
          <text key={i} x={x(e.lap)} y={M.t - 4} textAnchor="middle" fontSize={11} fill="#f87171">
            ×<title>{`L${e.lap} 除外 ${e.bibs.length}名`}</title>
          </text>
        )
      })}
    </svg>
  )
}
