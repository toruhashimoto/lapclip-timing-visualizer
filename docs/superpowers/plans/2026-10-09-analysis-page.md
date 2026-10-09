# 分析ページ（中切れ可視化）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC ユーザースクリプトのオーバーレイに「分析」タブを追加し、クリテリウム等の周回レースで集団の分断（中切れ）が「いつ・どの選手の間で」起きたかを可視化する。

**Architecture:** データ取得（`src/analysis/fetchLapHistory.ts`）→ 純粋関数の判定層（`history.ts` / `groups.ts` / `events.ts`）→ 自前 SVG の React 表示層（`src/components/analysis/`）の 3 層。取得関数は `AnalysisView` に `load` として注入し、userscript では実取得、SPA プレビューでは架空データを渡す。

**Tech Stack:** TypeScript 5.7 / React 19 / Tailwind 4 / Vite 6 + vite-plugin-monkey / Vitest 4 (jsdom)

**Spec:** `docs/superpowers/specs/2026-10-09-analysis-page-design.md`

## Global Constraints

- 対象は PC ユーザースクリプト（React 版オーバーレイ）のみ。ブックマークレット / iOS / Android の UI は変更しない。
- 取得対象は閲覧中ページと同一オリジンの公開ページ（`/lap/result.php`・`/lap/laptimes.php`）のみ。
- 取得はユーザーが「分析を読み込む」を押したときだけ。自動更新・定期取得なし。
- 逐次取得・リクエスト間隔 **250ms**。並列取得しない。
- 結果はメモリ上のみ。localStorage / IndexedDB / エクスポート機能を作らない。
- しきい値：初期値 **3 秒**、スライダー **1〜10 秒・0.5 秒刻み**。ちょうどしきい値の差は区切る（`>=`）。
- 分断種別：前側 < 後側 → `抜け出し`、後側 ≤ 3 → `脱落`、それ以外 → `中切れ`（両方該当なら抜け出し優先）。
- テストデータは架空の選手・タイムのみ（実データをリポジトリに保存しない）。
- テストは `src/**/*.test.ts`（jsdom）。UI コンポーネントは型チェックと `?mock=analysis` プレビューで確認する。
- バージョン：v3.0.0。

## File Structure

| ファイル | 責務 |
|---|---|
| `src/analysis/types.ts`（新） | 分析の型定義（LapRow / LapPoint / RiderMeta / RiderLapHistory / LapHistory / Group / RaceEvent） |
| `src/analysis/laptimesRows.ts`（新） | `laptimes.php` の表行を LapRow[] に解析（チームTTと共用） |
| `src/userscript/fetchLaptimes.ts`（改） | `parseLaptimesDoc` を `parseLapRows` ベースに置換 |
| `src/analysis/history.ts`（新） | LapRow[] 群から LapHistory を組み立てる（FINISH 周回番号・欠損周） |
| `src/analysis/fetchLapHistory.ts`（新） | 選手リストのページ送り＋ラップの逐次取得（fetch / sleep 注入可） |
| `src/analysis/groups.ts`（新） | 周回ごとの集団分け・先頭タイム |
| `src/analysis/events.ts`（新） | 分断 / 合流 / 除外イベント検出・経過追跡 |
| `src/analysis/mockLapHistory.ts`（新） | プレビュー・テスト用の架空 LapHistory |
| `src/components/analysis/svgAxis.tsx`（新） | SVG 共通部品（スケール・軸・色） |
| `src/components/analysis/GroupTimeline.tsx`（新） | ① 集団タイムライン |
| `src/components/analysis/SplitEventList.tsx`（新） | ② イベント一覧 |
| `src/components/analysis/PositionChart.tsx`（新） | ③ 順位推移 |
| `src/components/analysis/LapTimeChart.tsx`（新） | ④ ラップタイム推移 |
| `src/components/analysis/AnalysisView.tsx`（新） | 取得状態・しきい値・選択・ハイライトの管理と 4 図の配置 |
| `src/components/analysis/AnalysisPreview.tsx`（新） | SPA `?mock=analysis` 用ラッパー |
| `src/main.tsx`（改） | `?mock=analysis` で AnalysisPreview を表示 |
| `src/userscript/Overlay.tsx`（改） | [タイミング] [分析] タブ・実取得ローダー |
| `README.md` / `docs/lapclip-data-formats.md` / `package.json`（改） | 取扱い記述の修正・書式メモ・v3.0.0 |

---

### Task 1: 型定義と laptimes.php 行パーサー（チームTT共用化）

**Files:**
- Create: `src/analysis/types.ts`
- Create: `src/analysis/laptimesRows.ts`
- Modify: `src/userscript/fetchLaptimes.ts`（`parseLaptimesDoc` 本体）
- Test: `src/analysis/laptimesRows.test.ts`（新）、既存 `src/userscript/fetchLaptimes.test.ts` は無変更で通ること

**Interfaces:**
- Produces: `parseLapRows(doc: Document): LapRow[]`、`src/analysis/types.ts` の全型

- [ ] **Step 1: 型定義を作成**

`src/analysis/types.ts`:

```ts
// Types for the analysis page (per-lap history of a mass-start race).
// All values come from the public laptimes.php pages read in the viewer's own
// browser; nothing here is persisted.

// One row of laptimes.php: 周回 / 順位 / ラップタイム / トータルタイム.
export type LapRow = {
  lap: number | 'FINISH'
  pos: number | null // 通過順位 at that line crossing
  lapMs: number | null
  cumMs: number | null
}

export type LapPoint = { cumMs: number; pos: number | null; lapMs: number | null }

export type RiderMeta = { bib: string; name: string; teamCode: string | null }

export type RiderLapHistory = RiderMeta & {
  laps: Map<number, LapPoint> // lap number -> crossing; FINISH = race finish lap
  finished: boolean
}

export type LapHistory = {
  riders: RiderLapHistory[]
  lapNumbers: number[] // laps with at least one crossing, ascending
  missingLaps: number[] // laps in 1..max with no crossing for anyone
  failedBibs: string[] // laptimes.php pages that failed to load
}

// Riders crossing a lap line together (consecutive gaps < threshold).
export type Group = {
  lap: number
  riders: string[] // bibs in crossing order
  frontGapMs: number // front rider's gap to the lap leader
  spanMs: number // front-to-back spread of the group
}

export type SplitKind = '中切れ' | '抜け出し' | '脱落'

export type SplitEvent = {
  type: 'split'
  lap: number
  kind: SplitKind
  a: string // last rider ahead of the gap
  b: string // first rider behind the gap (couldn't hold the wheel)
  frontSize: number
  rearSize: number
  gapMs: number // a→b gap at the confirming lap
  followUp: { lap: number; gapMs: number }[] // later laps while a/b stay apart
  rejoinedLap: number | null
  transient: boolean // rejoined on the very next measured lap
}
export type MergeEvent = { type: 'merge'; lap: number; size: number; fromGroups: number }
export type PulledEvent = { type: 'pulled'; lap: number; bibs: string[] }
export type RaceEvent = SplitEvent | MergeEvent | PulledEvent
```

- [ ] **Step 2: 行パーサーの失敗テストを書く**

`src/analysis/laptimesRows.test.ts`:

```ts
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
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run src/analysis/laptimesRows.test.ts`
Expected: FAIL（`./laptimesRows` が存在しない）

- [ ] **Step 4: パーサーを実装**

`src/analysis/laptimesRows.ts`:

