import type { TeamResult } from '../types'

function lapsDone(t: TeamResult): number {
  return t.lapsCumMs.filter((x) => x != null).length
}

function lastCum(t: TeamResult): number {
  for (let i = t.lapsCumMs.length - 1; i >= 0; i--) {
    const v = t.lapsCumMs[i]
    if (v != null) return v
  }
  return Number.MAX_SAFE_INTEGER
}

// Per-lap split durations (cumulative[i] - cumulative[i-1]); null where unknown.
export function lapSplits(t: TeamResult): (number | null)[] {
  return t.lapsCumMs.map((cum, i) => {
    if (cum == null) return null
    const prev = i > 0 ? t.lapsCumMs[i - 1] : 0
    if (prev == null) return null
    return cum - prev
  })
}

// Fastest split per lap across all teams (for the purple per-lap-best highlight).
export function perLapBest(teams: TeamResult[], laps: number): (number | null)[] {
  const best: (number | null)[] = Array(laps).fill(null)
  for (const t of teams) {
    const sp = lapSplits(t)
    for (let i = 0; i < laps; i++) {
      const s = sp[i]
      if (s != null && (best[i] == null || s < best[i]!)) best[i] = s
    }
  }
  return best
}

// Finishers ranked by finish time; on-course teams (by laps done, then progress)
// next; not-yet-started last. Gap is to the leading team's finish.
export function normalizeTeams(teams: TeamResult[]): TeamResult[] {
  const finishers = teams.filter((t) => t.finishMs != null)
  const onCourse = teams.filter(
    (t) => t.finishMs == null && t.lapsCumMs.some((x) => x != null),
  )
  const others = teams.filter(
    (t) => t.finishMs == null && !t.lapsCumMs.some((x) => x != null),
  )

  finishers.sort((a, b) => a.finishMs! - b.finishMs!)
  const leaderMs = finishers.length ? finishers[0].finishMs! : null

  const rankedFinishers: TeamResult[] = finishers.map((t, i) => ({
    ...t,
    rank: i + 1,
    gapMs: leaderMs != null ? t.finishMs! - leaderMs : null,
  }))

  const rankedOnCourse: TeamResult[] = [...onCourse]
    .sort((a, b) => lapsDone(b) - lapsDone(a) || lastCum(a) - lastCum(b))
    .map((t) => ({ ...t, rank: null, gapMs: null }))

  const rankedOthers: TeamResult[] = [...others]
    .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
    .map((t) => ({ ...t, rank: null, gapMs: null }))

  return [...rankedFinishers, ...rankedOnCourse, ...rankedOthers]
}

export function teamFinisherCount(teams: TeamResult[]): number {
  return teams.filter((t) => t.finishMs != null).length
}
