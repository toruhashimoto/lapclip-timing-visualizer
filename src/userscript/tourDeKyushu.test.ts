// マイナビ ツール・ド・九州 (evt=tdk…) — a mass-start event timed to 1/100s.
//
// Pins three behaviours observed on the 2026 result.php pages:
//   1. Detection: a 1/100s criterium (N周 / -N周) and a 1/100s finished road
//      stage (all FINISH) are mass_start, not individual_tt.
//   2. Untimed rows drop the phase span: ["-:--:--.--", "+Top : …"].
//   3. Official-result shaping: UCI 3-second same-time groups with whole-second
//      truncated group times, and lapped riders classified DNF after the finish
//      (matching the commissaires' communiqué format).
// All riders, teams and times are SYNTHETIC (see __fixtures__/lapclipHtml.ts).
import { afterEach, describe, expect, it } from 'vitest'
import { detectRaceShape, parseEntries, parseMassStart } from './parseDom'
import { normalizeMassStart, isRaceOver } from '../utils/normalizeMassStart'
import { raceSummary } from '../utils/groupRiders'
import { clearPage, mountPage, type FixtureRow } from './__fixtures__/lapclipHtml'

const CRIT_TITLE = 'マイナビ ツール・ド・九州２０２６ - 佐世保クリテリウムのリザルト | LAP CLIP'
const STAGE_TITLE = 'マイナビ ツール・ド・九州２０２６ - STAGE 1 福岡のリザルト | LAP CLIP'
const CRIT_URL = 'https://matrix-sports.jp/lap/result.php?evt=tdk2026&ctg=100'
const STAGE_URL = 'https://matrix-sports.jp/lap/result.php?evt=tdk2026&ctg=001'
// A URL with no event hint, to prove the content signals stand on their own.
const BLANK_URL = 'https://matrix-sports.jp/lap/result.php?evt=x&ctg=1'

afterEach(() => clearPage())

// Finished criterium: a bunch finish (sub-second spreads), a group split by
// > 3 s but chained by < 3 s internally, a lone rider, then lapped riders.
const critFinal: FixtureRow[] = [
  { rank: '1位', bib: '11', team: 'AAA', name: 'Crit A', phase: 'FINISH', time: '0:55:54.49', gap: '0:00.00' },
  { rank: '2位', bib: '12', team: 'BBB', name: 'Crit B', phase: 'FINISH', time: '0:55:54.64', gap: '+0:00.15' },
  { rank: '3位', bib: '13', team: 'CCC', name: 'Crit C', phase: 'FINISH', time: '0:55:56.80', gap: '+0:02.31' },
  { rank: '4位', bib: '14', team: 'AAA', name: 'Crit D', phase: 'FINISH', time: '0:56:03.96', gap: '+0:09.47' },
  { rank: '5位', bib: '15', team: 'BBB', name: 'Crit E', phase: 'FINISH', time: '0:56:05.14', gap: '+0:10.65' },
  { rank: '6位', bib: '16', team: 'CCC', name: 'Crit F', phase: 'FINISH', time: '0:56:08.60', gap: '+0:14.11' },
  { rank: '7位', bib: '17', team: 'AAA', name: 'Crit G', phase: '28周', time: '0:53:01.82', gap: '-2周' },
  { rank: '8位', bib: '18', team: 'BBB', name: 'Crit H', phase: '21周', time: '0:40:03.35', gap: '-9周' },
]

// Mid-race criterium: nobody finished yet, some riders already lapped.
const critLive: FixtureRow[] = [
  { rank: '1位', bib: '11', team: 'AAA', name: 'Crit A', phase: '20周', time: '0:37:10.12', gap: '0:00.00' },
  { rank: '2位', bib: '12', team: 'BBB', name: 'Crit B', phase: '20周', time: '0:37:10.40', gap: '+0:00.28' },
  { rank: '3位', bib: '18', team: 'BBB', name: 'Crit H', phase: '18周', time: '0:35:01.00', gap: '-2周' },
]

// Finished road stage: all FINISH at 1/100s, no lap phase anywhere.
const stageFinal: FixtureRow[] = [
  { rank: '1位', bib: '21', team: 'AAA', name: 'Road A', phase: 'FINISH', time: '2:49:32.13', gap: '0:00.00' },
  { rank: '2位', bib: '22', team: 'BBB', name: 'Road B', phase: 'FINISH', time: '2:49:33.12', gap: '+0:00.99' },
  { rank: '3位', bib: '23', team: 'CCC', name: 'Road C', phase: 'FINISH', time: '2:50:15.89', gap: '+0:43.76' },
]

// An untimed row exactly as tdk emits it: only two .nw spans (no phase).
function untimedRow(bib: string, name: string, gap: string): string {
  return [
    `<a href="#" class="result" name="${bib}">`,
    '<div class="row"><div class="left">',
    '<span class="nwb">-</span>',
    `<span class="nwb">No.${bib}</span>`,
    `<span class="nwb">[ZZZ]${name}</span></div>`,
    '<div class="left">',
    '<span class="nw">-:--:--.--</span>',
    `<span class="nw">+Top : ${gap}</span></div></div><div class="arw"></div></a>`,
  ].join('')
}