```ts
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
```

- [ ] **Step 5: チームTT側を共用パーサーに置換**

`src/userscript/fetchLaptimes.ts` の `parseLaptimesDoc` を次に置き換え、先頭 import に `import { parseLapRows } from '../analysis/laptimesRows'` を追加（`parseTimeToMs` の import は不要になれば削除）:

```ts
// Parse a laptimes.php document into cumulative lap times (team TT).
// Row parsing is shared with the analysis page (parseLapRows).
export function parseLaptimesDoc(doc: Document, laps: number): (number | null)[] {
  const lapsCumMs: (number | null)[] = new Array(laps).fill(null)
  for (const r of parseLapRows(doc)) {
    if (r.cumMs == null) continue
    if (r.lap === 'FINISH') lapsCumMs[laps - 1] = r.cumMs
    else if (r.lap >= 1 && r.lap <= laps) lapsCumMs[r.lap - 1] = r.cumMs
  }
  return lapsCumMs
}
```

- [ ] **Step 6: 全テスト・型チェック**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全 PASS（既存 `fetchLaptimes.test.ts` 含む）、型エラーなし

- [ ] **Step 7: Commit**

```bash
git add src/analysis/types.ts src/analysis/laptimesRows.ts src/analysis/laptimesRows.test.ts src/userscript/fetchLaptimes.ts
git commit -m "feat(analysis): laptimes.php 行パーサーと分析用の型を追加（チームTTと共用）"
```

---

### Task 2: LapHistory の組み立て

**Files:**
- Create: `src/analysis/history.ts`
- Test: `src/analysis/history.test.ts`

**Interfaces:**
- Consumes: `LapRow`, `RiderMeta`, `LapHistory`（Task 1）
- Produces: `assembleHistory(entries: { meta: RiderMeta; rows: LapRow[] }[], failedBibs: string[]): LapHistory`

- [ ] **Step 1: 失敗テストを書く**

`src/analysis/history.test.ts`:

```ts
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

```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/analysis/history.test.ts`
Expected: FAIL（`./history` が存在しない）

- [ ] **Step 3: 実装**

`src/analysis/history.ts`:

```ts
import type { LapHistory, LapPoint, LapRow, RiderLapHistory, RiderMeta } from './types'

