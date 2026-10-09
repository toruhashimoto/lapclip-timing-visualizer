import { describe, expect, it } from 'vitest'
import { assembleHistory } from './history'
import type { LapRow } from './types'

const r = (lap: number | 'FINISH', cumS: number, pos = 1): LapRow => ({
  lap, pos, lapMs: null, cumMs: cumS * 1000,
})
const meta = (bib: string) => ({ bib, name: `Rider ${bib}`, teamCode: 'AAA' })

describe('assembleHistory', () => {
  it('numbers FINISH as the race-wide max lap + 1 for every finisher', () => {
    const h = assembleHistory(
      [
        { meta: meta('1'), rows: [r(1, 100), r(3, 300), r('FINISH', 400)] },
        // rider 2 missed lap 3 — still finishes on lap 4, not lap 2
        { meta: meta('2'), rows: [r(1, 101), r('FINISH', 401)] },
      ],
      [],
    )
    expect(h.riders[0].laps.get(4)?.cumMs).toBe(400000)
    expect(h.riders[1].laps.get(4)?.cumMs).toBe(401000)
    expect(h.riders.every((x) => x.finished)).toBe(true)
  })

  it('lists measured laps and laps missing for everyone', () => {
    const h = assembleHistory(
      [
        { meta: meta('1'), rows: [r(1, 100), r(3, 300), r(4, 400)] },
        { meta: meta('2'), rows: [r(1, 101), r(3, 301)] },
      ],
      ['9'],
    )
    expect(h.lapNumbers).toEqual([1, 3, 4])
    expect(h.missingLaps).toEqual([2])
    expect(h.failedBibs).toEqual(['9'])
    expect(h.riders[1].finished).toBe(false)
  })

  it('drops rows whose cumulative time is unparseable', () => {
    const h = assembleHistory([{ meta: meta('1'), rows: [{ lap: 1, pos: null, lapMs: null, cumMs: null }] }], [])
    expect(h.riders[0].laps.size).toBe(0)
    expect(h.lapNumbers).toEqual([])
  })
})

