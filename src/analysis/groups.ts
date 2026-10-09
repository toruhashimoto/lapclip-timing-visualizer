import type { Group, LapHistory } from './types'

export const DEFAULT_THRESHOLD_MS = 3000

// Crossings of one lap line, fastest first.
function crossings(history: LapHistory, lap: number): { bib: string; t: number }[] {
  const xs: { bib: string; t: number }[] = []
  for (const r of history.riders) {
    const p = r.laps.get(lap)
    if (p) xs.push({ bib: r.bib, t: p.cumMs })
  }
  return xs.sort((a, b) => a.t - b.t)
}

// Riders crossing the lap line together: a new group starts wherever the gap
// to the rider directly ahead is >= thresholdMs.
export function groupLap(history: LapHistory, lap: number, thresholdMs: number): Group[] {
  const xs = crossings(history, lap)
  if (xs.length === 0) return []
  const leader = xs[0].t
  const raw: { bib: string; t: number }[][] = []
  let cur = [xs[0]]
  for (let i = 1; i < xs.length; i++) {
    if (xs[i].t - xs[i - 1].t >= thresholdMs) {
      raw.push(cur)
      cur = []
    }
    cur.push(xs[i])
  }
  raw.push(cur)
  return raw.map((g) => ({
    lap,
    riders: g.map((x) => x.bib),
    frontGapMs: g[0].t - leader,
    spanMs: g[g.length - 1].t - g[0].t,
  }))
}

export function groupsByLap(history: LapHistory, thresholdMs: number): Map<number, Group[]> {
  const out = new Map<number, Group[]>()
  for (const lap of history.lapNumbers) out.set(lap, groupLap(history, lap, thresholdMs))
  return out
}

export function leaderTimes(history: LapHistory): Map<number, number> {
  const out = new Map<number, number>()
  for (const lap of history.lapNumbers) {
    const xs = crossings(history, lap)
    if (xs.length) out.set(lap, xs[0].t)
  }
  return out
}
