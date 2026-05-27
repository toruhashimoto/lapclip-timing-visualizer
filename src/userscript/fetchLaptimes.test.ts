import { describe, expect, it } from 'vitest'
import { parseLaptimesDoc } from './fetchLaptimes'

// Build a synthetic laptimes.php document from row descriptors.
function makeLaptimesDoc(rows: Array<{ syukai: string; total: string }>): Document {
  const body = rows
    .map(
      (r) =>
        `<tr><td class="syukai">${r.syukai}</td><td class="lap">0:00:00.00</td><td class="total">${r.total}</td></tr>`,
    )
    .join('\n')
  const html = `<html><body><table><tr><th>周回</th><th>周回タイム</th><th>累積タイム</th></tr>\n${body}\n</table></body></html>`
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('parseLaptimesDoc', () => {
  it('parses a complete 3-lap result into cumulative ms', () => {
    const doc = makeLaptimesDoc([
      { syukai: '1/3周', total: '0:05:16.05' },
      { syukai: '2/3周', total: '0:10:39.95' },
      { syukai: 'FINISH', total: '0:16:01.33' },
    ])
    expect(parseLaptimesDoc(doc, 3)).toEqual([316050, 639950, 961330])
  })

  it('handles FINISH-only (no intermediate laps on the page yet)', () => {
    const doc = makeLaptimesDoc([{ syukai: 'FINISH', total: '0:16:01.33' }])
    expect(parseLaptimesDoc(doc, 3)).toEqual([null, null, 961330])
  })

  it('handles a partial mid-race result (only lap 1 recorded)', () => {
    const doc = makeLaptimesDoc([{ syukai: '1/3周', total: '0:05:16.05' }])
    expect(parseLaptimesDoc(doc, 3)).toEqual([316050, null, null])
  })

  it('returns all-null for an empty table (team not yet started)', () => {
    const doc = makeLaptimesDoc([])
    expect(parseLaptimesDoc(doc, 3)).toEqual([null, null, null])
  })

  it('accepts a FINISH row in upper or mixed case', () => {
    const doc = makeLaptimesDoc([{ syukai: 'finish', total: '0:16:01.33' }])
    expect(parseLaptimesDoc(doc, 3)[2]).toBe(961330)
  })
})
