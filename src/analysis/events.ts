import type {
  Group,
  LapHistory,
  MergeEvent,
  PulledEvent,
  RaceEvent,
  SplitEvent,
  SplitKind,
} from './types'

// Split kind from the two sides of a gap (spec §5.3).
export function classifySplit(frontSize: number, rearSize: number): SplitKind {
  if (frontSize < rearSize) return '抜け出し'
  if (rearSize <= 3) return '脱落'
  return '中切れ'
}

// Compare consecutive MEASURED laps (untimed laps are skipped) and report:
//   split  — riders who shared a group on lap P are in 2+ groups on lap L
//   merge  — a group on lap L holds riders from 2+ groups on lap P
//   pulled — a non-finisher with no crossing after lap P while the race went on
export function detectEvents(
  history: LapHistory,
  byLap: Map<number, Group[]>,
): RaceEvent[] {
  const laps = [...byLap.keys()].sort((a, b) => a - b)
  const cum = new Map<string, Map<number, number>>()
  for (const r of history.riders)
    cum.set(r.bib, new Map([...r.laps].map(([lap, p]) => [lap, p.cumMs])))
  const t = (bib: string, lap: number) => cum.get(bib)?.get(lap)

  // lap -> bib -> group index on that lap
  const index = new Map<number, Map<string, number>>()
  for (const [lap, groups] of byLap) {
    const m = new Map<string, number>()
    groups.forEach((g, gi) => g.riders.forEach((b) => m.set(b, gi)))
    index.set(lap, m)
  }

  const events: RaceEvent[] = []
  for (let k = 1; k < laps.length; k++) {
    const P = laps[k - 1]
    const L = laps[k]
    const iP = index.get(P)!
    const iL = index.get(L)!

    for (const g of byLap.get(P)!) {
      const parts = new Map<number, string[]>()
      for (const b of g.riders) {
        const gi = iL.get(b)
        if (gi == null) continue // no crossing on lap L (missed or pulled)
        parts.set(gi, [...(parts.get(gi) ?? []), b])
      }
      if (parts.size < 2) continue
      const ordered = [...parts.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([, bibs]) => bibs.sort((x, y) => (t(x, L) as number) - (t(y, L) as number)))
      for (let j = 1; j < ordered.length; j++) {
        const front = ordered.slice(0, j).flat()
        const rear = ordered.slice(j).flat()
        const a = ordered[j - 1][ordered[j - 1].length - 1]
        const b = ordered[j][0]
        events.push(splitEvent(L, a, b, front.length, rear.length, laps.slice(k + 1)))
      }
    }

    byLap.get(L)!.forEach((g) => {
      const from = new Set<number>()
      for (const b of g.riders) {
        const gi = iP.get(b)
        if (gi != null) from.add(gi)
      }
      if (from.size >= 2) {
        const merge: MergeEvent = { type: 'merge', lap: L, size: g.riders.length, fromGroups: from.size }
        events.push(merge)
      }
    })
  }

  function splitEvent(
    L: number, a: string, b: string, frontSize: number, rearSize: number, later: number[],
  ): SplitEvent {
    const followUp: { lap: number; gapMs: number }[] = []
    let rejoinedLap: number | null = null
    for (const M of later) {
      const iM = index.get(M)!
      const ga = iM.get(a)
      const gb = iM.get(b)
      if (ga == null || gb == null) break
      if (ga === gb) {
        rejoinedLap = M
        break
      }
      followUp.push({ lap: M, gapMs: (t(b, M) as number) - (t(a, M) as number) })
    }
    return {
      type: 'split', lap: L, kind: classifySplit(frontSize, rearSize), a, b, frontSize, rearSize,
      gapMs: (t(b, L) as number) - (t(a, L) as number),
      followUp, rejoinedLap, transient: rejoinedLap != null && rejoinedLap === later[0],
    }
  }

  // Pulled: last crossing on lap P, a later measured lap exists, never finished.
  const pulledByLap = new Map<number, string[]>()
  for (const r of history.riders) {
    if (r.finished || r.laps.size === 0) continue
    const last = Math.max(...r.laps.keys())
    const next = laps.find((lap) => lap > last)
    if (next == null) continue
    pulledByLap.set(next, [...(pulledByLap.get(next) ?? []), r.bib])
  }
  for (const [lap, bibs] of pulledByLap) {
    const pulled: PulledEvent = { type: 'pulled', lap, bibs }
    events.push(pulled)
  }

  const order = { split: 0, merge: 1, pulled: 2 } as const
  return events.sort((x, y) => x.lap - y.lap || order[x.type] - order[y.type])
}

export type EventFilter = {
  persistentOnly: boolean // hide splits that rejoined on the next measured lap
  majorOnly: boolean // keep only 中切れ / 抜け出し splits and merges
}

// List/timeline filter. A real criterium yields dozens of single-rider 脱落
// and 除外 events; majorOnly keeps the moves that shape the race.
export function filterEvents(events: RaceEvent[], f: EventFilter): RaceEvent[] {
  return events.filter((e) => {
    if (e.type === 'split') {
      if (f.persistentOnly && e.transient) return false
      if (f.majorOnly && e.kind === '脱落') return false
      return true
    }
    return !(f.majorOnly && e.type === 'pulled')
  })
}
