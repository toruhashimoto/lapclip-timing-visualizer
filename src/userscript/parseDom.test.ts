import { afterEach, describe, expect, it } from 'vitest'
import {
  detectMode,
  detectRaceShape,
  parseIndividual,
  parseLapPhase,
  parseLapsDown,
  parseMassStart,
  parseRankNum,
  parseTeam,
} from './parseDom'
import { normalizeRiders } from '../utils/normalizeRiders'
import {
  leaderLap,
  leadLapCount,
  normalizeMassStart,
} from '../utils/normalizeMassStart'
import {
  clusterGroups,
  lappedRiders,
  passedCheckpoints,
  raceSummary,
} from '../utils/groupRiders'
import {
  CRIT_TITLE,
  PRESTART_TITLE,
  ROAD8_TITLE,
  ROAD_TITLE,
  TEAM_TT_TITLE,
  TT_TITLE,
  clearPage,
  critRows,
  mountPage,
  preStartRows,
  road8FinalRows,
  road8LiveRows,
  roadRows,
  teamTTMidRows,
  ttLiveRows,
  ttRows,
} from './__fixtures__/lapclipHtml'

const CTG = (n: string) =>
  `https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=${n}`

afterEach(() => clearPage())

describe('phase grammar helpers', () => {
  it('parseLapPhase: criterium lap count', () => {
    expect(parseLapPhase('10周')).toEqual({
      lapsDone: 10,
      lapsTotal: null,
      lastCheckpoint: null,
    })
  })
  it('parseLapPhase: fraction with sprint point', () => {
    expect(parseLapPhase('4/6周 SP2')).toEqual({
      lapsDone: 4,
      lapsTotal: 6,
      lastCheckpoint: 'SP2',
    })
  })
  it('parseLapPhase: plain fraction', () => {
    expect(parseLapPhase('3/6周')).toEqual({
      lapsDone: 3,
      lapsTotal: 6,
      lastCheckpoint: null,
    })
  })
  it('parseLapPhase: FINISH', () => {
    expect(parseLapPhase('FINISH')).toEqual({
      lapsDone: null,
      lapsTotal: null,
      lastCheckpoint: 'FINISH',
    })
  })

  it('parseLapsDown: lap-down gaps vs time gaps', () => {
    expect(parseLapsDown('-6周')).toBe(6)
    expect(parseLapsDown('-1周')).toBe(1)
    expect(parseLapsDown('+1:55')).toBeNull()
    expect(parseLapsDown('0:00')).toBeNull()
    expect(parseLapsDown(null)).toBeNull()
  })

  it('parseRankNum', () => {
    expect(parseRankNum('1位')).toBe(1)
    expect(parseRankNum('94位')).toBe(94)
    expect(parseRankNum('-')).toBeNull()
  })
})

describe('detectRaceShape (content-based)', () => {
  it('individual TT (centisecond times)', () => {
    mountPage(TT_TITLE, ttRows)
    expect(detectRaceShape()).toBe('individual_tt')
  })
  it('individual TT mid-race (中間点 phase)', () => {
    mountPage(TT_TITLE, ttLiveRows)
    expect(detectRaceShape()).toBe('individual_tt')
  })
  it('criterium (N周 phase, whole seconds)', () => {
    mountPage(CRIT_TITLE, critRows)
    expect(detectRaceShape()).toBe('mass_start')
  })
  it('road race (FINISH + X/Y周 phases)', () => {
    mountPage(ROAD_TITLE, roadRows)
    expect(detectRaceShape()).toBe('mass_start')
  })
  it('team TT detected from ctg=004 hint regardless of content', () => {
    mountPage(TT_TITLE, ttRows)
    expect(detectRaceShape(document, CTG('004'))).toBe('team_tt')
  })
  it('pre-start mass-start (all "0周") still detects mass_start', () => {
    mountPage(PRESTART_TITLE, preStartRows)
    expect(detectRaceShape()).toBe('mass_start')
  })
  it('empty page defaults to individual_tt', () => {
    clearPage()
    expect(detectRaceShape()).toBe('individual_tt')
  })
})

