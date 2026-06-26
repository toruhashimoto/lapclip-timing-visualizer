import { describe, expect, it } from 'vitest'
import {
  JPRR_CATEGORIES,
  mockJprrData,
  type JprrCategoryKey,
} from './mockJprrData'
import { normalizeMassStart } from './utils/normalizeMassStart'
import { clusterGroups, lappedRiders, raceSummary } from './utils/groupRiders'

describe('?mock=jprr synthetic data', () => {
  it('exposes the five All-Japan road category tabs in order', () => {
    expect(JPRR_CATEGORIES.map((c) => c.label)).toEqual([
      'Men Elite',
      'MM',
      'Men U23',
      'Women Elite+WU23',
      'WM',
    ])
  })

  it('every category is a mass-start mock with lap-down + live grouping', () => {
    for (const c of JPRR_CATEGORIES) {
      const data = mockJprrData(c.key)
      expect(data.raceShape).toBe('mass_start')
      expect(data.isMock).toBe(true)
      expect(data.eventName).toContain('全日本')
      expect(data.categoryName).toBe(c.label)
      expect(data.lapsTotal).toBe(c.laps)

      const riders = normalizeMassStart(data.riders)
      // Lap-down riders present and shown as "-N周" (not a time gap).
      const lapped = lappedRiders(riders)
      expect(lapped.length).toBeGreaterThanOrEqual(2)
      expect(lapped.every((r) => r.gapMs == null && /^-\d+周$/.test(r.gapText ?? ''))).toBe(true)

      // Bunch situation: the lead lap splits into multiple on-road groups,
      // including a peloton.
      const groups = clusterGroups(riders)
      expect(groups.length).toBeGreaterThanOrEqual(2)
      expect(groups.some((g) => g.kind === 'peloton')).toBe(true)

      // Mid-race snapshot, not a finished field (keeps the live group view).
      expect(raceSummary(riders).finished).toBe(false)
    }
  })

  it('keeps an abandon row as DNF (status robustness), official rank respected', () => {
    const riders = normalizeMassStart(mockJprrData('ME').riders)
    const dnf = riders.find((r) => r.status === 'DNF')
    expect(dnf).toBeDefined()
    expect(dnf!.statusText).toBe('DNF')
    // Rank follows the official 位, ascending from 1.
    expect(riders.slice(0, 3).map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('defaults to Men Elite', () => {
    const def = mockJprrData()
    expect(def.categoryName).toBe('Men Elite')
    const key: JprrCategoryKey = 'WM'
    expect(mockJprrData(key).categoryName).toBe('WM')
  })
})
