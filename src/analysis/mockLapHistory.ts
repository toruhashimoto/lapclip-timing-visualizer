import { assembleHistory } from './history'
import type { LapHistory, LapRow } from './types'

// SYNTHETIC lap history for the ?mock=analysis preview and tests. Fabricated
// riders/times — no LapClip data. 12 riders, ~100 s laps, lap 2 untimed for
// everyone (mirrors a real timing gap), lap 10 = FINISH. Scenario per lap:
//   4: R1–R8 | R9–R12 split (~6 s)   5: gap grows (~12 s)   6: shrinks (~5 s)
//   7: back together                  8: R12 dropped (~20 s)
//   9: R1–R2 break away (~8 s), R12 pulled     10: finish
const N = 12
const BASE_LAP_S = 100
const SPACING_S = 0.2 // in-group spacing, well under any threshold

// Seconds added to rider i (0-based) on lap L, before in-group spacing.
function offset(lap: number, i: number): number | null {
  const rear = i >= 8 // R9–R12
  const r12 = i === 11
  const front2 = i <= 1 // R1–R2
  switch (lap) {
    case 4: return rear ? 6 : 0
    case 5: return rear ? 12 : 0
    case 6: return rear ? 5 : 0
    case 8: return r12 ? 20 : 0
    case 9: return r12 ? null : front2 ? -8 : 0
    case 10: return r12 ? null : front2 ? -8 : 0
    default: return 0
  }
}

export function mockLapHistory(): LapHistory {
  const cum = (lap: number, i: number): number | null => {
    const off = offset(lap, i)
    return off == null ? null : Math.round((lap * BASE_LAP_S + off + i * SPACING_S) * 1000)
  }
  const entries = Array.from({ length: N }, (_, i) => {
    const rows: LapRow[] = []
    for (let lap = 1; lap <= 10; lap++) {
      if (lap === 2) continue // untimed for everyone
      const c = cum(lap, i)
      if (c == null) continue
      const prev = lap === 1 ? 0 : cum(lap - 1, i) ?? c - BASE_LAP_S * 1000
      rows.push({ lap: lap === 10 ? 'FINISH' : lap, pos: null, lapMs: c - prev, cumMs: c })
    }
    return {
      meta: { bib: String(i + 1), name: `Rider ${String.fromCharCode(65 + i)}`, teamCode: ['AAA', 'BBB', 'CCC'][i % 3] },
      rows,
    }
  })
  // Fill 通過順位 per lap from the crossing order.
  const byLap = new Map<number | 'FINISH', { row: LapRow }[]>()
  for (const e of entries) for (const row of e.rows) {
    const list = byLap.get(row.lap) ?? []
    list.push({ row })
    byLap.set(row.lap, list)
  }
  for (const list of byLap.values()) {
    list.sort((a, b) => (a.row.cumMs as number) - (b.row.cumMs as number))
    list.forEach((x, k) => (x.row.pos = k + 1))
  }
  return assembleHistory(entries, [])
}