describe('parseMassStart: pre-start start list (いなべ "0周")', () => {
  it('marks riders as waiting, not finished, with no fabricated gaps/ranks', () => {
    mountPage(PRESTART_TITLE, preStartRows)
    const data = parseMassStart()
    expect(data.raceShape).toBe('mass_start')
    for (const r of data.riders) {
      expect(r.status).toBe('WAIT')
      expect(r.isFinisher).toBe(false)
      expect(r.finishMs).toBeNull()
      expect(r.elapsedMs).toBeNull()
      expect(r.gapMs).toBeNull() // "0:00" placeholder must not become a real gap
      expect(r.officialRank).toBeNull()
      expect(r.lapsDone).toBe(0)
    }
    // Ranking leaves rank null (source hasn't placed anyone yet)...
    const ranked = normalizeMassStart(data.riders)
    expect(ranked.every((r) => r.rank == null)).toBe(true)
    // ...and there are no on-road groups to show before the start.
    expect(clusterGroups(ranked)).toHaveLength(0)
  })
})

describe('detectMode (URL hint, unchanged)', () => {
  it('ctg=004 is team', () => {
    expect(detectMode(CTG('004'))).toBe('team')
  })
  it('other ctg is individual', () => {
    expect(detectMode(CTG('002'))).toBe('individual')
  })
})

describe('parseTeam: mid-race team TT', () => {
  it('maps LAP1/LAP2 phases to the correct lapsCumMs slot, not FINISH', () => {
    mountPage(TEAM_TT_TITLE, teamTTMidRows)
    const data = parseTeam()
    expect(data.teams).toHaveLength(4)

    const finisher = data.teams.find((t) => t.teamCode === '41')!
    expect(finisher.status).toBe('FINISH')
    expect(finisher.finishMs).toBe((16 * 60 + 1.33) * 1000)
    expect(finisher.lapsCumMs[2]).toBe(finisher.finishMs)
    expect(finisher.lapsCumMs[0]).toBeNull()
    expect(finisher.lapsCumMs[1]).toBeNull()

    const atLap2 = data.teams.find((t) => t.teamCode === '91')!
    expect(atLap2.status).toBe('RUNNING')
    expect(atLap2.finishMs).toBeNull()
    expect(atLap2.lapsCumMs[1]).toBe((9 * 60 + 10) * 1000) // slot 1 = LAP2
    expect(atLap2.lapsCumMs[0]).toBeNull()
    expect(atLap2.lapsCumMs[2]).toBeNull()

    const atLap1 = data.teams.find((t) => t.teamCode === '1')!
    expect(atLap1.status).toBe('RUNNING')
    expect(atLap1.finishMs).toBeNull()
    expect(atLap1.lapsCumMs[0]).toBe((4 * 60 + 25) * 1000) // slot 0 = LAP1
    expect(atLap1.lapsCumMs[1]).toBeNull()
    expect(atLap1.lapsCumMs[2]).toBeNull()

    const notStarted = data.teams.find((t) => t.teamCode === '21')!
    expect(notStarted.status).toBe('WAIT')
    expect(notStarted.finishMs).toBeNull()
    expect(notStarted.lapsCumMs.every((v) => v === null)).toBe(true)
  })
})

describe('parseMassStart: criterium', () => {
  it('ranks the bunch by official place and flags lapped riders', () => {
    mountPage(CRIT_TITLE, critRows)
    const data = parseMassStart()
    expect(data.raceShape).toBe('mass_start')
    // Criterium phase has no "/total", so total laps stay unknown.
    expect(data.lapsTotal).toBeNull()
    expect(data.riders).toHaveLength(4)

    const leader = data.riders[0]
    expect(leader.officialRank).toBe(1)
    expect(leader.lapsDone).toBe(10)
    // A criterium keeps showing the lap count even at the end, so the source
    // never reports a finisher — the order/gaps carry the result instead.
    expect(leader.isFinisher).toBe(false)
    expect(leader.finishMs).toBeNull()
    expect(leader.gapMs).toBe(0)
    expect(leader.status).toBe('RUNNING')

    const tail = data.riders[3]
    expect(tail.officialRank).toBe(94)
    expect(tail.lapsDone).toBe(4)
    expect(tail.lapsDown).toBe(6)
    expect(tail.isFinisher).toBe(false)
    expect(tail.gapMs).toBeNull()
    expect(tail.finishMs).toBeNull()
  })
})

