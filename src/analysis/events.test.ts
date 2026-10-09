import { describe, expect, it } from 'vitest'
import { classifySplit, detectEvents } from './events'
import { groupsByLap } from './groups'
import { mockLapHistory } from './mockLapHistory'
import type { MergeEvent, PulledEvent, SplitEvent } from './types'

const run = (thresholdMs = 3000) => {
  const h = mockLapHistory()
  return detectEvents(h, groupsByLap(h, thresholdMs))
}
const splits = (ev: ReturnType<typeof run>) => ev.filter((e): e is SplitEvent => e.type === 'split')

describe('classifySplit', () => {
  it('front smaller → 抜け出し, rear <= 3 → 脱落, else 中切れ', () => {
    expect(classifySplit(2, 9)).toBe('抜け出し')
    expect(classifySplit(11, 1)).toBe('脱落')
    expect(classifySplit(8, 4)).toBe('中切れ')
    expect(classifySplit(2, 3)).toBe('抜け出し') // both apply → 抜け出し wins
  })
})

describe('detectEvents on the synthetic race', () => {
  it('finds the lap-4 中切れ between R8 and R9 and tracks it until the lap-7 merge', () => {
    const s = splits(run()).find((e) => e.lap === 4)!
    expect(s).toMatchObject({ kind: '中切れ', a: '8', b: '9', frontSize: 8, rearSize: 4, rejoinedLap: 7, transient: false })
    expect(s.gapMs).toBe(6200) // (6 + 8*0.2) - (7*0.2)
    expect(s.followUp.map((f) => f.lap)).toEqual([5, 6])
    expect(s.followUp[0].gapMs).toBe(12200)
  })

  it('compares across the untimed lap 2 (lap 1 → lap 3) without inventing events', () => {
    expect(run().some((e) => e.lap === 3 || e.lap === 2)).toBe(false)
  })

  it('reports the lap-7 merge of two groups', () => {
    const m = run().filter((e): e is MergeEvent => e.type === 'merge')
    expect(m).toEqual([{ type: 'merge', lap: 7, size: 12, fromGroups: 2 }])
  })

  it('reports the lap-8 脱落 of R12 and its lap-9 removal', () => {
    const ev = run()
    expect(splits(ev).find((e) => e.lap === 8)).toMatchObject({ kind: '脱落', a: '11', b: '12', frontSize: 11, rearSize: 1 })
    const p = ev.filter((e): e is PulledEvent => e.type === 'pulled')
    expect(p).toEqual([{ type: 'pulled', lap: 9, bibs: ['12'] }])
  })

  it('reports the lap-9 抜け出し of R1–R2 that holds to the finish', () => {
    const s = splits(run()).find((e) => e.lap === 9)!
    expect(s).toMatchObject({ kind: '抜け出し', a: '2', b: '3', frontSize: 2, rearSize: 9, rejoinedLap: null })
    expect(s.followUp.map((f) => f.lap)).toEqual([10])
  })

  it('a threshold above every gap yields no split events', () => {
    expect(splits(run(25000))).toEqual([])
  })

  it('marks a split that rejoins on the next measured lap as transient', () => {
    // 6.3 s threshold: lap-4 gap 6.2 s stays together, lap-5 gap 12.2 s splits,
    // lap-6 gap 5.2 s rejoins → transient
    const s = splits(run(6300)).find((e) => e.lap === 5)!
    expect(s).toMatchObject({ rejoinedLap: 6, transient: true })
  })

  it('returns events in lap order', () => {
    const laps = run().map((e) => e.lap)
    expect(laps).toEqual([...laps].sort((a, b) => a - b))
  })
})