// Build the per-lap history from each rider's laptimes.php rows.
// FINISH is numbered race-wide as (max numbered lap of anyone) + 1, so a
// finisher who missed the last timed lap still finishes on the same lap as
// everyone else.
export function assembleHistory(
  entries: { meta: RiderMeta; rows: LapRow[] }[],
  failedBibs: string[],
): LapHistory {
  let maxLap = 0
  for (const e of entries)
    for (const row of e.rows)
      if (row.lap !== 'FINISH' && row.cumMs != null) maxLap = Math.max(maxLap, row.lap)
  const finishLap = maxLap + 1

  const riders: RiderLapHistory[] = entries.map(({ meta, rows }) => {
    const laps = new Map<number, LapPoint>()
    let finished = false
    for (const row of rows) {
      if (row.cumMs == null) continue
      const point: LapPoint = { cumMs: row.cumMs, pos: row.pos, lapMs: row.lapMs }
      if (row.lap === 'FINISH') {
        laps.set(finishLap, point)
        finished = true
      } else laps.set(row.lap, point)
    }
    return { ...meta, laps, finished }
  })

  const seen = new Set<number>()
  for (const rider of riders) for (const lap of rider.laps.keys()) seen.add(lap)
  const lapNumbers = [...seen].sort((a, b) => a - b)
  const last = lapNumbers.length ? lapNumbers[lapNumbers.length - 1] : 0
  const missingLaps: number[] = []
  for (let lap = 1; lap <= last; lap++) if (!seen.has(lap)) missingLaps.push(lap)

  return { riders, lapNumbers, missingLaps, failedBibs }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/analysis/history.test.ts`
Expected: PASS（3 件）

- [ ] **Step 5: Commit**

```bash
git add src/analysis/history.ts src/analysis/history.test.ts
git commit -m "feat(analysis): ラップ行から LapHistory を組み立てる"
```

---

### Task 3: 取得層（選手リストのページ送り＋ラップ逐次取得）

**Files:**
- Create: `src/analysis/fetchLapHistory.ts`
- Test: `src/analysis/fetchLapHistory.test.ts`

**Interfaces:**
- Consumes: `parseEntries(root: ParentNode): RawEntry[]`（`src/userscript/parseDom.ts`）、`parseLapRows`（Task 1）、`assembleHistory`（Task 2）
- Produces:
  - `type LoadProgress = { phase: 'roster' | 'laps'; done: number; total: number }`
  - `type LoadFn = (onProgress: (p: LoadProgress) => void, signal: AbortSignal) => Promise<LapHistory>`
  - `fetchLapHistory(opts: LoadOptions): Promise<LapHistory>`
  - `listRoster(opts: LoadOptions): Promise<RiderMeta[]>`
  - 定数 `REQUEST_INTERVAL_MS = 250`, `PAGE_SIZE = 100`

- [ ] **Step 1: 失敗テストを書く**

`src/analysis/fetchLapHistory.test.ts`:

```ts
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/analysis/fetchLapHistory.test.ts`
Expected: FAIL（モジュールなし）

- [ ] **Step 3: 実装**

`src/analysis/fetchLapHistory.ts`:

```ts
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
```

> 注：`listRoster` のテスト「page=2 から」では `firstPage` が 101 件のため、ページ送り前の待機 `sleep` が 1 回呼ばれる。`fetchLapHistory` の「待機」テストは `firstPage` 2 件（ページ送りなし）なので待機はラップ間の 1 回 = `[250]`。

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/analysis/fetchLapHistory.test.ts`
Expected: PASS（6 件）

- [ ] **Step 5: Commit**

```bash
git add src/analysis/fetchLapHistory.ts src/analysis/fetchLapHistory.test.ts
git commit -m "feat(analysis): 選手リストのページ送りとラップ逐次取得（250ms間隔・中止可）"
```

---

### Task 4: 周回ごとの集団分け

**Files:**
- Create: `src/analysis/groups.ts`
- Test: `src/analysis/groups.test.ts`

**Interfaces:**
- Consumes: `LapHistory`, `Group`（Task 1）
- Produces:
  - `DEFAULT_THRESHOLD_MS = 3000`
  - `groupLap(history: LapHistory, lap: number, thresholdMs: number): Group[]`
  - `groupsByLap(history: LapHistory, thresholdMs: number): Map<number, Group[]>`（計測周のみ・昇順）
  - `leaderTimes(history: LapHistory): Map<number, number>`（周回 → 先頭の累計 ms）

- [ ] **Step 1: 失敗テストを書く**

`src/analysis/groups.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assembleHistory } from './history'
import { DEFAULT_THRESHOLD_MS, groupLap, groupsByLap, leaderTimes } from './groups'

// riders: bib -> cumulative seconds on lap 1 (and lap 3; lap 2 missing for all)
function hist(times: Record<string, number>) {
  return assembleHistory(
    Object.entries(times).map(([bib, t]) => ({
      meta: { bib, name: bib, teamCode: null },
      rows: [
        { lap: 1, pos: null, lapMs: null, cumMs: t * 1000 },
        { lap: 3, pos: null, lapMs: null, cumMs: (t + 200) * 1000 },
      ],
    })),
    [],
  )
}

describe('groupLap', () => {
  it('splits where the gap to the rider ahead is >= threshold (3.000s splits)', () => {
    const h = hist({ a: 100, b: 102.9, c: 105.9, d: 106 })
    const g = groupLap(h, 1, DEFAULT_THRESHOLD_MS)
    expect(g.map((x) => x.riders)).toEqual([['a', 'b'], ['c', 'd']])
    expect(g[1].frontGapMs).toBe(5900)
    expect(g[1].spanMs).toBe(100)
  })

  it('chains small gaps into one group', () => {
    const h = hist({ a: 100, b: 102, c: 104, d: 106 })
    expect(groupLap(h, 1, 3000).length).toBe(1)
  })

  it('a larger threshold merges groups', () => {
    const h = hist({ a: 100, b: 105 })
    expect(groupLap(h, 1, 3000).length).toBe(2)
    expect(groupLap(h, 1, 6000).length).toBe(1)
  })
})

describe('groupsByLap / leaderTimes', () => {
  it('covers measured laps only (missing lap 2 is skipped)', () => {
    const h = hist({ a: 100, b: 101 })
    expect([...groupsByLap(h, 3000).keys()]).toEqual([1, 3])
    expect(leaderTimes(h).get(3)).toBe(300000)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/analysis/groups.test.ts`
Expected: FAIL（モジュールなし）

- [ ] **Step 3: 実装**

`src/analysis/groups.ts`:

```ts
import type { Group, LapHistory } from './types'

export const DEFAULT_THRESHOLD_MS = 3000

// Crossings of one lap line, fastest first.
function crossings(history: LapHistory, lap: number): { bib: string; t: number }[] {
  const xs: { bib: string; t: number }[] = []
  for (const r of history.riders) {
    const p = r.laps.get(lap)
    if (p) xs.push({ bib: r.bib, t: p.cumMs })
  }
  return xs.sort((a, b) => a.t - b.t)
}

// Riders crossing the lap line together: a new group starts wherever the gap
// to the rider directly ahead is >= thresholdMs.
export function groupLap(history: LapHistory, lap: number, thresholdMs: number): Group[] {
  const xs = crossings(history, lap)
  if (xs.length === 0) return []
  const leader = xs[0].t
  const raw: { bib: string; t: number }[][] = []
  let cur = [xs[0]]
  for (let i = 1; i < xs.length; i++) {
    if (xs[i].t - xs[i - 1].t >= thresholdMs) {
      raw.push(cur)
      cur = []
    }
    cur.push(xs[i])
  }
  raw.push(cur)
  return raw.map((g) => ({
    lap,
    riders: g.map((x) => x.bib),
    frontGapMs: g[0].t - leader,
    spanMs: g[g.length - 1].t - g[0].t,
  }))
}

export function groupsByLap(history: LapHistory, thresholdMs: number): Map<number, Group[]> {
  const out = new Map<number, Group[]>()
  for (const lap of history.lapNumbers) out.set(lap, groupLap(history, lap, thresholdMs))
  return out
}

export function leaderTimes(history: LapHistory): Map<number, number> {
  const out = new Map<number, number>()
  for (const lap of history.lapNumbers) {
    const xs = crossings(history, lap)
    if (xs.length) out.set(lap, xs[0].t)
  }
  return out
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run src/analysis/groups.test.ts`
Expected: PASS（4 件）

- [ ] **Step 5: Commit**

```bash
git add src/analysis/groups.ts src/analysis/groups.test.ts
git commit -m "feat(analysis): 周回ごとの集団分け（しきい値以上の空きで区切る）"
```

---

### Task 5: 架空データとイベント検出（分断・合流・除外）

**Files:**
- Create: `src/analysis/mockLapHistory.ts`
- Create: `src/analysis/events.ts`
- Test: `src/analysis/events.test.ts`

**Interfaces:**
- Consumes: `assembleHistory`（Task 2）、`groupsByLap`（Task 4）、`RaceEvent` 系の型（Task 1）
- Produces:
  - `mockLapHistory(): LapHistory`
  - `classifySplit(frontSize: number, rearSize: number): SplitKind`
  - `detectEvents(history: LapHistory, byLap: Map<number, Group[]>): RaceEvent[]`（周回昇順、同周は split → merge → pulled の順）

架空シナリオ（12 名 R1〜R12、1 周約 100 秒、**2 周目は全員欠損**、10 周目 = FINISH）:

| 周 | 状況 |
|---|---|
| 1, 3 | 全員 1 集団 |
| 4 | R1–R8 / R9–R12 に分断（約 6 秒）→ 中切れ（8｜4） |
| 5 | R9–R12 が約 12 秒差に拡大 |
| 6 | 約 5 秒差に縮小 |
| 7 | 再合流（合流イベント） |
| 8 | R12 が約 20 秒遅れ → 脱落（11｜1） |
| 9 | R1–R2 が約 8 秒先行 → 抜け出し（2｜9）。R12 は記録なし → 除外 |
| 10 | FINISH（R1–R2 先行のまま） |

- [ ] **Step 1: 架空データを作成**

`src/analysis/mockLapHistory.ts`:

```ts
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
```

- [ ] **Step 2: 失敗テストを書く**

`src/analysis/events.test.ts`:

```ts
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
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run src/analysis/events.test.ts`
Expected: FAIL（`./events` が存在しない）

- [ ] **Step 4: 実装**

`src/analysis/events.ts`:

```ts
import type {
  Group,
  LapHistory,
  MergeEvent,
  PulledEvent,
  RaceEvent,
  SplitEvent,
  SplitKind,
} from './types'

// Split kind from the two sides of a gap (spec §5.3).
export function classifySplit(frontSize: number, rearSize: number): SplitKind {
  if (frontSize < rearSize) return '抜け出し'
  if (rearSize <= 3) return '脱落'
  return '中切れ'
}

// Compare consecutive MEASURED laps (untimed laps are skipped) and report:
//   split  — riders who shared a group on lap P are in 2+ groups on lap L
//   merge  — a group on lap L holds riders from 2+ groups on lap P
//   pulled — a non-finisher with no crossing after lap P while the race went on
export function detectEvents(
  history: LapHistory,
  byLap: Map<number, Group[]>,
): RaceEvent[] {
  const laps = [...byLap.keys()].sort((a, b) => a - b)
  const cum = new Map<string, Map<number, number>>()
  for (const r of history.riders)
    cum.set(r.bib, new Map([...r.laps].map(([lap, p]) => [lap, p.cumMs])))
  const t = (bib: string, lap: number) => cum.get(bib)?.get(lap)

  // lap -> bib -> group index on that lap
  const index = new Map<number, Map<string, number>>()
  for (const [lap, groups] of byLap) {
    const m = new Map<string, number>()
    groups.forEach((g, gi) => g.riders.forEach((b) => m.set(b, gi)))
    index.set(lap, m)
  }

  const events: RaceEvent[] = []
  for (let k = 1; k < laps.length; k++) {
    const P = laps[k - 1]
    const L = laps[k]
    const iP = index.get(P)!
    const iL = index.get(L)!

    for (const g of byLap.get(P)!) {
      const parts = new Map<number, string[]>()
      for (const b of g.riders) {
        const gi = iL.get(b)
        if (gi == null) continue // no crossing on lap L (missed or pulled)
        parts.set(gi, [...(parts.get(gi) ?? []), b])
      }
      if (parts.size < 2) continue
      const ordered = [...parts.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([, bibs]) => bibs.sort((x, y) => (t(x, L) as number) - (t(y, L) as number)))
      for (let j = 1; j < ordered.length; j++) {
        const front = ordered.slice(0, j).flat()
        const rear = ordered.slice(j).flat()
        const a = ordered[j - 1][ordered[j - 1].length - 1]
        const b = ordered[j][0]
        events.push(splitEvent(L, a, b, front.length, rear.length, laps.slice(k + 1)))
      }
    }

    byLap.get(L)!.forEach((g) => {
      const from = new Set<number>()
      for (const b of g.riders) {
        const gi = iP.get(b)
        if (gi != null) from.add(gi)
      }
      if (from.size >= 2) {
        const merge: MergeEvent = { type: 'merge', lap: L, size: g.riders.length, fromGroups: from.size }
        events.push(merge)
      }
    })
  }

  function splitEvent(
    L: number, a: string, b: string, frontSize: number, rearSize: number, later: number[],
  ): SplitEvent {
    const followUp: { lap: number; gapMs: number }[] = []
    let rejoinedLap: number | null = null
    for (const M of later) {
      const iM = index.get(M)!
      const ga = iM.get(a)
      const gb = iM.get(b)
      if (ga == null || gb == null) break
      if (ga === gb) {
        rejoinedLap = M
        break
      }
      followUp.push({ lap: M, gapMs: (t(b, M) as number) - (t(a, M) as number) })
    }
    return {
      type: 'split', lap: L, kind: classifySplit(frontSize, rearSize), a, b, frontSize, rearSize,
      gapMs: (t(b, L) as number) - (t(a, L) as number),
      followUp, rejoinedLap, transient: rejoinedLap != null && rejoinedLap === later[0],
    }
  }

  // Pulled: last crossing on lap P, a later measured lap exists, never finished.
  const pulledByLap = new Map<number, string[]>()
  for (const r of history.riders) {
    if (r.finished || r.laps.size === 0) continue
    const last = Math.max(...r.laps.keys())
    const next = laps.find((lap) => lap > last)
    if (next == null) continue
    pulledByLap.set(next, [...(pulledByLap.get(next) ?? []), r.bib])
  }
  for (const [lap, bibs] of pulledByLap) {
    const pulled: PulledEvent = { type: 'pulled', lap, bibs }
    events.push(pulled)
  }

  const order = { split: 0, merge: 1, pulled: 2 } as const
  return events.sort((x, y) => x.lap - y.lap || order[x.type] - order[y.type])
}
```

- [ ] **Step 5: テスト通過を確認**

Run: `npx vitest run src/analysis/`
Expected: 全 PASS（events 9 件ほか）

- [ ] **Step 6: Commit**

```bash
git add src/analysis/mockLapHistory.ts src/analysis/events.ts src/analysis/events.test.ts
git commit -m "feat(analysis): 分断・合流・除外イベント検出と架空レースデータ"
```

---

### Task 6: SVG 共通部品と集団タイムライン

**Files:**
- Create: `src/components/analysis/svgAxis.tsx`
- Create: `src/components/analysis/GroupTimeline.tsx`

**Interfaces:**
- Consumes: `LapHistory`, `Group`, `RaceEvent`（Task 1）、`leaderTimes`（Task 4）
- Produces:
  - `linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number`
  - `RIDER_COLORS: string[]`（5 色）
  - `lapRange(history: LapHistory): number[]`（1..最終周）
  - `<LapAxis laps x y0 y1 missing />`、`<ValueAxis ticks y x0 x1 format />`
  - `<GroupTimeline history byLap events selected highlightLap />`

- [ ] **Step 1: 共通部品を作成**

`src/components/analysis/svgAxis.tsx`:

```tsx
import type { LapHistory } from '../../analysis/types'

export const RIDER_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a78bfa']

export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1)
  return (v: number) => r0 + (v - d0) * k
}

// Every lap from 1 to the last measured lap (untimed laps included as slots).
export function lapRange(history: LapHistory): number[] {
  const last = history.lapNumbers[history.lapNumbers.length - 1] ?? 0
  return Array.from({ length: last }, (_, i) => i + 1)
}

export function niceStep(span: number, count = 5): number {
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  return ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow
}

// Bottom lap axis. Untimed laps get a dotted vertical guide.
export function LapAxis({
  laps, x, y0, y1, missing,
}: { laps: number[]; x: (lap: number) => number; y0: number; y1: number; missing: number[] }) {
  const every = Math.max(1, Math.ceil(laps.length / 15))
  return (
    <g className="text-zinc-500">
      <line x1={x(laps[0] ?? 1)} x2={x(laps[laps.length - 1] ?? 1)} y1={y1} y2={y1} stroke="#3f3f46" />
      {missing.map((lap) => (
        <line key={`m${lap}`} x1={x(lap)} x2={x(lap)} y1={y0} y2={y1} stroke="#52525b" strokeDasharray="2 4" />
      ))}
      {laps.map((lap) =>
        lap % every === 0 || lap === 1 ? (
          <text key={lap} x={x(lap)} y={y1 + 14} textAnchor="middle" fontSize={10} fill="currentColor">
            {lap}
          </text>
        ) : null,
      )}
    </g>
  )
}

// Left value axis with horizontal grid lines.
export function ValueAxis({
  ticks, y, x0, x1, format,
}: { ticks: number[]; y: (v: number) => number; x0: number; x1: number; format: (v: number) => string }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="#27272a" />
          <text x={x0 - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#71717a">
            {format(v)}
          </text>
        </g>
      ))}
    </g>
  )
}
```

- [ ] **Step 2: 集団タイムラインを作成**

`src/components/analysis/GroupTimeline.tsx`:

```tsx
import { useMemo } from 'react'
import { leaderTimes } from '../../analysis/groups'
import type { Group, LapHistory, RaceEvent } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear, niceStep } from './svgAxis'

type Props = {
  history: LapHistory
  byLap: Map<number, Group[]>
  events: RaceEvent[]
  selected: string[] // bibs, colour order
  highlightLap: number | null
}

const W = 960
const H = 340
const M = { l: 44, r: 16, t: 18, b: 26 }

// ① Group timeline: x = lap, y = gap to the lap leader (seconds, growing down).
// Each group is a vertical band (width ∝ √size); ◆ split / ● merge / × pulled.
export function GroupTimeline({ history, byLap, events, selected, highlightLap }: Props) {
  const laps = lapRange(history)
  const leaders = useMemo(() => leaderTimes(history), [history])
  const names = useMemo(() => new Map(history.riders.map((r) => [r.bib, r.name])), [history])

  const maxGapS = useMemo(() => {
    let m = 10
    for (const gs of byLap.values()) for (const g of gs) m = Math.max(m, (g.frontGapMs + g.spanMs) / 1000)
    return m
  }, [byLap])
  const maxSize = useMemo(() => {
    let m = 1
    for (const gs of byLap.values()) for (const g of gs) m = Math.max(m, g.riders.length)
    return m
  }, [byLap])

  const x = linear(1, Math.max(2, laps.length), M.l + 10, W - M.r - 10)
  const y = linear(0, maxGapS, M.t, H - M.b)
  const step = (W - M.l - M.r) / Math.max(1, laps.length)
  const maxBw = Math.min(22, step * 0.7)
  const yStep = niceStep(maxGapS)
  const ticks = Array.from({ length: Math.floor(maxGapS / yStep) + 1 }, (_, i) => i * yStep)

  const gapOf = (bib: string, lap: number): number | null => {
    const r = history.riders.find((rr) => rr.bib === bib)
    const p = r?.laps.get(lap)
    const lead = leaders.get(lap)
    return p && lead != null ? (p.cumMs - lead) / 1000 : null
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="集団タイムライン">
      {highlightLap != null && (
        <rect x={x(highlightLap) - step / 2} y={M.t} width={step} height={H - M.t - M.b} fill="#7c3aed" opacity={0.18} />
      )}
      <ValueAxis ticks={ticks} y={(v) => y(v)} x0={M.l} x1={W - M.r} format={(v) => `+${v}s`} />
      <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />

      {[...byLap].flatMap(([lap, groups]) =>
        groups.map((g, gi) => {
          const bw = Math.max(3, maxBw * Math.sqrt(g.riders.length / maxSize))
          const top = y(g.frontGapMs / 1000)
          const h = Math.max(3, y((g.frontGapMs + g.spanMs) / 1000) - top)
          const members = g.riders.map((b) => `No.${b} ${names.get(b) ?? ''}`).join('\n')
          return (
            <g key={`${lap}-${gi}`}>
              <rect x={x(lap) - bw / 2} y={top} width={bw} height={h} rx={2} fill="#a1a1aa" opacity={0.35 + 0.5 * (g.riders.length / maxSize)}>
                <title>{`L${lap} 集団 ${g.riders.length}名 +${(g.frontGapMs / 1000).toFixed(1)}s\n${members}`}</title>
              </rect>
              {g.riders.length > 1 && (
                <text x={x(lap) + bw / 2 + 2} y={top + 8} fontSize={8} fill="#a1a1aa">{g.riders.length}</text>
              )}
            </g>
          )
        }),
      )}

      {selected.map((bib, i) => {
        const pts = history.lapNumbers
          .map((lap) => ({ lap, g: gapOf(bib, lap) }))
          .filter((p): p is { lap: number; g: number } => p.g != null)
          .map((p) => `${x(p.lap)},${y(p.g)}`)
        return pts.length > 1 ? (
          <polyline key={bib} points={pts.join(' ')} fill="none" stroke={RIDER_COLORS[i % RIDER_COLORS.length]} strokeWidth={1.8} />
        ) : null
      })}

      {events.map((e, i) => {
        if (e.type === 'split') {
          const g = gapOf(e.b, e.lap)
          if (g == null) return null
          const cx = x(e.lap)
          const cy = y(g)
          return (
            <path key={i} d={`M${cx},${cy - 5} L${cx + 5},${cy} L${cx},${cy + 5} L${cx - 5},${cy} Z`} fill={e.transient ? '#78350f' : '#f59e0b'}>
              <title>{`L${e.lap} ${e.kind} No.${e.a} ⇢ No.${e.b}`}</title>
            </path>
          )
        }
        if (e.type === 'merge')
          return (
            <circle key={i} cx={x(e.lap)} cy={M.t - 8} r={4} fill="#38bdf8">
              <title>{`L${e.lap} 合流 ${e.size}名`}</title>
            </circle>
          )
        return (
          <text key={i} x={x(e.lap)} y={M.t - 4} textAnchor="middle" fontSize={11} fill="#f87171">
            ×<title>{`L${e.lap} 除外 ${e.bibs.length}名`}</title>
          </text>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add src/components/analysis/svgAxis.tsx src/components/analysis/GroupTimeline.tsx
git commit -m "feat(analysis): SVG共通部品と集団タイムライン"
```

---

### Task 7: イベント一覧・順位推移・ラップタイム推移

**Files:**
- Create: `src/components/analysis/SplitEventList.tsx`
- Create: `src/components/analysis/PositionChart.tsx`
- Create: `src/components/analysis/LapTimeChart.tsx`

**Interfaces:**
- Consumes: `LapHistory`, `RaceEvent`（Task 1）、`RIDER_COLORS`, `LapAxis`, `ValueAxis`, `lapRange`, `linear`, `niceStep`（Task 6）
- Produces:
  - `<SplitEventList history events selected persistentOnly onTogglePersistent onSelectLap onToggleRider highlightLap />`
  - `<PositionChart history selected />`
  - `<LapTimeChart history selected />`

- [ ] **Step 1: イベント一覧を作成**

`src/components/analysis/SplitEventList.tsx`:

```tsx
import type { LapHistory, RaceEvent } from '../../analysis/types'
import { RIDER_COLORS } from './svgAxis'

type Props = {
  history: LapHistory
  events: RaceEvent[]
  selected: string[]
  persistentOnly: boolean
  onTogglePersistent: () => void
  onSelectLap: (lap: number) => void
  onToggleRider: (bib: string) => void
  highlightLap: number | null
}

const s1 = (ms: number) => `+${(ms / 1000).toFixed(1)}s`

// ② Event list in lap order. A / B are the riders on either side of the gap
// (B = first behind it); clicking a row highlights that lap in the timeline.
export function SplitEventList({
  history, events, selected, persistentOnly, onTogglePersistent, onSelectLap, onToggleRider, highlightLap,
}: Props) {
  const names = new Map(history.riders.map((r) => [r.bib, r.name]))
  const shown = events.filter((e) => !(persistentOnly && e.type === 'split' && e.transient))

  const Rider = ({ bib, strong }: { bib: string; strong?: boolean }) => {
    const ci = selected.indexOf(bib)
    return (
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          onToggleRider(bib)
        }}
        className={`rounded px-1 font-mono ${strong ? 'font-bold text-amber-200' : 'text-zinc-300'} hover:bg-zinc-800`}
        style={ci >= 0 ? { boxShadow: `inset 0 -2px 0 ${RIDER_COLORS[ci % RIDER_COLORS.length]}` } : undefined}
        title={names.get(bib) ?? ''}
      >
        No.{bib} {names.get(bib) ?? ''}
      </button>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">中切れイベント</h2>
        <label className="flex items-center gap-1 text-[11px] text-zinc-400">
          <input type="checkbox" checked={persistentOnly} onChange={onTogglePersistent} />
          持続のみ
        </label>
      </div>
      <p className="border-b border-zinc-800/60 px-3 py-1.5 text-[10px] text-zinc-500">
        計測はフィニッシュラインで周1回。「L周」は L周目の途中で発生し L周目通過で確認。A/B は切れ目の前後の選手（B＝後ろ側の先頭）。
      </p>
      <ul className="max-h-[32rem] overflow-y-auto text-xs">
        {shown.length === 0 && <li className="px-3 py-6 text-center text-zinc-500">イベントなし</li>}
        {shown.map((e, i) => (
          <li
            key={i}
            onClick={() => onSelectLap(e.lap)}
            className={`cursor-pointer border-b border-zinc-800/60 px-3 py-1.5 hover:bg-zinc-800/40 ${highlightLap === e.lap ? 'bg-violet-950/40' : ''}`}
          >
            <span className="mr-2 font-mono font-bold text-zinc-200">L{e.lap}</span>
            {e.type === 'split' && (
              <>
                <span className={`mr-2 rounded px-1 text-[10px] font-bold ${e.kind === '中切れ' ? 'bg-amber-900 text-amber-200' : e.kind === '抜け出し' ? 'bg-sky-900 text-sky-200' : 'bg-zinc-700 text-zinc-200'}`}>
                  {e.kind}
                </span>
                <span className="mr-2 font-mono text-zinc-400">{e.frontSize}｜{e.rearSize}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-zinc-500">A</span>
                  <Rider bib={e.a} />
                  <span className="text-zinc-500">⇢ B</span>
                  <Rider bib={e.b} strong />
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  {s1(e.gapMs)}
                  {e.followUp.slice(0, 3).map((f) => ` → L${f.lap} ${s1(f.gapMs)}`).join('')}
                  {e.followUp.length > 3 ? ' …' : ''}
                  <span className="ml-2">
                    {e.rejoinedLap != null ? `L${e.rejoinedLap}で合流${e.transient ? '（一時的）' : ''}` : '持続'}
                  </span>
                </div>
              </>
            )}
            {e.type === 'merge' && (
              <span className="text-sky-300">合流 {e.size}名（{e.fromGroups}集団）</span>
            )}
            {e.type === 'pulled' && <span className="text-red-300">除外 {e.bibs.length}名</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: 順位推移を作成**

`src/components/analysis/PositionChart.tsx`:

```tsx
import type { LapHistory } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear } from './svgAxis'