describe('Tour de Kyushu — race-shape detection', () => {
  it('1/100s criterium with N周 / -N周 is mass_start (by title)', () => {
    mountPage(CRIT_TITLE, critFinal)
    expect(detectRaceShape(document, CRIT_URL)).toBe('mass_start')
  })

  it('1/100s criterium is mass_start from content alone (lapped gap)', () => {
    mountPage('LAP CLIP', critFinal)
    expect(detectRaceShape(document, BLANK_URL)).toBe('mass_start')
  })

  it('finished 1/100s road stage (all FINISH) is mass_start via evt=tdk', () => {
    mountPage(STAGE_TITLE, stageFinal)
    expect(detectRaceShape(document, STAGE_URL)).toBe('mass_start')
  })

  it('pre-start tdk stage (untimed start list) is mass_start', () => {
    mountPage(STAGE_TITLE, [])
    document.body.innerHTML = untimedRow('1', 'Start A', '0:00.00') + untimedRow('2', 'Start B', '0:00.00')
    expect(detectRaceShape(document, STAGE_URL)).toBe('mass_start')
  })

  it('a plain 1/100s TT without the event hint stays individual_tt', () => {
    mountPage('LAP CLIP', stageFinal)
    expect(detectRaceShape(document, BLANK_URL)).toBe('individual_tt')
  })
})

describe('Tour de Kyushu — untimed rows without a phase span', () => {
  it('reads ["-:--:--.--", "+Top : -"] as empty phase + placeholder time', () => {
    document.body.innerHTML = untimedRow('9', 'Dnf Rider', '-')
    const [e] = parseEntries(document)
    expect(e.phase).toBe('')
    expect(e.timeText).toBe('-:--:--.--')
    expect(e.gapText).toBe('-')
  })

  it('a pre-start start-list row parses as WAIT, not UNKNOWN', () => {
    mountPage(STAGE_TITLE, [])
    document.body.innerHTML = untimedRow('1', 'Start A', '0:00.00')
    const [r] = parseMassStart().riders
    expect(r.status).toBe('WAIT')
    expect(r.statusText).toBeNull()
    expect(r.gapMs).toBeNull()
  })
})

describe('Tour de Kyushu — official-result shaping', () => {
  const load = (rows: FixtureRow[]) => {
    mountPage(CRIT_TITLE, rows)
    return normalizeMassStart(parseMassStart().riders)
  }
  const by = (riders: ReturnType<typeof load>, name: string) =>
    riders.find((r) => r.name === name)!
  const hms = (h: number, m: number, s: number) => ((h * 60 + m) * 60 + s) * 1000

  it('groups finishers by the 3-second rule with truncated group times', () => {
    const riders = load(critFinal)
    // Bunch: A/B/C chained under 3 s → all on A's time, truncated (54.49 → 54).
    for (const n of ['Crit A', 'Crit B', 'Crit C']) {
      expect(by(riders, n).elapsedMs).toBe(hms(0, 55, 54))
      expect(by(riders, n).gapMs).toBe(0)
    }
    // D is > 3 s behind C → new group; E is 1.18 s behind D → same group.
    expect(by(riders, 'Crit D').elapsedMs).toBe(hms(0, 56, 3))
    expect(by(riders, 'Crit D').gapMs).toBe(9000)
    expect(by(riders, 'Crit E').gapMs).toBe(9000)
    // F is 3.46 s behind E → its own group, truncated (08.60 → 08) → 14".
    expect(by(riders, 'Crit F').gapMs).toBe(14000)
    // The raw transponder time is still available.
    expect(by(riders, 'Crit F').elapsedText).toBe('0:56:08.60')
  })

  it('classifies lapped riders DNF with no placing once the race is over', () => {
    const riders = load(critFinal)
    expect(isRaceOver(riders)).toBe(true)
    for (const n of ['Crit G', 'Crit H']) {
      const r = by(riders, n)
      expect(r.status).toBe('DNF')
      expect(r.rank).toBeNull()
    }
    expect(by(riders, 'Crit F').rank).toBe(6)
  })

  it('switches the race summary to the result view (30-of-106 style finish)', () => {
    const sum = raceSummary(load(critFinal))
    expect(sum.finished).toBe(true)
    expect(sum.finishers).toBe(6)
    expect(sum.leadBunch).toBe(3)
    expect(sum.nonFinishers).toBe(2)
  })

  it('labels untimed rows DNF/DNS once a road stage is over (not 出走前)', () => {
    mountPage(STAGE_TITLE, stageFinal)
    document.body.innerHTML += untimedRow('29', 'Gone Rider', '-')
    const riders = normalizeMassStart(parseMassStart().riders)
    const r = by(riders, 'Gone Rider')
    expect(r.status).toBe('UNKNOWN')
    expect(r.statusText).toBe('DNF/DNS')
    // Road B was 0.99 s behind the winner → same time under the 3-second rule.
    expect(by(riders, 'Road B').gapMs).toBe(0)
    expect(by(riders, 'Road C').gapMs).toBe(43000)
  })

  it('leaves the live race untouched before anyone finishes', () => {
    const riders = load(critLive)
    expect(isRaceOver(riders)).toBe(false)
    expect(by(riders, 'Crit B').gapMs).toBe(280)
    const lapped = by(riders, 'Crit H')
    expect(lapped.status).toBe('RUNNING')
    expect(lapped.rank).toBe(3)
    expect(lapped.lapsDown).toBe(2)
  })
})
