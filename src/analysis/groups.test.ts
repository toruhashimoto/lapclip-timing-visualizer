import { describe, expect, it } from 'vitest'
import { assembleHistory } from './history'
import { DEFAULT_THRESHOLD_MS, groupLap, groupsByLap, leaderTimes } from './groups'

// riders: bib -> cumulative seconds on lap 1 (and lap 3; lap 2 missing for all)
function hist(times: Record<string, number>) {
  return assembleHistory(
    Object.entries(times).map(([bib, t]) => ({
      meta: { bib, name: bib, teamCode: null },
      rows: [
        { lap: 1, pos: null, lapMs: null, cumMs: t * 1000 },
        { lap: 3, pos: null, lapMs: null, cumMs: (t + 200) * 1000 },
      ],
    })),
    [],
  )
}

describe('groupLap', () => {
  it('splits where the gap to the rider ahead is >= threshold (3.000s splits)', () => {
    const h = hist({ a: 100, b: 102.9, c: 105.9, d: 106 })
    const g = groupLap(h, 1, DEFAULT_THRESHOLD_MS)
    expect(g.map((x) => x.riders)).toEqual([['a', 'b'], ['c', 'd']])
    expect(g[1].frontGapMs).toBe(5900)
    expect(g[1].spanMs).toBe(100)
  })

  it('chains small gaps into one group', () => {
    const h = hist({ a: 100, b: 102, c: 104, d: 106 })
    expect(groupLap(h, 1, 3000).length).toBe(1)
  })

  it('a larger threshold merges groups', () => {
    const h = hist({ a: 100, b: 105 })
    expect(groupLap(h, 1, 3000).length).toBe(2)
    expect(groupLap(h, 1, 6000).length).toBe(1)
  })
})

describe('groupsByLap / leaderTimes', () => {
  it('covers measured laps only (missing lap 2 is skipped)', () => {
    const h = hist({ a: 100, b: 101 })
    expect([...groupsByLap(h, 3000).keys()]).toEqual([1, 3])
    expect(leaderTimes(h).get(3)).toBe(300000)
  })
})
