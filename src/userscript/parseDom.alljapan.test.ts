// Fixture tests driven by the REAL 全日本自転車競技選手権大会 ロード・レース
// (matrix-sports.jp, evt=250622_jprr) result.php captures saved under /test.
//
// The captures are browser "view-source" HTML: the real result.php markup is
// entity-escaped inside <td class="line-content"> cells with syntax-highlight
// spans. loadRealRoot() reconstructs the original result.php DOM by joining the
// textContent of those cells, then re-parsing — so the parser runs against the
// exact bytes the source served, treating these files as the canonical ("正")
// fixtures for the All-Japan road race.
//
// These pages are a FINISHED mass-start road race, but the source never emits a
// "FINISH" phase here — every rider (winner included) shows the final lap count
// "N周", lap-down riders carry a "-N周" gap, and there are no SPn sprint
// checkpoints in this dataset. SPn / X/Y周 / FINISH extraction stays covered by
// the synthetic TOJ fixtures in parseDom.test.ts; here we pin what the All-Japan
// road source actually provides.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectMode,
  detectRaceShape,
  parseEntries,
  parseMassStart,
} from './parseDom'
import { clearPage, mountPage } from './__fixtures__/lapclipHtml'

const TEST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'test')

// '' = the no-ctg overall (Men Elite) capture; others are the per-category files.
const CTGS = ['', 'MU-R', 'WE-R', 'WM', 'MM-30', 'MM-50'] as const

const fileFor = (ctg: string) =>
  ctg === ''
    ? 'view-source_https___matrix-sports.jp_lap_result.php_evt=250622_jprr.html'
    : `view-source_https___matrix-sports.jp_lap_result.php_evt=250622_jprr&ctg=${ctg}.html`

const hrefFor = (ctg: string) =>
  `https://matrix-sports.jp/lap/result.php?evt=250622_jprr${ctg ? `&ctg=${ctg}` : ''}`

// Reconstruct the original result.php DOM out of a saved view-source capture.
function loadRealRoot(ctg: string): Document {
  const vs = readFileSync(join(TEST_DIR, fileFor(ctg)), 'utf8')
  const wrap = new DOMParser().parseFromString(vs, 'text/html')
  const src = Array.from(wrap.querySelectorAll('td.line-content'))
    .map((c) => c.textContent ?? '')
    .join('\n')
  return new DOMParser().parseFromString(src, 'text/html')
}

// ---------------------------------------------------------------------------
// 1. Race-shape detection: every All-Japan road capture must classify as a
//    mass-start road race — NOT individual_tt and NOT team_tt. In particular
//    the "全日本"/"選手権"/"ロード・レース" title must not pull it onto the TT
//    path (detectMode stays 'individual' — no チームTT/TTT misfire).
// ---------------------------------------------------------------------------
describe('全日本ロード (real 250622_jprr) — detectRaceShape', () => {
  it.each(CTGS)('ctg=%s → mass_start (road), not a TT', (ctg) => {
    const root = loadRealRoot(ctg)
    const href = hrefFor(ctg)
    expect(root.querySelector('title')?.textContent).toContain(
      '全日本自転車競技選手権大会 ロード・レース',
    )
    expect(detectMode(href, root)).toBe('individual')
    expect(detectRaceShape(root, href)).toBe('mass_start')
  })
})

