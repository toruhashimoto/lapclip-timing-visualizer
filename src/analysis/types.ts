// Types for the analysis page (per-lap history of a mass-start race).
// All values come from the public laptimes.php pages read in the viewer's own
// browser; nothing here is persisted.

// One row of laptimes.php: 周回 / 順位 / ラップタイム / トータルタイム.
export type LapRow = {
  lap: number | 'FINISH'
  pos: number | null // 通過順位 at that line crossing
  lapMs: number | null
  cumMs: number | null
}

export type LapPoint = { cumMs: number; pos: number | null; lapMs: number | null }

export type RiderMeta = { bib: string; name: string; teamCode: string | null }

export type RiderLapHistory = RiderMeta & {
  laps: Map<number, LapPoint> // lap number -> crossing; FINISH = race finish lap
  finished: boolean
}

export type LapHistory = {
  riders: RiderLapHistory[]
  lapNumbers: number[] // laps with at least one crossing, ascending
  missingLaps: number[] // laps in 1..max with no crossing for anyone
  failedBibs: string[] // laptimes.php pages that failed to load
}

// Riders crossing a lap line together (consecutive gaps < threshold).
export type Group = {
  lap: number
  riders: string[] // bibs in crossing order
  frontGapMs: number // front rider's gap to the lap leader
  spanMs: number // front-to-back spread of the group
}

export type SplitKind = '中切れ' | '抜け出し' | '脱落'

export type SplitEvent = {
  type: 'split'
  lap: number
  kind: SplitKind
  a: string // last rider ahead of the gap
  b: string // first rider behind the gap (couldn't hold the wheel)
  frontSize: number
  rearSize: number
  gapMs: number // a→b gap at the confirming lap
  followUp: { lap: number; gapMs: number }[] // later laps while a/b stay apart
  rejoinedLap: number | null
  transient: boolean // rejoined on the very next measured lap
}
export type MergeEvent = { type: 'merge'; lap: number; size: number; fromGroups: number }
export type PulledEvent = { type: 'pulled'; lap: number; bibs: string[] }
export type RaceEvent = SplitEvent | MergeEvent | PulledEvent
