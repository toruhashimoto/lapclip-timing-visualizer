import type { RiderResult } from '../types'

function bibNum(r: RiderResult): number {
  const n = parseInt(r.bib, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

// Orders riders for the timing tower and assigns canonical rank/gap.
//
// Only FINISH (2-lap) times determine the classification: finishers are ranked
// 1..N by finish time, with gap measured against the fastest finish. Riders who
// have only passed the intermediate (中間点) are still on course — they are NOT
// mixed into the finish ranking (otherwise their shorter 1-lap time would
// wrongly float to the top). They are listed next, ordered by intermediate
// time, followed by everyone not yet timed.
export function normalizeRiders(riders: RiderResult[]): RiderResult[] {
  const finishers = riders.filter((r) => r.finishMs != null)
  const onCourse = riders.filter(
    (r) => r.finishMs == null && r.intermediateMs != null,
  )
  const others = riders.filter(
    (r) => r.finishMs == null && r.intermediateMs == null,
  )

  finishers.sort((a, b) => a.finishMs! - b.finishMs!)
  const leaderMs = finishers.length ? finishers[0].finishMs! : null

  const rankedFinishers: RiderResult[] = finishers.map((r, i) => ({
    ...r,
    rank: i + 1,
    gapMs: leaderMs != null ? r.finishMs! - leaderMs : null,
  }))

  const rankedOnCourse: RiderResult[] = [...onCourse]
    .sort((a, b) => a.intermediateMs! - b.intermediateMs!)
    .map((r) => ({ ...r, rank: null, gapMs: null }))

  const rankedOthers: RiderResult[] = [...others]
    .sort((a, b) => bibNum(a) - bibNum(b))
    .map((r) => ({ ...r, rank: null, gapMs: null }))

  return [...rankedFinishers, ...rankedOnCourse, ...rankedOthers]
}

export function finisherCount(riders: RiderResult[]): number {
  return riders.filter((r) => r.finishMs != null).length
}