describe('parseMassStart: road race', () => {
  it('uses the FINISH phase for finishers and reads X/Y周 + SPn', () => {
    mountPage(ROAD_TITLE, roadRows)
    const data = parseMassStart()
    expect(data.raceShape).toBe('mass_start')
    expect(data.lapsTotal).toBe(6) // derived from the "X/6周" abandon rows

    const winner = data.riders[0]
    expect(winner.isFinisher).toBe(true)
    expect(winner.gapMs).toBe(0)
    expect(winner.finishMs).toBe((2 * 3600 + 39 * 60 + 6) * 1000)

    const drop = data.riders.find((r) => r.officialRank === 90)!
    expect(drop.isFinisher).toBe(false) // FINISH exists in field, this isn't it
    expect(drop.lapsDone).toBe(4)
    expect(drop.lapsTotal).toBe(6)
    expect(drop.lastCheckpoint).toBe('SP2')
    expect(drop.lapsDown).toBe(2)
    expect(drop.gapMs).toBeNull()
  })
})

describe('normalizeMassStart', () => {
  it('sorts by official place and assigns rank', () => {
    mountPage(CRIT_TITLE, critRows)
    const parsed = parseMassStart().riders
    // Feed in reversed order; expect it sorted back by officialRank.
    const out = normalizeMassStart([...parsed].reverse())
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 94])
    expect(out.map((r) => r.officialRank)).toEqual([1, 2, 3, 94])
    expect(leadLapCount(out)).toBe(3) // 3 lead-lap, 1 lapped
  })
})

// Locks in the real data shapes seen on the live いなべ 8-lap road stage.
describe('8-lap road race (いなべ real shapes)', () => {
  it('mid-race: breakaway + peloton, lap total known, not finished', () => {
    mountPage(ROAD8_TITLE, road8LiveRows)
    const data = parseMassStart()
    expect(data.raceShape).toBe('mass_start')
    expect(data.lapsTotal).toBe(8)
    const riders = normalizeMassStart(data.riders)
    const groups = clusterGroups(riders)
    expect(groups.map((g) => g.kind)).toEqual(['break', 'peloton'])
    expect(groups.map((g) => g.size)).toEqual([2, 5])
    expect(leaderLap(riders, data.lapsTotal ?? null)).toBe(0) // 残り 8周
    expect(raceSummary(riders).finished).toBe(false)
  })

  it('final: FINISH bunch + gruppetto + abandons (X/8周 SP1) + lap-down', () => {
    mountPage(ROAD8_TITLE, road8FinalRows)
    const data = parseMassStart()
    const riders = normalizeMassStart(data.riders)
    expect(data.lapsTotal).toBe(8)
    expect(riders.filter((r) => r.isFinisher).length).toBe(6)
    expect(lappedRiders(riders).length).toBe(2)
    expect(passedCheckpoints(riders)).toEqual(['SP1'])
    expect(leaderLap(riders, data.lapsTotal ?? null)).toBe(8) // remaining 0 -> ゴール

    const sum = raceSummary(riders)
    expect(sum.finished).toBe(true)
    expect(sum.finishers).toBe(6)
    expect(sum.leadBunch).toBe(3) // three across on the same time
    expect(sum.nonFinishers).toBe(2)
    expect(sum.winner?.bib).toBe('3')

    const abandon = riders.find((r) => r.officialRank === 85)!
    expect(abandon.isFinisher).toBe(false)
    expect(abandon.lapsDone).toBe(6)
    expect(abandon.lapsTotal).toBe(8)
    expect(abandon.lastCheckpoint).toBe('SP1')
    expect(abandon.lapsDown).toBe(2)
  })
})

describe('individual TT still works (regression)', () => {
  it('ranks finishers by time with gap to leader', () => {
    mountPage(TT_TITLE, ttRows)
    const data = parseIndividual()
    expect(data.raceShape).toBe('individual_tt')
    const ranked = normalizeRiders(data.riders)
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(ranked[0].gapMs).toBe(0)
    expect(ranked[1].gapMs).toBe(1180) // +0:01.18
  })
})
