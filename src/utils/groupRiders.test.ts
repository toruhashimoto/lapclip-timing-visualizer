import { describe, expect, it } from 'vitest'
import type { RiderResult } from '../types'
import {
  clusterGroups,
  lappedRiders,
  passedCheckpoints,
} from './groupRiders'

function r(gapMs: number | null, opts: Partial<RiderResult> = {}): RiderResult {
  return {
    rank: null,
    bib: '1',
    teamCode: null,
    name: 'x',
    status: 'RUNNING',
    intermediateText: null,
    intermediateMs: null,
    finishText: null,
    finishMs: null,
    gapText: null,
    gapMs,
    ...opts,
  }
}

describe('clusterGroups', () => {
  it('a bunch finish is a single peloton', () => {
    const groups = clusterGroups([r(0), r(0), r(0), r(0)])
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('peloton')
    expect(groups[0].size).toBe(4)
  })

  it('breakaway + peloton + dropped split into three groups', () => {
    const riders = [
      r(0),
      r(2000),
      r(4000), // 3-rider breakaway
      r(90000),
      r(92000),
      r(93000),
      r(95000),
      r(96000), // 5-rider peloton (largest)
      r(300000),
      r(305000), // 2 dropped
    ]
    const groups = clusterGroups(riders)
    expect(groups.map((g) => g.size)).toEqual([3, 5, 2])
    expect(groups.map((g) => g.kind)).toEqual(['break', 'peloton', 'behind'])
    expect(groups.map((g) => g.frontGapMs)).toEqual([0, 90000, 300000])
  })

  it('keeps riders within the split threshold together', () => {
    // consecutive diffs are 5s and 4s, both <= 10s default -> one group
    const groups = clusterGroups([r(0), r(5000), r(9000)])
    expect(groups).toHaveLength(1)
    expect(groups[0].spanMs).toBe(9000)
  })

  it('excludes lapped riders from on-road groups', () => {
    const riders = [r(0), r(0), r(null, { lapsDown: 1 })]
    const groups = clusterGroups(riders)
    expect(groups).toHaveLength(1)
    expect(groups[0].size).toBe(2)
  })
})

describe('lappedRiders / passedCheckpoints', () => {
  it('collects lapped riders', () => {
    const riders = [r(0), r(null, { lapsDown: 2 }), r(null, { lapsDown: 1 })]
    expect(lappedRiders(riders)).toHaveLength(2)
  })

  it('dedupes and sorts passed checkpoints, ignoring FINISH', () => {
    const riders = [
      r(0, { lastCheckpoint: 'SP2' }),
      r(0, { lastCheckpoint: 'SP1' }),
      r(0, { lastCheckpoint: 'SP2' }),
      r(0, { lastCheckpoint: 'FINISH' }),
    ]
    expect(passedCheckpoints(riders)).toEqual(['SP1', 'SP2'])
  })
})
