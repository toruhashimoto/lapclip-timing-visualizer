// Truth table for detectRaceShape, pinning the explicit ロード・レース rule:
// a page whose title says it is a ロード・レース (road race) and does NOT mention
// a time trial is a mass-start road race — even before the content heuristics
// would otherwise classify it (e.g. an empty pre-start page, or a row sample
// with centisecond / 中間点 noise). Existing TOJ / 全日本TT / チームTT rows are
// included as non-regression anchors and must stay green.
import { afterEach, describe, expect, it } from 'vitest'
import { detectRaceShape } from './parseDom'
import type { RaceShape } from '../types'
import {
  CRIT_TITLE,
  JPTTT_TITLE,
  ROAD_TITLE,
  TEAM_TT_TITLE,
  TT_TITLE,
  clearPage,
  critRows,
  jptttRows,
  mountPage,
  roadRows,
  teamTTMidRows,
  ttLiveRows,
  ttRows,
  type FixtureRow,
} from './__fixtures__/lapclipHtml'

// All-Japan titles (real wording: marquee road uses "ロード・レース").
const JPRR_ROAD_TITLE =
  '全日本自転車競技選手権大会 ロード・レース - Men Eliteのリザルト | LAP CLIP'
const JITT_TITLE =
  '全日本自転車競技選手権大会 個人タイムトライアル - Men Eliteのリザルト | LAP CLIP'
// Pathological: a page that names BOTH disciplines — the TT mention must keep
// the road rule from firing, so content decides.
const ROAD_AND_TT_TITLE =
  '全日本自転車競技選手権大会 ロード・レース／個人タイムトライアル 総合のリザルト | LAP CLIP'

const RESULT = (evt: string, ctg: string) =>
  `https://matrix-sports.jp/lap/result.php?evt=${evt}${ctg ? `&ctg=${ctg}` : ''}`

type Case = {
  name: string
  title: string
  rows: FixtureRow[]
  href: string
  expected: RaceShape
}

const TABLE: Case[] = [
  // --- ロード・レース title rule (the new behaviour) ---
  {
    name: 'jprr road title + N周 秒精度 → mass_start',
    title: JPRR_ROAD_TITLE,
    rows: roadRows,
    href: RESULT('250622_jprr', 'ME-R'),
    expected: 'mass_start',
  },
  {
    name: 'jprr road title + 空ページ(レース前) → mass_start',
    title: JPRR_ROAD_TITLE,
    rows: [],
    href: RESULT('250622_jprr', 'ME-R'),
    expected: 'mass_start',
  },
  {
    name: 'jprr road title + センチ秒タイム混入 → mass_start',
    title: JPRR_ROAD_TITLE,
    rows: ttRows,
    href: RESULT('250622_jprr', 'ME-R'),
    expected: 'mass_start',
  },
  {
    name: 'jprr road title + 中間点フェーズ混入 → mass_start',
    title: JPRR_ROAD_TITLE,
    rows: ttLiveRows,
    href: RESULT('250622_jprr', 'ME-R'),
    expected: 'mass_start',
  },
  // --- exclusion clause: TT wording overrides the road wording ---
  {
    name: 'ロード・レース＋タイムトライアル併記 → 内容判定 individual_tt',
    title: ROAD_AND_TT_TITLE,
    rows: ttRows,
    href: RESULT('250622_jitt', 'ME-T'),
    expected: 'individual_tt',
  },
  // --- non-regression anchors (existing classifications) ---
  {
    name: '全日本 個人TT → individual_tt',
    title: JITT_TITLE,
    rows: ttRows,
    href: RESULT('250629_jitt', 'ME-T'),
    expected: 'individual_tt',
  },
  {
    name: '全日本 チームTT → team_tt',
    title: JPTTT_TITLE,
    rows: jptttRows,
    href: RESULT('260607_jptt', 'MTTT'),
    expected: 'team_tt',
  },
  {
    name: 'TOJ 大鹿 チームTT (ctg=004) → team_tt',
    title: TEAM_TT_TITLE,
    rows: teamTTMidRows,
    href: RESULT('2026_toj', '004'),
    expected: 'team_tt',
  },
  {
    name: 'TOJ ロードステージ (ロード・レース表記なし) → mass_start',
    title: ROAD_TITLE,
    rows: roadRows,
    href: RESULT('2026_toj', '005'),
    expected: 'mass_start',
  },
  {
    name: 'TOJ 個人TTステージ → individual_tt',
    title: TT_TITLE,
    rows: ttRows,
    href: RESULT('2026_toj', '002'),
    expected: 'individual_tt',
  },
  {
    name: 'TOJ クリテリウム → mass_start',
    title: CRIT_TITLE,
    rows: critRows,
    href: RESULT('2026_toj', '003'),
    expected: 'mass_start',
  },
  {
    name: '空タイトル・空ページ → individual_tt (既定)',
    title: '',
    rows: [],
    href: RESULT('2026_toj', ''),
    expected: 'individual_tt',
  },
]

describe('detectRaceShape truth table (ロード・レース title rule)', () => {
  afterEach(() => clearPage())
  it.each(TABLE)('$name', ({ title, rows, href, expected }) => {
    mountPage(title, rows)
    expect(detectRaceShape(document, href)).toBe(expected)
  })
})
