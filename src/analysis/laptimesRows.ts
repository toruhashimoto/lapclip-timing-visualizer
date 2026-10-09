import type { LapRow } from './types'
import { parseTimeToMs } from '../utils/parseTime'

const cell = (row: Element, cls: string) =>
  row.querySelector(`.${cls}`)?.textContent?.trim() ?? ''

// Parse a laptimes.php document. Each data row is
//   <td.syukai>N | N/M周 | FINISH</td> <td.juni>順位</td>
//   <td.lap>ラップ</td> <td.total>累計</td>
// The header row (th only) has no .syukai cell and is skipped.
export function parseLapRows(doc: Document): LapRow[] {
  const out: LapRow[] = []
  for (const row of Array.from(doc.querySelectorAll('table tr'))) {
    const phase = cell(row, 'syukai')
    let lap: number | 'FINISH' | null = null
    if (/^FINISH$/i.test(phase)) lap = 'FINISH'
    else {
      const m = phase.match(/^(\d+)/)
      if (m) lap = Number(m[1])
    }
    if (lap == null) continue
    const pm = cell(row, 'juni').match(/^(\d+)/)
    out.push({
      lap,
      pos: pm ? Number(pm[1]) : null,
      lapMs: parseTimeToMs(cell(row, 'lap')),
      cumMs: parseTimeToMs(cell(row, 'total')),
    })
  }
  return out
}
