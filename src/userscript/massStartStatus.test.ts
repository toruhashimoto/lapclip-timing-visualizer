// Robustness of mass-start status parsing: a result row carrying a non-time
// status (DNS/DNF/OTL/リタイア/降車/…) must not crash, must keep the source's
// own wording, and — for anything we have not positively confirmed — must fall
// back to an explicit UNKNOWN status instead of being guessed into DNF.
import { afterEach, describe, expect, it } from 'vitest'
import { parseMassStart } from './parseDom'
import { normalizeMassStart } from '../utils/normalizeMassStart'
import { renderMassStart } from '../bookmarklet/render'
import {
  clearPage,
  mountPage,
  type FixtureRow,
} from './__fixtures__/lapclipHtml'

const ROAD_TITLE =
  '全日本自転車競技選手権大会 ロード・レース - Men Eliteのリザルト | LAP CLIP'

afterEach(() => clearPage())

const byName = (rows: FixtureRow[], name: string) => {
  mountPage(ROAD_TITLE, rows)
  const data = parseMassStart()
  return { data, rider: data.riders.find((r) => r.name === name)! }
}

describe('mass-start unknown / atypical status handling', () => {
  it('keeps confirmed abnormal codes (DNS/DNF/DNQ/DSQ) with raw text', () => {
    const rows: FixtureRow[] = [
      { rank: '-', bib: '1', name: 'DnsRider', phase: 'DNS', time: '-:--:--', gap: '-:--' },
      { rank: '-', bib: '2', name: 'DnfRider', phase: 'DNF', time: '-:--:--', gap: '-:--' },
    ]
    const dns = byName(rows, 'DnsRider').rider
    const dnf = byName(rows, 'DnfRider').rider
    expect(dns.status).toBe('DNS')
    expect(dns.statusText).toBe('DNS')
    expect(dnf.status).toBe('DNF')
    expect(dnf.statusText).toBe('DNF')
  })

  it('classifies unconfirmed notations (OTL/リタイア/降車) as UNKNOWN, never DNF', () => {
    const rows: FixtureRow[] = [
      { rank: '-', bib: '7', name: 'OtlRider', phase: 'OTL', time: '2:50:00', gap: '+11:00' },
      { rank: '-', bib: '8', name: 'RetireJp', phase: 'リタイア', time: '-:--:--', gap: '-:--' },
      { rank: '-', bib: '9', name: 'DismountJp', phase: '降車', time: '1:30:00', gap: '-:--' },
    ]
    for (const [name, raw, rawTime] of [
      ['OtlRider', 'OTL', '2:50:00'],
      ['RetireJp', 'リタイア', null],
      ['DismountJp', '降車', '1:30:00'],
    ] as const) {
      const r = byName(rows, name).rider
      expect(r.status).toBe('UNKNOWN') // generic fallback, not guessed
      expect(r.status).not.toBe('DNF')
      expect(r.statusText).toBe(raw) // source wording preserved verbatim
      if (rawTime) expect(r.elapsedText).toBe(rawTime) // raw time retained too
    }
  })

  it('does not drop rows and does not throw on a mixed field', () => {
    const rows: FixtureRow[] = [
      { rank: '1位', bib: '1', name: 'Finisher', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
      { rank: '2位', bib: '2', name: 'Runner', phase: '5周', time: '1:50:00', gap: '+0:30' },
      { rank: '-', bib: '3', name: 'PreStart', phase: '0周', time: '-:--:--', gap: '0:00' },
      { rank: '-', bib: '4', name: 'OtlRider', phase: 'OTL', time: '2:50:00', gap: '+11:00' },
      { rank: '-', bib: '5', name: 'WeirdRider', phase: '???', time: '-:--:--', gap: '-:--' },
    ]
    mountPage(ROAD_TITLE, rows)
    const data = parseMassStart()
    expect(data.riders).toHaveLength(5) // nothing silently dropped
    expect(data.riders.find((r) => r.name === 'WeirdRider')!.status).toBe('UNKNOWN')
    expect(data.riders.find((r) => r.name === 'WeirdRider')!.statusText).toBe('???')
  })

  it('lap-down rows stay RUNNING with the -N周 gap preserved (not a status)', () => {
    const rows: FixtureRow[] = [
      { rank: '80位', bib: '6', name: 'Lapped', phase: '4/6周 SP1', time: '2:02:31', gap: '-2周' },
    ]
    const r = byName(rows, 'Lapped').rider
    expect(r.status).toBe('RUNNING')
    expect(r.statusText).toBeNull()
    expect(r.lapsDown).toBe(2)
    expect(r.gapText).toBe('-2周')
    expect(r.lapsDone).toBe(4)
    expect(r.lastCheckpoint).toBe('SP1')
  })
})

describe('mass-start rank respects official 位 (not time)', () => {
  it('orders by officialRank even when elapsed time disagrees', () => {
    const rows: FixtureRow[] = [
      { rank: '2位', bib: '10', name: 'FastButSecond', phase: '5周', time: '1:00:00', gap: '+0:00' },
      { rank: '1位', bib: '11', name: 'SlowButFirst', phase: '5周', time: '1:30:00', gap: '+0:00' },
    ]
    mountPage(ROAD_TITLE, rows)
    const out = normalizeMassStart(parseMassStart().riders)
    expect(out.map((r) => r.name)).toEqual(['SlowButFirst', 'FastButSecond'])
    expect(out.map((r) => r.rank)).toEqual([1, 2]) // official place, time ignored
  })
})

describe('mass-start status — per-category snapshot', () => {
  it('pins how each status notation is parsed', () => {
    const rows: FixtureRow[] = [
      { rank: '1位', bib: '1', name: 'Finisher', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
      { rank: '2位', bib: '2', name: 'Runner', phase: '5周', time: '1:50:00', gap: '+0:30' },
      { rank: '-', bib: '3', name: 'PreStart', phase: '0周', time: '-:--:--', gap: '0:00' },
      { rank: '-', bib: '4', name: 'DnsRider', phase: 'DNS', time: '-:--:--', gap: '-:--' },
      { rank: '-', bib: '5', name: 'DnfRider', phase: 'DNF', time: '-:--:--', gap: '-:--' },
      { rank: '80位', bib: '6', name: 'Lapped', phase: '4/6周 SP1', time: '2:02:31', gap: '-2周' },
      { rank: '-', bib: '7', name: 'OtlRider', phase: 'OTL', time: '2:50:00', gap: '+11:00' },
      { rank: '-', bib: '8', name: 'RetireJp', phase: 'リタイア', time: '-:--:--', gap: '-:--' },
      { rank: '-', bib: '9', name: 'DismountJp', phase: '降車', time: '1:30:00', gap: '-:--' },
    ]
    mountPage(ROAD_TITLE, rows)
    const projection = parseMassStart().riders.map((r) => ({
      name: r.name,
      status: r.status,
      statusText: r.statusText,
      isFinisher: r.isFinisher,
      lapsDone: r.lapsDone,
      lapsTotal: r.lapsTotal,
      lapsDown: r.lapsDown,
      lastCheckpoint: r.lastCheckpoint,
      elapsedText: r.elapsedText,
      gapText: r.gapText,
    }))
    expect(projection).toMatchSnapshot()
  })
})

describe('mass-start renderer surfaces the raw status text', () => {
  it('shows DNF and OTL labels in the progress cell', () => {
    const rows: FixtureRow[] = [
      { rank: '1位', bib: '1', name: 'Finisher', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
      { rank: '-', bib: '4', name: 'DnfRider', phase: 'DNF', time: '-:--:--', gap: '-:--' },
      { rank: '-', bib: '7', name: 'OtlRider', phase: 'OTL', time: '2:50:00', gap: '+11:00' },
    ]
    mountPage(ROAD_TITLE, rows)
    const data = parseMassStart()
    data.riders = normalizeMassStart(data.riders)
    const text = renderMassStart(data).textContent ?? ''
    expect(text).toContain('DNF')
    expect(text).toContain('OTL')
  })
})
