import type { LapClipData } from './types'
import { ms } from './mockMassData'

// Synthetic 全日本選手権 ロードレース (mass-start) demo data for the SPA preview
// (`?mock=jprr`). Real DOM formats, fabricated riders/teams/times — no LapClip
// data is stored here. Lets the category tabs + lap-down + live grouping be
// previewed before the real event.
//
// IMPORTANT: the lap totals below are ILLUSTRATIVE for the preview only. The
// live parser still reads the actual lap count from the page DOM (`X/Y周`); the
// real venue/distance/laps vary per year and are confirmed on race day.

export type JprrCategoryKey = 'ME' | 'MM' | 'MU' | 'WE' | 'WM'

export type JprrCategory = {
  key: JprrCategoryKey
  label: string // tab label, mirrors the real result.php category title
  ctg: string // example ctg code (real codes confirmed on race day)
  laps: number // illustrative lap total for the mock
}

// Tabs in display order.
export const JPRR_CATEGORIES: JprrCategory[] = [
  { key: 'ME', label: 'Men Elite', ctg: 'ME-R', laps: 15 },
  { key: 'MM', label: 'MM', ctg: 'MM-30', laps: 7 },
  { key: 'MU', label: 'Men U23', ctg: 'MU-R', laps: 12 },
  { key: 'WE', label: 'Women Elite+WU23', ctg: 'WE-R', laps: 8 },
  { key: 'WM', label: 'WM', ctg: 'WM', laps: 4 },
]

const EVENT = '全日本自転車競技選手権大会 ロード・レース'

// A mid-race snapshot for one category: a 2-rider break, a 2-rider chase, a
// 5-rider peloton ~50s back (so clusterGroups shows 逃げ／追走／メイン集団), two
// lapped riders (`-N周`), and one abandon (DNF) to exercise the status badge.
function buildCategory(c: JprrCategory): LapClipData {
  const total = c.laps
  const done = Math.max(2, Math.round(total * 0.6)) // partway through
  const tag = c.label
  const riders = [
    ms({ rank: 1, bib: '1', team: 'TUK', name: `逃げ・A（${tag}）`, elapsed: '2:10:00', gap: '0:00', lapsDone: done, lapsTotal: total, checkpoint: 'SP1', finisher: false }),
    ms({ rank: 2, bib: '2', team: 'JCL', name: `逃げ・B（${tag}）`, elapsed: '2:10:04', gap: '+0:04', lapsDone: done, lapsTotal: total, checkpoint: 'SP1', finisher: false }),
    ms({ rank: 3, bib: '12', team: 'MAT', name: `追走・C（${tag}）`, elapsed: '2:10:30', gap: '+0:30', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 4, bib: '7', team: 'KIN', name: `追走・D（${tag}）`, elapsed: '2:10:33', gap: '+0:33', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 5, bib: '21', team: 'VCF', name: `集団・E（${tag}）`, elapsed: '2:10:52', gap: '+0:52', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 6, bib: '33', team: 'SBC', name: `集団・F（${tag}）`, elapsed: '2:10:54', gap: '+0:54', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 7, bib: '45', team: 'AVC', name: `集団・G（${tag}）`, elapsed: '2:10:55', gap: '+0:55', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 8, bib: '54', team: 'BLZ', name: `集団・H（${tag}）`, elapsed: '2:10:57', gap: '+0:57', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 9, bib: '63', team: 'CBW', name: `集団・I（${tag}）`, elapsed: '2:10:59', gap: '+0:59', lapsDone: done, lapsTotal: total, finisher: false }),
    ms({ rank: 30, bib: '88', team: 'TFT', name: `遅れ・J（${tag}）`, elapsed: '1:58:00', lapsDone: Math.max(0, done - 1), lapsTotal: total, lapsDown: 1, finisher: false }),
    ms({ rank: 31, bib: '97', team: 'KIN', name: `遅れ・K（${tag}）`, elapsed: '1:40:00', lapsDone: Math.max(0, done - 2), lapsTotal: total, lapsDown: 2, finisher: false }),
    ms({ rank: 99, bib: '101', team: 'BLZ', name: `棄権・L（${tag}）`, elapsed: '-:--:--', lapsDone: null, lapsTotal: total, lapsDown: null, finisher: false, status: 'DNF' }),
  ]
  return {
    eventName: EVENT,
    categoryName: c.label,
    sourceUrl: `https://matrix-sports.jp/lap/result.php?evt=250622_jprr&ctg=${c.ctg}`,
    fetchedAt: new Date().toISOString(),
    riders,
    raceShape: 'mass_start',
    lapsTotal: total,
    isMock: true,
  }
}

// LapClipData for one category tab (defaults to Men Elite).
export function mockJprrData(key: JprrCategoryKey = 'ME'): LapClipData {
  const c = JPRR_CATEGORIES.find((x) => x.key === key) ?? JPRR_CATEGORIES[0]
  return buildCategory(c)
}
