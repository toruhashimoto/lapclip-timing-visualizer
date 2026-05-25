import type { RiderResult } from '../types'

function bibNum(r: RiderResult): number {
  const n = parseInt(r.bib, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

// Orders a mass-start field (criterium / road) and assigns the canonical rank.
//
// Unlike the time trial, a mass-start result CANNOT be ranked by time: a bunch
// finish gives dozens of riders the identical time, so only the official placing
// (位) separates them. We therefore sort by officialRank, falling back to elapsed
// time then bib when the source hasn't assigned a place yet (early in a live
// race). Lead-lap riders keep their source gap; lapped riders ("-N周") have
// gapMs = null and are distinguished by lapsDown instead.
export function normalizeMassStart(riders: RiderResult[]): RiderResult[] {
  const sorted = [...riders].sort((a, b) => {
    const ra = a.officialRank ?? Number.MAX_SAFE_INTEGER
    const rb = b.officialRank ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    const ea = a.elapsedMs ?? Number.MAX_SAFE_INTEGER
    const eb = b.elapsedMs ?? Number.MAX_SAFE_INTEGER
    if (ea !== eb) return ea - eb
    return bibNum(a) - bibNum(b)
  })

  // The leader's elapsed time anchors gap computation when the source omits it.
  const leaderMs =
    sorted.find((r) => r.lapsDown == null && r.elapsedMs != null)?.elapsedMs ??
    null

  return sorted.map((r) => {
    let gapMs = r.gapMs
    if (
      gapMs == null &&
      r.lapsDown == null &&
      r.elapsedMs != null &&
      leaderMs != null
    ) {
      gapMs = r.elapsedMs - leaderMs
    }
    // Trust the official place; leave it null before the source assigns one
    // (a pre-start start list shows "-"), so the P column reads "–".
    return { ...r, rank: r.officialRank ?? null, gapMs }
  })
}

// Riders currently on the lead lap (not lapped, not abandoned).
export function leadLapCount(riders: RiderResult[]): number {
  return riders.filter((r) => r.lapsDown == null && r.elapsedMs != null).length
}

// The leader's lap, for the header lap counter. A finisher (road race) has no
// lapsDone but has completed the full distance, so count them as lapsTotal.
export function leaderLap(
  riders: RiderResult[],
  lapsTotal: number | null,
): number | null {
  let max: number | null = null
  for (const r of riders) {
    const lap =
      r.lapsDone ?? (r.isFinisher && lapsTotal != null ? lapsTotal : null)
    if (lap != null && (max == null || lap > max)) max = lap
  }
  return max
}
