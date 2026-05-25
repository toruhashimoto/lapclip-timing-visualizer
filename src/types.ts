// Shared domain types. The Express server imports these with `import type`
// only, so there is no runtime coupling between the browser and server bundles.

export type RiderStatus =
  | 'FINISH'
  | 'RUNNING'
  | 'WAIT'
  | 'DNS'
  | 'DNF'
  | 'DNQ'
  | 'DSQ'
  | 'UNKNOWN'

export type RiderResult = {
  rank: number | null
  bib: string
  teamCode: string | null
  name: string
  status: RiderStatus

  // Two cumulative-from-start times for this 2-lap time trial:
  //   intermediate = elapsed at the mid/lap-1 point (中間点)
  //   finish       = elapsed at the 2-lap finish (フィニッシュ)
  // The source only shows one phase per rider at a time, so a finisher's
  // intermediate is retained from earlier fetches (see App ingest).
  intermediateText: string | null
  intermediateMs: number | null
  finishText: string | null
  finishMs: number | null

  // Gap to the leader's FINISH time (computed).
  gapText: string | null
  gapMs: number | null

  // Derived client-side by diffing against the previous fetch.
  previousRank?: number | null
  rankDelta?: number | null
  isNew?: boolean
  isUpdated?: boolean
  isFavorite?: boolean
}

export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'error'

export type LapClipData = {
  eventName: string
  categoryName: string
  sourceUrl: string
  fetchedAt: string // ISO 8601
  riders: RiderResult[]
  isMock?: boolean
  // Set by the proxy's shared cache layer.
  cacheStatus?: CacheStatus
  cacheAgeSec?: number
  source?: string
}

// Team time trial: one row per team, with a cumulative time at each lap
// checkpoint (last = finish). lapsCumMs.length matches the stage's lap count.
export type TeamResult = {
  rank: number | null
  teamCode: string
  teamName: string
  status: RiderStatus
  lapsCumMs: (number | null)[] // cumulative time at lap 1, 2, 3 ...
  finishMs: number | null
  finishText: string | null
  gapText: string | null
  gapMs: number | null

  previousRank?: number | null
  rankDelta?: number | null
  isNew?: boolean
  isUpdated?: boolean
  isFavorite?: boolean
}

export type TeamData = {
  eventName: string
  categoryName: string
  sourceUrl: string
  fetchedAt: string
  laps: number // number of lap checkpoints (e.g., 3 for 大鹿)
  teams: TeamResult[]
  isMock?: boolean
  cacheStatus?: CacheStatus
  cacheAgeSec?: number
  source?: string
}

// Runtime config the server exposes to the client via GET /api/config.
export type AppConfig = {
  appMode: 'local' | 'shared'
  timingMode: 'individual_tt' | 'team_tt'
  sourceUrl: string | null // fixed source in shared mode; null in local
  publicWindow: { start: string | null; end: string | null; timezone: string }
  refreshIntervalSec: number
  minRefreshSec: number
  features: { history: boolean; export: boolean; screenshot: boolean }
}

// Shape returned by the local proxy on failure (non-2xx status code).
export type LapClipApiError = {
  error: string
}

// A single line in the live update feed.
export type FeedEvent = {
  id: string
  at: string // ISO 8601 of the fetch that produced this event
  kind: 'leader' | 'finish' | 'updated' | 'rank' | 'new' | 'split'
  riderKey: string
  text: string
}

export type DisplayMode = 'top10' | 'top20' | 'all'
export type SortMode = 'rank' | 'bib' | 'team' | 'latest'

// Individual time trial vs team time trial display.
export type Mode = 'individual' | 'team'

export type Settings = {
  autoRefresh: boolean
  refreshIntervalSec: number
  displayMode: DisplayMode
  sortMode: SortMode
  mode: Mode
}

// Stable identity for a rider across fetches.
export function riderKey(r: Pick<RiderResult, 'bib' | 'teamCode' | 'name'>): string {
  return `${r.bib}-${r.teamCode ?? ''}-${r.name}`
}

export function teamKey(t: Pick<TeamResult, 'teamCode' | 'teamName'>): string {
  return `${t.teamCode}-${t.teamName}`
}