const W = 560
const H = 260
const M = { l: 34, r: 10, t: 10, b: 24 }

// ③ Position chart: x = lap, y = 通過順位 (1 at the top). Selected riders are
// coloured; everyone else is a faint grey line.
export function PositionChart({ history, selected }: { history: LapHistory; selected: string[] }) {
  const laps = lapRange(history)
  let maxPos = 1
  for (const r of history.riders) for (const p of r.laps.values()) if (p.pos != null) maxPos = Math.max(maxPos, p.pos)
  const x = linear(1, Math.max(2, laps.length), M.l + 6, W - M.r - 6)
  const y = linear(1, maxPos, M.t, H - M.b)
  const ticks = [1, ...[10, 20, 30, 50, 75, 100, 150].filter((v) => v < maxPos), maxPos]

  const line = (bib: string) => {
    const r = history.riders.find((rr) => rr.bib === bib)
    if (!r) return ''
    return history.lapNumbers
      .map((lap) => r.laps.get(lap))
      .map((p, i) => (p?.pos != null ? `${x(history.lapNumbers[i])},${y(p.pos)}` : null))
      .filter(Boolean)
      .join(' ')
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">順位推移</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="順位推移">
        <ValueAxis ticks={ticks} y={y} x0={M.l} x1={W - M.r} format={(v) => String(v)} />
        <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />
        {history.riders
          .filter((r) => !selected.includes(r.bib))
          .map((r) => (
            <polyline key={r.bib} points={line(r.bib)} fill="none" stroke="#3f3f46" strokeWidth={0.6} />
          ))}
        {selected.map((bib, i) => (
          <polyline key={bib} points={line(bib)} fill="none" stroke={RIDER_COLORS[i % RIDER_COLORS.length]} strokeWidth={2} />
        ))}
      </svg>
    </section>
  )
}
```

- [ ] **Step 3: ラップタイム推移を作成**

`src/components/analysis/LapTimeChart.tsx`:

```tsx
import type { LapHistory } from '../../analysis/types'
import { LapAxis, RIDER_COLORS, ValueAxis, lapRange, linear, niceStep } from './svgAxis'

