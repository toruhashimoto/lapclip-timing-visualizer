import type { RiderResult } from '../types'

// Live race-situation grouping for a mass-start race. Riders on the lead lap are
// clustered into on-road groups by their time gap to the leader: a sustained
// jump (> splitMs) between consecutive gaps marks a group boundary. This mirrors
// how a TV race tracker shows 逃げ (breakaway) / メイン集団 (peloton) / 遅れ.

export type RaceGroupKind = 'break' | 'peloton' | 'chase' | 'behind'

export type RaceGroup = {
  kind: RaceGroupKind
  label: string
  riders: RiderResult[]
  size: number
  frontGapMs: number // gap of the group's front rider to the overall leader
  spanMs: number // gap spread within the group (front to back)
}

const LABELS: Record<RaceGroupKind, string> = {
  break: '逃げ',
  peloton: 'メイン集団',
  chase: '追走',
  behind: '遅れ',
}

// A gap jump (in ms) large enough to call it a separate group. ~10s is a
// reasonable on-road threshold; bunch riders all sit near the same gap.
export const DEFAULT_SPLIT_MS = 10000

export function clusterGroups(
  riders: RiderResult[],
  splitMs: number = DEFAULT_SPLIT_MS,
): RaceGroup[] {
  const onLead = riders
    .filter((r) => r.lapsDown == null && r.gapMs != null)
    .sort((a, b) => (a.gapMs as number) - (b.gapMs as number))

  const raw: RiderResult[][] = []
  let cur: RiderResult[] = []
  for (const r of onLead) {
    const prev = cur[cur.length - 1]
    if (prev && (r.gapMs as number) - (prev.gapMs as number) > splitMs) {
      raw.push(cur)
      cur = []
    }
    cur.push(r)
  }
  if (cur.length) raw.push(cur)
  if (raw.length === 0) return []

  const sizes = raw.map((g) => g.length)
  const largest = sizes.indexOf(Math.max(...sizes))

  return raw.map((g, i): RaceGroup => {
    const frontGapMs = g[0].gapMs ?? 0
    const spanMs = (g[g.length - 1].gapMs ?? 0) - frontGapMs
    let kind: RaceGroupKind
    if (i === 0) kind = largest === 0 ? 'peloton' : 'break'
    else if (i === largest) kind = 'peloton'
    else if (i < largest) kind = 'chase'
    else kind = 'behind'
    return { kind, label: LABELS[kind], riders: g, size: g.length, frontGapMs, spanMs }
  })
}

// Riders a full lap (or more) down — shown apart from the on-road groups.
export function lappedRiders(riders: RiderResult[]): RiderResult[] {
  return riders.filter((r) => r.lapsDown != null && r.lapsDown > 0)
}

// The set of intermediate points (SP1, SP2, KOM…) the field has passed so far.
export function passedCheckpoints(riders: RiderResult[]): string[] {
  const seen = new Set<string>()
  for (const r of riders) {
    if (r.lastCheckpoint && r.lastCheckpoint !== 'FINISH') seen.add(r.lastCheckpoint)
  }
  return [...seen].sort()
}
