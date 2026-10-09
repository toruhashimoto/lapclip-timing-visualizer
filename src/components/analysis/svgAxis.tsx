import type { LapHistory } from '../../analysis/types'

export const RIDER_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a78bfa']

export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1)
  return (v: number) => r0 + (v - d0) * k
}

// Every lap from 1 to the last measured lap (untimed laps included as slots).
export function lapRange(history: LapHistory): number[] {
  const last = history.lapNumbers[history.lapNumbers.length - 1] ?? 0
  return Array.from({ length: last }, (_, i) => i + 1)
}

export function niceStep(span: number, count = 5): number {
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  return ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow
}

// Bottom lap axis. Untimed laps get a dotted vertical guide.
export function LapAxis({
  laps, x, y0, y1, missing,
}: { laps: number[]; x: (lap: number) => number; y0: number; y1: number; missing: number[] }) {
  const every = Math.max(1, Math.ceil(laps.length / 15))
  return (
    <g className="text-zinc-500">
      <line x1={x(laps[0] ?? 1)} x2={x(laps[laps.length - 1] ?? 1)} y1={y1} y2={y1} stroke="#3f3f46" />
      {missing.map((lap) => (
        <line key={`m${lap}`} x1={x(lap)} x2={x(lap)} y1={y0} y2={y1} stroke="#52525b" strokeDasharray="2 4" />
      ))}
      {laps.map((lap) =>
        lap % every === 0 || lap === 1 ? (
          <text key={lap} x={x(lap)} y={y1 + 14} textAnchor="middle" fontSize={10} fill="currentColor">
            {lap}
          </text>
        ) : null,
      )}
    </g>
  )
}

// Left value axis with horizontal grid lines.
export function ValueAxis({
  ticks, y, x0, x1, format,
}: { ticks: number[]; y: (v: number) => number; x0: number; x1: number; format: (v: number) => string }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="#27272a" />
          <text x={x0 - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#71717a">
            {format(v)}
          </text>
        </g>
      ))}
    </g>
  )
}