const W = 560
const H = 240
const M = { l: 44, r: 10, t: 10, b: 24 }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}`

// ④ Lap-time chart for the selected riders (seconds per lap).
export function LapTimeChart({ history, selected }: { history: LapHistory; selected: string[] }) {
  const laps = lapRange(history)
  const series = selected
    .map((bib) => history.riders.find((r) => r.bib === bib))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      bib: r.bib,
      pts: history.lapNumbers
        .map((lap) => ({ lap, s: r.laps.get(lap)?.lapMs }))
        .filter((p): p is { lap: number; s: number } => p.s != null)
        .map((p) => ({ lap: p.lap, s: p.s / 1000 })),
    }))
  const all = series.flatMap((s) => s.pts.map((p) => p.s))

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">ラップタイム推移</h2>
      {all.length === 0 ? (
        <p className="px-3 py-10 text-center text-xs text-zinc-500">★ で選手を選ぶと表示されます（最大5名を色分け）</p>
      ) : (
        (() => {
          const lo = Math.floor(Math.min(...all))
          const hi = Math.ceil(Math.max(...all))
          const x = linear(1, Math.max(2, laps.length), M.l + 6, W - M.r - 6)
          const y = linear(lo, hi, H - M.b, M.t)
          const st = niceStep(hi - lo || 1)
          const ticks: number[] = []
          for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) ticks.push(v)
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ラップタイム推移">
              <ValueAxis ticks={ticks} y={y} x0={M.l} x1={W - M.r} format={fmt} />
              <LapAxis laps={laps} x={x} y0={M.t} y1={H - M.b} missing={history.missingLaps} />
              {series.map((s, i) => (
                <polyline
                  key={s.bib}
                  points={s.pts.map((p) => `${x(p.lap)},${y(p.s)}`).join(' ')}
                  fill="none"
                  stroke={RIDER_COLORS[i % RIDER_COLORS.length]}
                  strokeWidth={1.8}
                />
              ))}
            </svg>
          )
        })()
      )}
    </section>
  )
}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/SplitEventList.tsx src/components/analysis/PositionChart.tsx src/components/analysis/LapTimeChart.tsx
git commit -m "feat(analysis): イベント一覧・順位推移・ラップタイム推移"
```