// ---------------------------------------------------------------------------
// 2. Extraction snapshot: 着順(位) / 選手名 / トップ差(+Top) / 周回遅れ(-N周)
//    are read correctly. Uses MU-R (Men U23, 100 rows, many lap-down riders).
//    SPn is absent from All-Japan road data, so lastCheckpoint is null for the
//    whole field — pinned below to document that fact.
// ---------------------------------------------------------------------------
describe('全日本ロード (real MU-R) — extraction', () => {
  const pick = (r: ReturnType<typeof parseMassStart>['riders'][number]) => ({
    officialRank: r.officialRank,
    name: r.name,
    elapsedText: r.elapsedText,
    gapText: r.gapText,
    gapMs: r.gapMs,
    lapsDone: r.lapsDone,
    lapsDown: r.lapsDown,
    lastCheckpoint: r.lastCheckpoint,
    isFinisher: r.isFinisher,
    status: r.status,
  })

  it('snapshots the leaders + lap-down riders exactly as extracted', () => {
    const data = parseMassStart(loadRealRoot('MU-R'))
    const lapDown = data.riders.filter((r) => r.lapsDown != null)
    expect({
      raceShape: data.raceShape,
      riderCount: data.riders.length,
      lapsTotal: data.lapsTotal,
      top8: data.riders.slice(0, 8).map(pick),
      firstThreeLapDown: lapDown.slice(0, 3).map(pick),
    }).toMatchSnapshot()
  })

  it('reads 着順 / 選手名 / トップ差 / 周回遅れ on known rows', () => {
    const data = parseMassStart(loadRealRoot('MU-R'))
    expect(data.raceShape).toBe('mass_start')
    expect(data.riders).toHaveLength(100)
    // A finished road race, but the source shows the final lap count, never
    // "FINISH": no finisher is flagged and the total lap count stays unknown.
    expect(data.lapsTotal).toBeNull()
    expect(data.riders.every((r) => r.isFinisher === false)).toBe(true)
    // No sprint checkpoints exist in All-Japan road data.
    expect(data.riders.every((r) => r.lastCheckpoint == null)).toBe(true)

    // 着順(位) is read straight from the "N位" column, in source order.
    expect(data.riders.slice(0, 5).map((r) => r.officialRank)).toEqual([
      1, 2, 3, 4, 5,
    ])

    // Winner: 選手名 + トップ差 0 + final lap count.
    const winner = data.riders[0]
    expect(winner.name).toBe('森田　叶夢') // full-width space kept verbatim
    expect(winner.gapText).toBe('0:00.000')
    expect(winner.gapMs).toBe(0)
    expect(winner.lapsDone).toBe(14)
    expect(winner.elapsedText).toBe('3:20:55.580')

    // Runner-up: トップ差 parsed to ms (+0:01.124 → 1124).
    const second = data.riders[1]
    expect(second.gapText).toBe('+0:01.124')
    expect(second.gapMs).toBe(1124)

    // 周回遅れ: "-N周" gaps become a lap count, not a time.
    const lapDown = data.riders.filter((r) => r.lapsDown != null)
    expect(lapDown).toHaveLength(78)
    expect(lapDown[0].gapText).toMatch(/^-\d+周$/)
    expect(lapDown[0].lapsDown).toBeGreaterThanOrEqual(1)
    expect(lapDown[0].gapMs).toBeNull() // a lap-down gap is not a time gap
  })
})

// ---------------------------------------------------------------------------
// 3. Nothing is silently dropped, and unknown phases/statuses are kept with
//    their raw text intact (not discarded, not mislabelled FINISH).
//    NOTE: the one case current parseEntries does drop is a row missing BOTH a
//    bib and a name — that limitation is left as-is here (we pin current
//    behaviour, per the maintainer decision), and every real All-Japan row
//    carries both, so the real captures lose zero rows.
// ---------------------------------------------------------------------------
describe('全日本ロード — no silent row loss / raw retention', () => {
  afterEach(() => clearPage())

  it.each(CTGS)('ctg=%s keeps every a.result row', (ctg) => {
    const root = loadRealRoot(ctg)
    const domRows = root.querySelectorAll('a.result').length
    expect(domRows).toBeGreaterThan(0)
    expect(parseEntries(root)).toHaveLength(domRows)
    expect(parseMassStart(root).riders).toHaveLength(domRows)
  })

  it('retains unknown phases / abnormal statuses verbatim', () => {
    // One normal row, one with a phase the parser does not recognise, one DNF.
    mountPage('全日本自転車競技選手権大会 ロード・レース - テストのリザルト', [
      { rank: '1位', bib: '1', name: 'Known Rider', phase: '4周', time: '1:00:00.000', gap: '0:00.000' },
      { rank: '2位', bib: '2', name: 'Unknown Phase', phase: '区間途中', time: '1:05:00.000', gap: '+5:00.000' },
      { rank: '-', bib: '3', name: 'Did Not Finish', phase: 'DNF', time: '-:--:--.---', gap: '-:--' },
    ])
    const data = parseMassStart()

    // Nothing dropped: all three rows survive.
    expect(data.riders).toHaveLength(3)

    const unknown = data.riders.find((r) => r.name === 'Unknown Phase')
    expect(unknown).toBeDefined()
    expect(unknown!.status).toBe('UNKNOWN') // generic fallback, not guessed
    expect(unknown!.statusText).toBe('区間途中') // source wording kept verbatim
    expect(unknown!.elapsedText).toBe('1:05:00.000') // raw time preserved
    expect(unknown!.gapText).toBe('+5:00.000') // raw gap preserved
    expect(unknown!.lastCheckpoint).toBeNull() // a status label, not a checkpoint
    expect(unknown!.isFinisher).toBe(false) // not mislabelled FINISH

    const dnf = data.riders.find((r) => r.name === 'Did Not Finish')
    expect(dnf).toBeDefined()
    expect(dnf!.status).toBe('DNF') // abnormal status preserved as-is
    expect(dnf!.statusText).toBe('DNF') // raw label retained
    expect(dnf!.elapsedText).toBe('-:--:--.---') // raw placeholder text retained
  })
})
