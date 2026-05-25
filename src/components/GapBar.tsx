import { classifyGap } from '../utils/classifyGap'

type Props = {
  gapMs: number | null
  scaleMs: number
}

// A horizontal bar whose length encodes the gap to the leader's finish time,
// coloured by gap band. Riders without a finish gap render an empty track.
export function GapBar({ gapMs, scaleMs }: Props) {
  if (gapMs == null) {
    return (
      <div className="h-2 w-full rounded-full bg-zinc-800/50" aria-hidden="true" />
    )
  }

  const band = classifyGap(gapMs)
  const denom = scaleMs > 0 ? scaleMs : 1
  const pct = Math.max(3, Math.min(100, (gapMs / denom) * 100))

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/50">
      <div
        className={`lc-bar h-full rounded-full ${band.barClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