---

### Task 8: AnalysisView と SPA プレビュー（`?mock=analysis`）

**Files:**
- Create: `src/components/analysis/AnalysisView.tsx`
- Create: `src/components/analysis/AnalysisPreview.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `LoadFn`, `LoadProgress`（Task 3）、`groupsByLap`, `DEFAULT_THRESHOLD_MS`（Task 4）、`detectEvents`（Task 5）、`mockLapHistory`（Task 5）、Task 6–7 のコンポーネント、`riderKey`（`src/types.ts`）
- Produces: `<AnalysisView load favorites onToggleFavorite enabled disabledReason? />`
  - `favorites: Set<string>`（`riderKey` 形式 `${bib}-${teamCode ?? ''}-${name}`）

- [ ] **Step 1: AnalysisView を作成**

`src/components/analysis/AnalysisView.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { detectEvents } from '../../analysis/events'
import type { LoadFn, LoadProgress } from '../../analysis/fetchLapHistory'
import { DEFAULT_THRESHOLD_MS, groupsByLap } from '../../analysis/groups'
import type { Group, LapHistory } from '../../analysis/types'
import { riderKey } from '../../types'
import { GroupTimeline } from './GroupTimeline'
import { LapTimeChart } from './LapTimeChart'
import { PositionChart } from './PositionChart'
import { SplitEventList } from './SplitEventList'

type Props = {
  load: LoadFn
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  enabled: boolean
  disabledReason?: string
}

type Status = 'idle' | 'loading' | 'done' | 'aborted' | 'error'
const MAX_COLORED = 5

