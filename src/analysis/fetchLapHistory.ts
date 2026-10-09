// Reads the per-lap history for the analysis page from the SAME-ORIGIN public
// pages the viewer is already browsing (result.php pages + each rider's
// laptimes.php). Only runs when the user presses「分析を読み込む」; requests are
// strictly sequential, REQUEST_INTERVAL_MS apart, and nothing is stored.
import { parseEntries } from '../userscript/parseDom'
import { assembleHistory } from './history'
import { parseLapRows } from './laptimesRows'
import type { LapHistory, LapRow, RiderMeta } from './types'

export const REQUEST_INTERVAL_MS = 250
export const PAGE_SIZE = 100 // result.php rows per page (infinite scroll)
const MAX_PAGES = 30

export type LoadProgress = { phase: 'roster' | 'laps'; done: number; total: number }
export type LoadFn = (
  onProgress: (p: LoadProgress) => void,
  signal: AbortSignal,
) => Promise<LapHistory>

export type FetchHtml = (url: string, signal: AbortSignal) => Promise<string>
export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>

export type LoadOptions = {
  evt: string
  ctg: string
  firstPage: RiderMeta[] // riders already on the visible page
  signal: AbortSignal
  onProgress?: (p: LoadProgress) => void
  fetchHtml?: FetchHtml
  sleep?: Sleep
}

const defaultFetchHtml: FetchHtml = async (url, signal) => {
  const resp = await fetch(url, { signal, credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.text()
}

const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const id = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

const toDoc = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const q = encodeURIComponent

// Full start list: the visible rows, then result.php?…&page=2,3,… until a page
// comes back shorter than PAGE_SIZE.
export async function listRoster(opts: LoadOptions): Promise<RiderMeta[]> {
  const fetchHtml = opts.fetchHtml ?? defaultFetchHtml
  const sleep = opts.sleep ?? defaultSleep
  const seen = new Set<string>()
  const out: RiderMeta[] = []
  const add = (list: RiderMeta[]) => {
    for (const r of list)
      if (!seen.has(r.bib)) {
        seen.add(r.bib)
        out.push(r)
      }
  }
  add(opts.firstPage)
  if (opts.firstPage.length >= PAGE_SIZE) {
    for (let page = 2; page <= MAX_PAGES; page++) {
      await sleep(REQUEST_INTERVAL_MS, opts.signal)
      const html = await fetchHtml(
        `/lap/result.php?evt=${q(opts.evt)}&ctg=${q(opts.ctg)}&page=${page}`,
        opts.signal,
      )
      const rows = parseEntries(toDoc(html)).map((e) => ({
        bib: e.bib,
        name: e.name,
        teamCode: e.teamCode,
      }))
      add(rows)
      if (rows.length < PAGE_SIZE) break
    }
  }
  opts.onProgress?.({ phase: 'roster', done: out.length, total: out.length })
  return out
}

export async function fetchLapHistory(opts: LoadOptions): Promise<LapHistory> {
  const fetchHtml = opts.fetchHtml ?? defaultFetchHtml
  const sleep = opts.sleep ?? defaultSleep
  const roster = await listRoster(opts)
  const entries: { meta: RiderMeta; rows: LapRow[] }[] = []
  const failed: string[] = []
  opts.onProgress?.({ phase: 'laps', done: 0, total: roster.length })
  for (let i = 0; i < roster.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS, opts.signal)
    const meta = roster[i]
    try {
      const html = await fetchHtml(
        `/lap/laptimes.php?evt=${q(opts.evt)}&ctg=${q(opts.ctg)}&num=${q(meta.bib)}`,
        opts.signal,
      )
      entries.push({ meta, rows: parseLapRows(toDoc(html)) })
    } catch (e) {
      if (opts.signal.aborted) throw e
      failed.push(meta.bib)
    }
    opts.onProgress?.({ phase: 'laps', done: i + 1, total: roster.length })
  }
  return assembleHistory(entries, failed)
}
