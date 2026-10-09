import { describe, expect, it } from 'vitest'
import { parseLapRows } from './laptimesRows'

// Synthetic laptimes.php table — real column classes, fabricated values.
function doc(rows: string[]): Document {
  const html = `<table><tr><th>周回</th><th>順位</th><th>ラップタイム</th><th>トータルタイム</th></tr>${rows.join('')}</table>`
  return new DOMParser().parseFromString(html, 'text/html')
}
const row = (syukai: string, juni: string, lap: string, total: string) =>
  `<tr><td class="syukai"><span>${syukai}</span></td><td class="juni"><span>${juni}</span></td><td class="lap"><span>${lap}</span></td><td class="total"><span>${total}</span></td></tr>`

describe('parseLapRows', () => {
  it('parses lap number, position, lap time and cumulative time', () => {
    expect(parseLapRows(doc([row('1', '4', '1:48.65', '0:01:48.65')]))).toEqual([
      { lap: 1, pos: 4, lapMs: 108650, cumMs: 108650 },
    ])
  })

  it('parses FINISH and N/M周 lap labels', () => {
    const rows = parseLapRows(
      doc([row('3/6周', '2', '5:00.00', '0:15:00.00'), row('FINISH', '1', '1:49.69', '0:55:55.24')]),
    )
    expect(rows.map((r) => r.lap)).toEqual([3, 'FINISH'])
    expect(rows[1].cumMs).toBe(3355240)
  })

  it('keeps rows with an unparseable time as null instead of dropping them', () => {
    expect(parseLapRows(doc([row('5', '-', '-', '-:--:--.--')]))).toEqual([
      { lap: 5, pos: null, lapMs: null, cumMs: null },
    ])
  })

  it('skips rows without a lap label and the header row', () => {
    expect(parseLapRows(doc([row('', '1', '1:00.00', '0:01:00.00')]))).toEqual([])
  })
})
