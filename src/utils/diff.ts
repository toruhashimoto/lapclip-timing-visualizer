import type { FeedEvent, LapClipData, RiderResult } from '../types'
import { riderKey } from '../types'
import { formatGapMs, formatTimeMs } from './formatTime'

export type DiffResult = {
  riders: RiderResult[]
  events: FeedEvent[]
}

function bibTeam(r: RiderResult): string {
  return `No.${r.bib}${r.teamCode ? ` [${r.teamCode}]` : ''}`
}

export function diffData(
  curr: LapClipData,
  prev: LapClipData | null,
): DiffResult {
  const prevByKey = new Map<string, RiderResult>()
  if (prev) for (const r of prev.riders) prevByKey.set(riderKey(r), r)

  const prevLeader = prev?.riders.find((r) => r.rank === 1) ?? null
  const currLeader = curr.riders.find((r) => r.rank === 1) ?? null

  const events: FeedEvent[] = []
  const at = curr.fetchedAt

  const riders = curr.riders.map((r) => {
    const key = riderKey(r)
    const before = prevByKey.get(key)
    const isNew = !!prev && !before

    const finishChanged = !!before && before.finishMs !== r.finishMs
    const justFinished =
      !!prev &&
      r.finishMs != null &&
      (!before || before.finishMs == null)

    const interChanged = !!before && before.intermediateMs !== r.intermediateMs
    const justSplit =
      !!prev &&
      r.intermediateMs != null &&
      r.finishMs == null &&
      (!before || before.intermediateMs == null)

    const isUpdated = finishChanged || justFinished || interChanged || justSplit
    const previousRank = before?.rank ?? null
    const rankDelta =
      previousRank != null && r.rank != null ? previousRank - r.rank : null

    if (prev) {
      if (justFinished) {
        events.push({
          id: `${at}-finish-${key}`,
          at,
          kind: 'finish',
          riderKey: key,
          text: `${bibTeam(r)} ${r.name} FINISH P${r.rank ?? '?'} ${formatTimeMs(r.finishMs)} ${formatGapMs(r.gapMs)}`,
        })
      } else if (justSplit) {
        events.push({
          id: `${at}-split-${key}`,
          at,
          kind: 'split',
          riderKey: key,
          text: `${bibTeam(r)} ${r.name} 中間点 ${formatTimeMs(r.intermediateMs)}`,
        })
      } else if (isNew) {
        events.push({
          id: `${at}-new-${key}`,
          at,
          kind: 'new',
          riderKey: key,
          text: `New entry: ${bibTeam(r)} ${r.name}`,
        })
      } else if (finishChanged) {
        events.push({
          id: `${at}-upd-${key}`,
          at,
          kind: 'updated',
          riderKey: key,
          text: `${bibTeam(r)} ${r.name} updated ${formatTimeMs(r.finishMs)}`,
        })
      } else if (rankDelta != null && Math.abs(rankDelta) >= 1) {
        events.push({
          id: `${at}-rank-${key}`,
          at,
          kind: 'rank',
          riderKey: key,
          text: `${bibTeam(r)} ${r.name} ${rankDelta > 0 ? '▲' : '▼'} P${r.rank} (was P${previousRank})`,
        })
      }
    }

    return { ...r, isNew, isUpdated, previousRank, rankDelta }
  })

  if (
    prev &&
    currLeader &&
    (!prevLeader || riderKey(prevLeader) !== riderKey(currLeader))
  ) {
    events.unshift({
      id: `${at}-leader-${riderKey(currLeader)}`,
      at,
      kind: 'leader',
      riderKey: riderKey(currLeader),
      text: `New leader: ${bibTeam(currLeader)} ${currLeader.name} ${formatTimeMs(currLeader.finishMs)}`,
    })
  }

  return { riders, events }
}
