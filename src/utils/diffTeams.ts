import type { FeedEvent, TeamData, TeamResult } from '../types'
import { teamKey } from '../types'
import { formatGapMs, formatTimeMs } from './formatTime'

export type TeamDiffResult = {
  teams: TeamResult[]
  events: FeedEvent[]
}

function lapsDone(t: TeamResult): number {
  return t.lapsCumMs.filter((x) => x != null).length
}

export function diffTeams(
  curr: TeamData,
  prev: TeamData | null,
): TeamDiffResult {
  const prevByKey = new Map<string, TeamResult>()
  if (prev) for (const t of prev.teams) prevByKey.set(teamKey(t), t)

  const prevLeader = prev?.teams.find((t) => t.rank === 1) ?? null
  const currLeader = curr.teams.find((t) => t.rank === 1) ?? null

  const events: FeedEvent[] = []
  const at = curr.fetchedAt

  const teams = curr.teams.map((t) => {
    const key = teamKey(t)
    const before = prevByKey.get(key)
    const justFinished =
      !!prev && t.finishMs != null && (!before || before.finishMs == null)
    const advanced =
      !!before && lapsDone(t) > lapsDone(before) && t.finishMs == null
    const isUpdated = justFinished || advanced
    const previousRank = before?.rank ?? null
    const rankDelta =
      previousRank != null && t.rank != null ? previousRank - t.rank : null

    if (prev) {
      if (justFinished) {
        events.push({
          id: `${at}-tfinish-${key}`,
          at,
          kind: 'finish',
          riderKey: key,
          text: `[${t.teamCode}] ${t.teamName} FINISH P${t.rank ?? '?'} ${formatTimeMs(t.finishMs)} ${formatGapMs(t.gapMs)}`,
        })
      } else if (advanced) {
        events.push({
          id: `${at}-tsplit-${key}-${lapsDone(t)}`,
          at,
          kind: 'split',
          riderKey: key,
          text: `[${t.teamCode}] ${t.teamName} Lap ${lapsDone(t)} ${formatTimeMs(t.lapsCumMs[lapsDone(t) - 1])}`,
        })
      } else if (rankDelta != null && Math.abs(rankDelta) >= 1) {
        events.push({
          id: `${at}-trank-${key}`,
          at,
          kind: 'rank',
          riderKey: key,
          text: `[${t.teamCode}] ${t.teamName} ${rankDelta > 0 ? '▲' : '▼'} P${t.rank} (was P${previousRank})`,
        })
      }
    }

    return { ...t, previousRank, rankDelta, isUpdated }
  })

  if (
    prev &&
    currLeader &&
    (!prevLeader || teamKey(prevLeader) !== teamKey(currLeader))
  ) {
    events.unshift({
      id: `${at}-tleader-${teamKey(currLeader)}`,
      at,
      kind: 'leader',
      riderKey: teamKey(currLeader),
      text: `New leader: [${currLeader.teamCode}] ${currLeader.teamName} ${formatTimeMs(currLeader.finishMs)}`,
    })
  }

  return { teams, events }
}
