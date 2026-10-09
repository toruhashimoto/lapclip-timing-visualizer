import { describe, expect, it } from 'vitest'
import { fetchLapHistory, listRoster, type LoadOptions } from './fetchLapHistory'

// Synthetic result.php / laptimes.php bodies (real structure, fake data).
const resultRow = (bib: string) =>
  `<a href="#" class="result" name="${bib}"><div class="row"><div class="left"><span class="nwb">-</span><span class="nwb">No.${bib}</span><span class="nwb">[ZZZ]Rider ${bib}</span></div><div class="left"><span class="nw">FINISH</span><span class="nw">0:10:00.00</span><span class="nw">+Top : 0:00.00</span></div></div></a>`
const resultPage = (bibs: string[]) => `<html><body>${bibs.map(resultRow).join('')}</body></html>`
const lapPage = (cumS: number) =>
  `<table><tr><th>周回</th></tr><tr><td class="syukai">1</td><td class="juni">1</td><td class="lap">1:40.00</td><td class="total">0:0${Math.floor(cumS / 60)}:${String(cumS % 60).padStart(2, '0')}.00</td></tr></table>`

const meta = (bib: string) => ({ bib, name: `Rider ${bib}`, teamCode: 'ZZZ' })
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => String(from + i))

function opts(pages: Record<string, string>, over: Partial<LoadOptions> = {}): LoadOptions & { calls: string[] } {
  const calls: string[] = []
  return {
    evt: 'evt1',
    ctg: '100',
    firstPage: [],
    signal: new AbortController().signal,
    fetchHtml: async (url) => {
      calls.push(url)
      const key = Object.keys(pages).find((k) => url.includes(k))
      if (!key) throw new Error(`404 ${url}`)
      return pages[key]
    },
    sleep: async () => {},
    calls,
    ...over,
  }
}

describe('listRoster', () => {
  it('does not page when the visible list is shorter than a page', async () => {
    const o = opts({}, { firstPage: range(1, 5).map(meta) })
    expect((await listRoster(o)).map((r) => r.bib)).toEqual(['1', '2', '3', '4', '5'])
    expect(o.calls).toEqual([])
  })

  it('follows &page=N until a short page, de-duplicating bibs', async () => {
    const o = opts(
      { 'page=2': resultPage(range(101, 100)), 'page=3': resultPage(['200', '201']) },
      { firstPage: range(1, 100).map(meta).concat([meta('101')]) },
    )
    const roster = await listRoster(o)
    expect(roster.length).toBe(201) // 101 visible + 99 new on page 2 + 1 new on page 3
    expect(o.calls.map((u) => u.match(/page=\d+/)?.[0])).toEqual(['page=2', 'page=3'])
    expect(o.calls[0]).toBe('/lap/result.php?evt=evt1&ctg=100&page=2')
  })
})

describe('fetchLapHistory', () => {
  it('fetches every rider sequentially and reports progress', async () => {
    const progress: string[] = []
    const o = opts(
      { 'num=1': lapPage(100), 'num=2': lapPage(101) },
      { firstPage: [meta('1'), meta('2')], onProgress: (p) => progress.push(`${p.phase}:${p.done}/${p.total}`) },
    )
    const h = await fetchLapHistory(o)
    expect(o.calls).toEqual([
      '/lap/laptimes.php?evt=evt1&ctg=100&num=1',
      '/lap/laptimes.php?evt=evt1&ctg=100&num=2',
    ])
    expect(h.riders.map((r) => r.laps.get(1)?.cumMs)).toEqual([100000, 101000])
    expect(progress).toEqual(['roster:2/2', 'laps:0/2', 'laps:1/2', 'laps:2/2'])
  })

  it('records a failed page and keeps going', async () => {
    const o = opts({ 'num=2': lapPage(101) }, { firstPage: [meta('1'), meta('2')] })
    const h = await fetchLapHistory(o)
    expect(h.failedBibs).toEqual(['1'])
    expect(h.riders.map((r) => r.bib)).toEqual(['2'])
  })

  it('waits the request interval between requests', async () => {
    const waits: number[] = []
    const o = opts(
      { 'num=1': lapPage(100), 'num=2': lapPage(101) },
      { firstPage: [meta('1'), meta('2')], sleep: async (ms) => void waits.push(ms) },
    )
    await fetchLapHistory(o)
    expect(waits).toEqual([250])
  })

  it('rejects when aborted', async () => {
    const ac = new AbortController()
    const o = opts(
      { 'num=1': lapPage(100) },
      {
        firstPage: [meta('1'), meta('2')],
        signal: ac.signal,
        fetchHtml: async () => {
          ac.abort()
          throw new DOMException('Aborted', 'AbortError')
        },
      },
    )
    await expect(fetchLapHistory(o)).rejects.toThrow()
  })
})
