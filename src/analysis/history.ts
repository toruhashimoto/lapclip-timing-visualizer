import type { LapHistory, LapPoint, LapRow, RiderLapHistory, RiderMeta } from './types'

// Build the per-lap history from each rider's laptimes.php rows.
// FINISH is numbered race-wide as (max numbered lap of anyone) + 1, so a
// finisher who missed the last timed lap still finishes on the same lap as
// everyone else.
export function assembleHistory(
  entries: { meta: RiderMeta; rows: LapRow[] }[],
  failedBibs: string[],
): LapHistory {
  let maxLap = 0
  for (const e of entries)
    for (const row of e.rows)
      if (row.lap !== 'FINISH' && row.cumMs != null) maxLap = Math.max(maxLap, row.lap)
  const finishLap = maxLap + 1

  const riders: RiderLapHistory[] = entries.map(({ meta, rows }) => {
    const laps = new Map<number, LapPoint>()
    let finished = false
    for (const row of rows) {
      if (row.cumMs == null) continue
      const point: LapPoint = { cumMs: row.cumMs, pos: row.pos, lapMs: row.lapMs }
      if (row.lap === 'FINISH') {
        laps.set(finishLap, point)
        finished = true
      } else laps.set(row.lap, point)
    }
    return { ...meta, laps, finished }
  })

  const seen = new Set<number>()
  for (const rider of riders) for (const lap of rider.laps.keys()) seen.add(lap)
  const lapNumbers = [...seen].sort((a, b) => a - b)
  const last = lapNumbers.length ? lapNumbers[lapNumbers.length - 1] : 0
  const missingLaps: number[] = []
  for (let lap = 1; lap <= last; lap++) if (!seen.has(lap)) missingLaps.push(lap)

  return { riders, lapNumbers, missingLaps, failedBibs }
}
