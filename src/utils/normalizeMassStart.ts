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

  const normalized = sorted.map((r) => {
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
  return applyOfficialClassification(normalized)
}

// UCI same-time rule (2025 revision): finishers are split into time groups only
// where the gap to the rider ahead is 3 seconds or more (was 1 s). Everyone in a
// group gets the group-front rider's time.
export const SAME_TIME_GAP_MS = 3000

// The race is over once someone has finished and nobody is still out on the
// lead lap: every other row is lapped, untimed or carries an abnormal status.
export function isRaceOver(riders: RiderResult[]): boolean {
  if (!riders.some((r) => r.isFinisher)) return false
  return riders.every(
    (r) =>
      r.isFinisher ||
      (r.lapsDown != null && r.lapsDown > 0) ||
      r.elapsedMs == null ||
      r.status === 'DNS' ||
      r.status === 'DNF' ||
      r.status === 'DNQ' ||
      r.status === 'DSQ',
  )
}

// Reshape the LapClip live timing to read like the commissaires' official
// result (e.g. ツール・ド・九州 2026 佐世保クリテリウム communiqué):
//   • Finishers: bunch-grouped by SAME_TIME_GAP_MS; each group shows the front
//     rider's time truncated to whole seconds, and the gap is group time −
//     winner time ("0'54\"・0\"" for the whole bunch, "9\"" for the next group).
//     The raw transponder time stays in elapsedText / finishMs.
//   • Once the race is over, lapped riders (-N周) were pulled from the race and
//     are classified DNF with no placing; untimed rows read "DNF/DNS".
// Before anyone finishes this is a no-op, so the live view is untouched.
export function applyOfficialClassification(
  riders: RiderResult[],
): RiderResult[] {
  const finishers = riders
    .filter((r) => r.isFinisher && r.elapsedMs != null)
    .sort((a, b) => (a.elapsedMs as number) - (b.elapsedMs as number))
  if (finishers.length === 0) return riders

  const official = new Map<RiderResult, number>()
  let groupMs = 0
  let prevMs: number | null = null
  for (const r of finishers) {
    const t = r.elapsedMs as number
    if (prevMs == null || t - prevMs >= SAME_TIME_GAP_MS)
      groupMs = Math.floor(t / 1000) * 1000
    official.set(r, groupMs)
    prevMs = t
  }
  const winnerMs = official.get(finishers[0]) as number
  const over = isRaceOver(riders)

  return riders.map((r) => {
    const t = official.get(r)
    if (t != null) return { ...r, elapsedMs: t, gapMs: t - winnerMs }
    if (over && r.lapsDown != null && r.lapsDown > 0)
      return { ...r, rank: null, status: 'DNF', statusText: 'DNF' }
    // An untimed row after the finish is a non-starter or an abandon — the page
    // doesn't say which, so name both rather than calling it 出走前.
    if (over && r.status === 'WAIT')
      return { ...r, rank: null, status: 'UNKNOWN', statusText: 'DNF/DNS' }
    return r
  })
}

// Riders currently on the lead lap (not lapped, not abandoned).
export function leadLapCount(riders: RiderResult[]): number {
  return riders.filter((r) => r.lapsDown == null && r.elapsedMs != null).length
}

// The leader's lap, for the header lap counter. A finisher has no lapsDone but
// has completed the full distance, so count them as lapsTotal. A criterium page
// never states the total ("N周" only), so infer it from the lapped riders: a
// rider on "28周" who is "-2周" was lapped on a 30-lap race (lapsDone + lapsDown).
export function leaderLap(
  riders: RiderResult[],
  lapsTotal: number | null,
): number | null {
  let inferred: number | null = null
  for (const r of riders)
    if (r.lapsDone != null) {
      const lap = r.lapsDone + (r.lapsDown ?? 0)
      if (inferred == null || lap > inferred) inferred = lap
    }
  const total = lapsTotal ?? inferred
  let max: number | null = null
  for (const r of riders) {
    const lap =
      r.lapsDone ?? (r.isFinisher && total != null ? total : null)
    if (lap != null && (max == null || lap > max)) max = lap
  }
  return max
}