// Analysis tab: loads the per-lap history only on demand, keeps it in memory,
// and recomputes groups/events locally when the threshold changes.
export function AnalysisView({ load, favorites, onToggleFavorite, enabled, disabledReason }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [history, setHistory] = useState<LapHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [thresholdMs, setThresholdMs] = useState(DEFAULT_THRESHOLD_MS)
  const [persistentOnly, setPersistentOnly] = useState(false)
  const [highlightLap, setHighlightLap] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  const start = () => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setStatus('loading')
    setError(null)
    setProgress(null)
    load(setProgress, ac.signal)
      .then((h) => {
        if (ac.signal.aborted) return
        setHistory(h)
        setStatus('done')
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) setStatus('aborted')
        else {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      })
  }
  const stop = () => abort.current?.abort()

  const byLap = useMemo(
    () => (history ? groupsByLap(history, thresholdMs) : new Map<number, Group[]>()),
    [history, thresholdMs],
  )
  const events = useMemo(() => (history ? detectEvents(history, byLap) : []), [history, byLap])
  const selected = useMemo(
    () => (history ? history.riders.filter((r) => favorites.has(riderKey(r))).map((r) => r.bib).slice(0, MAX_COLORED) : []),
    [history, favorites],
  )
  const toggleRider = (bib: string) => {
    const r = history?.riders.find((x) => x.bib === bib)
    if (r) onToggleFavorite(riderKey(r))
  }

  if (!enabled)
    return (
      <p className="px-3 py-12 text-center text-sm text-zinc-500">
        {disabledReason ?? '分析は周回レース（3周以上のマススタート）で利用できます。'}
      </p>
    )

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs">
        {status === 'loading' ? (
          <button onClick={stop} className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200">
            中止
          </button>
        ) : (
          <button onClick={start} className="rounded-md bg-violet-700 px-3 py-1.5 font-semibold text-white hover:bg-violet-600">
            {history ? '再読み込み' : '分析を読み込む'} ▶
          </button>
        )}
        {status === 'loading' && (
          <span className="flex items-center gap-2 text-zinc-400">
            {progress?.phase === 'laps' ? (
              <>
                <span className="inline-block h-1.5 w-32 overflow-hidden rounded bg-zinc-800">
                  <span className="block h-full bg-violet-500" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
                </span>
                ラップ取得 {progress.done}/{progress.total}
              </>
            ) : (
              '選手リスト取得中…'
            )}
          </span>
        )}
        {status === 'aborted' && <span className="text-zinc-500">中止しました</span>}
        {status === 'error' && <span className="text-red-400">取得に失敗しました：{error}</span>}
        {history && history.failedBibs.length > 0 && (
          <span className="text-amber-400">取得失敗 {history.failedBibs.length}名</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-zinc-400">
          しきい値
          <input
            type="range" min={1000} max={10000} step={500} value={thresholdMs}
            onChange={(e) => setThresholdMs(Number(e.target.value))}
          />
          <span className="w-10 font-mono text-zinc-200">{(thresholdMs / 1000).toFixed(1)}秒</span>
        </label>
        <span className="w-full text-[10px] text-zinc-500">
          閲覧中の LapClip と同じサイトの公開ページ（各選手のラップ一覧）をこのブラウザ内で順番に読み取ります（250ms間隔）。保存・送信はしません。
        </span>
      </section>

      {history ? (
        <>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              集団タイムライン <span className="normal-case text-zinc-500">（縦＝先頭との差・帯の太さ＝人数・◆分断 ●合流 ×除外）</span>
            </h2>
            <div className="p-2">
              <GroupTimeline history={history} byLap={byLap} events={events} selected={selected} highlightLap={highlightLap} />
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SplitEventList
              history={history} events={events} selected={selected}
              persistentOnly={persistentOnly} onTogglePersistent={() => setPersistentOnly((v) => !v)}
              onSelectLap={(lap) => setHighlightLap((cur) => (cur === lap ? null : lap))}
              onToggleRider={toggleRider} highlightLap={highlightLap}
            />
            <div className="flex flex-col gap-3">
              <PositionChart history={history} selected={selected} />
              <LapTimeChart history={history} selected={selected} />
            </div>
          </div>
        </>
      ) : (
        status !== 'loading' && (
          <p className="px-3 py-10 text-center text-sm text-zinc-500">
          「分析を読み込む」を押すと、全選手の周回データを読み込んで集団の分断を可視化します。
          </p>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: SPA プレビューを作成**

`src/components/analysis/AnalysisPreview.tsx`:

```tsx
import { useState } from 'react'
import type { LoadFn } from '../../analysis/fetchLapHistory'
import { mockLapHistory } from '../../analysis/mockLapHistory'
import { AnalysisView } from './AnalysisView'

// SPA preview (?mock=analysis): the analysis tab on SYNTHETIC data, with a
// simulated progress bar and no network access.
const mockLoad: LoadFn = async (onProgress, signal) => {
  const h = mockLapHistory()
  onProgress({ phase: 'roster', done: h.riders.length, total: h.riders.length })
  for (let i = 0; i <= h.riders.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    onProgress({ phase: 'laps', done: i, total: h.riders.length })
    await new Promise((r) => setTimeout(r, 40))
  }
  return h
}

export function AnalysisPreview() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(['9-CCC-Rider I', '1-AAA-Rider A']))
  const toggle = (k: string) =>
    setFavorites((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-zinc-100">
      <p className="mb-2 text-[11px] text-amber-300">プレビュー：架空データ（?mock=analysis）</p>
      <AnalysisView load={mockLoad} favorites={favorites} onToggleFavorite={toggle} enabled />
    </div>
  )
}
```

- [ ] **Step 3: main.tsx で切替**

`src/main.tsx` を次に置き換え:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AnalysisPreview } from './components/analysis/AnalysisPreview'
import './index.css'

// ?mock=analysis previews the analysis tab on synthetic data.
const analysis = new URLSearchParams(location.search).get('mock') === 'analysis'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{analysis ? <AnalysisPreview /> : <App />}</StrictMode>,
)
```

- [ ] **Step 4: 型チェックとプレビュー確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

`.claude/launch.json` の dev サーバーを起動し、`http://localhost:<port>/?mock=analysis` を開く。「分析を読み込む」→ 進捗バー → 4 図表示。確認項目：L4 に ◆（中切れ 8｜4、A No.8 ⇢ B No.9）、L7 に ●合流、L9 に ×除外・抜け出し、2 周目に点線、しきい値スライダーでイベント数が変わる、★ 選択（No.1 / No.9）の線が色付き。

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/AnalysisView.tsx src/components/analysis/AnalysisPreview.tsx src/main.tsx
git commit -m "feat(analysis): 分析ビューと SPA プレビュー (?mock=analysis)"
```

---

### Task 9: オーバーレイへの統合（タブ・実取得ローダー）

**Files:**
- Modify: `src/userscript/Overlay.tsx`

**Interfaces:**
- Consumes: `AnalysisView`（Task 8）、`fetchLapHistory`, `LoadFn`（Task 3）、`parseEntries`（`./parseDom`）、`evtCtgFromUrl`（`./fetchLaptimes`）
- Produces: なし（最終統合）

- [ ] **Step 1: import とローダーを追加**

`src/userscript/Overlay.tsx` の import に追加:

```tsx
import { AnalysisView } from '../components/analysis/AnalysisView'
import { fetchLapHistory, type LoadFn } from '../analysis/fetchLapHistory'
```

`./parseDom` の import に `parseEntries` を追加:

```tsx
import {
  detectRaceShape,
  parseEntries,
  parseIndividual,
  parseMassStart,
  parseTeam,
} from './parseDom'
```

コンポーネント冒頭のコメント `// is NO network access here.` を次に修正:

```tsx
// The F1-style overlay. Timing data comes from the live page DOM (parseDom).
// Network access is limited to same-origin public LapClip pages read on demand:
// team-TT lap splits (laptimes.php) and the analysis tab (button-triggered).
```

`favoritesSet` の定義の直後に追加:

```tsx
  // Analysis tab (mass-start lap races only). Kept mounted while hidden so a
  // loaded history survives switching back to the timing view.
  const [view, setView] = useState<'timing' | 'analysis'>('timing')
  const analysisEnabled = massStart && (leaderLapsDone ?? 0) >= 3
  const loadHistory: LoadFn = useCallback((onProgress, signal) => {
    const { evt, ctg } = evtCtgFromUrl()
    const firstPage = parseEntries().map((e) => ({ bib: e.bib, name: e.name, teamCode: e.teamCode }))
    return fetchLapHistory({ evt, ctg, firstPage, signal, onProgress })
  }, [])
```

注意：`leaderLapsDone` は `favoritesSet` より後で定義されているため、上記ブロックは `leaderLapsDone` の `useMemo` の**直後**に置くこと。

- [ ] **Step 2: タブと表示切替を追加**

`<main ...>` 開始タグの直後、既存の三項演算子全体を次のように包む:

```tsx
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-3">
        {massStart && (
          <div className="mb-3 flex gap-1 border-b border-zinc-800">
            {(['timing', 'analysis'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold ${
                  view === v ? 'border-violet-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'timing' ? 'タイミング' : '分析'}
              </button>
            ))}
          </div>
        )}
        {massStart && (
          <div className={view === 'analysis' ? '' : 'hidden'}>
            <AnalysisView
              load={loadHistory}
              favorites={favoritesSet}
              onToggleFavorite={(k) => toggle(setFavorites, k)}
              enabled={analysisEnabled}
              disabledReason="分析は周回レース（先頭が3周以上のマススタート）で利用できます。"
            />
          </div>
        )}
        <div className={massStart && view === 'analysis' ? 'hidden' : ''}>
          {/* 既存の noData / teamMode / massStart / TimingTower の三項演算子をそのままここへ */}
        </div>
      </main>
```

（`{/* 既存の … */}` の行は、移動元の既存 JSX ブロック `{noData && parsedOnce ? ( … ) : teamMode ? ( … ) : massStart ? ( … ) : ( … )}` に**そのまま置き換える**。中身は変更しない。）

- [ ] **Step 3: 型チェック・全テスト・ビルド**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: エラーなし、全 PASS、`dist/lapclip-visualizer.user.js` 生成

- [ ] **Step 4: Commit**

```bash
git add src/userscript/Overlay.tsx
git commit -m "feat(analysis): オーバーレイに[タイミング][分析]タブを追加"
```

---

### Task 10: ドキュメント・バージョン・成果物・実データ受け入れ確認

**Files:**
- Modify: `README.md`
- Modify: `docs/lapclip-data-formats.md`
- Modify: `package.json`（version）
- 再生成: `android/app/src/main/assets/lapclip-overlay.js`, `ios-shortcut/lapclip-visualizer-ios.js`, `ios-bookmarklet/bookmarklet.txt`

- [ ] **Step 1: README の取扱い記述を修正**

`README.md` の「本ツールが行わないこと」の 1 行

```
- LapClip データの**外部送信**（fetch / XHR / sendBeacon / WebSocket は一切なし）
```

を次に置き換え:

```
- LapClip データの**外部送信**（LapClip 以外のサーバーへの通信は一切なし）
```

同節の直前「本ツールが行うこと」の末尾に追加:

```
- 必要なときだけ、**閲覧中の LapClip と同じサイトの公開ページ**（チームTTのラップ一覧、分析タブでの各選手のラップ一覧）を**ブラウザ内で読み取り**ます。分析タブはボタンを押したときだけ、1件ずつ間隔を空けて読み込み、結果は保存しません。
```

「仕組み（ブラウザ内で完結）」の 2. を次に置き換え:

```
2. ユーザースクリプトが **そのページの DOM を読み取る**（`src/userscript/parseDom.ts`）。チームTTのラップ詳細と分析タブのみ、同じサイトの公開ページ（`laptimes.php` 等）を追加で読み取る。
```

「使い方」に 1 行追加:

```
- **分析タブ**（PC・マススタートの周回レース）：「分析を読み込む」で全選手の周回データを読み込み、**集団タイムライン・中切れイベント（いつ・どの選手の間で切れたか）・順位推移・ラップタイム推移**を表示。しきい値（初期 3 秒）はスライダーで調整。
```

- [ ] **Step 2: データ書式メモに追記**

`docs/lapclip-data-formats.md` の「## マイナビ ツール・ド・九州」節の直前に追加:

```markdown
## 選手別ラップ一覧（`laptimes.php`）とページ送り

- URL：`/lap/laptimes.php?evt={evt}&ctg={ctg}&num={bib}`
- 表の各行：`td.syukai`（周回番号 / `N/M周` / `FINISH`）・`td.juni`（その周の通過順位）・`td.lap`（ラップタイム `M:SS.cc`）・`td.total`（累計 `H:MM:SS.cc`）。解析は `src/analysis/laptimesRows.ts`。
- **計測漏れ**：全員同じ周が欠けることがある（2026 佐世保クリテリウムは 2 周目が全員欠損）。FINISH は「全選手の最大周回番号 + 1」として扱う。
- **result.php のページ送り**：1 ページ 100 行（無限スクロール）。`&page=2` で 101 位以降を取得できる。分析タブは 100 行未満のページが返るまで順に読む。
```

- [ ] **Step 3: バージョンと成果物**

`package.json` の `"version": "2.2.0"` を `"version": "3.0.0"` に変更し、次を実行:

```bash
npx tsc --noEmit && npx vitest run && npm run build && npm run build:android-asset && node scripts/gen-ios-shortcut.mjs && node scripts/gen-ios-bookmarklet.mjs
git checkout -- src/userscript/__snapshots__/
```

Expected: 全 PASS。`dist/lapclip-visualizer.user.js` の `@version 3.0.0`。スナップショットは改行コード差分のみのため戻す。

- [ ] **Step 4: 実データ受け入れ確認（ブラウザ内のみ）**

組み込みブラウザで `https://matrix-sports.jp/lap/result.php?evt=tdk2026&ctg=100` を開き、`dist/lapclip-visualizer.user.js` 相当のコードを注入（または Tampermonkey 環境で）して分析タブを開く。「分析を読み込む」→ 106 名分取得後、しきい値 3 秒で次を確認（spec §1）：

- L5 後方 10 名の分断 / L7 56｜28 の中切れ（A No.131 ⇢ B No.11）/ L17 8 名の抜け出し / L22 除外 28 名 / L25 合流 / L28 No.91 の単独先行
- 2 周目が点線の隙間
- 取得失敗 0 名

注入が難しい場合は、`src/analysis/` の関数を一時テスト（コミットしない・取得 HTML はスクラッチパッドのみ）で実ページ HTML に当てて同じ項目を確認する。

- [ ] **Step 5: Commit**

```bash
git add README.md docs/lapclip-data-formats.md package.json android/app/src/main/assets/lapclip-overlay.js ios-shortcut/lapclip-visualizer-ios.js ios-bookmarklet/bookmarklet.txt
git commit -m "chore: v3.0.0 — 分析タブ（中切れ可視化）、取扱い記述を実態に合わせて修正"
```

（push・リリースはユーザー確認後。）
