import type { LapClipData, RiderResult, RiderStatus } from './types'
import { parseTimeToMs } from './utils/parseTime'

// Synthetic mass-start demo data (criterium + road) for the SPA preview. Real
// formats, fabricated riders/times — no LapClip data is stored here.

type MS = {
  rank: number
  bib: string
  team: string
  name: string
  elapsed: string // whole-second cumulative time
  gap?: string // time gap value, e.g. "0:00" / "+1:55"
  lapsDone?: number | null
  lapsTotal?: number | null
  checkpoint?: string | null
  lapsDown?: number | null
  finisher?: boolean
  status?: RiderStatus
}

function ms(o: MS): RiderResult {
  const elapsedMs = parseTimeToMs(o.elapsed)
  const lapsDown = o.lapsDown ?? null
  const gapMs = lapsDown == null && o.gap != null ? parseTimeToMs(o.gap) : null
  const finisher = o.finisher ?? lapsDown == null
  return {
    rank: null,
    bib: o.bib,
    teamCode: o.team,
    name: o.name,
    status: o.status ?? (finisher ? 'FINISH' : 'RUNNING'),
    intermediateText: null,
    intermediateMs: null,
    finishText: finisher ? o.elapsed : null,
    finishMs: finisher ? elapsedMs : null,
    gapText: o.gap ?? (lapsDown != null ? `-${lapsDown}周` : null),
    gapMs,
    officialRank: o.rank,
    elapsedText: o.elapsed,
    elapsedMs,
    lapsDone: o.lapsDone ?? null,
    lapsTotal: o.lapsTotal ?? null,
    lastCheckpoint: o.checkpoint ?? null,
    lapsDown,
    isFinisher: finisher,
  }
}

// --- Criterium: 10-lap bunch finish, no per-lap total in the phase. ---
const critRiders: RiderResult[] = [
  ms({ rank: 1, bib: '16', team: 'TFT', name: 'リーダー・アルファ', elapsed: '0:33:47', gap: '0:00', lapsDone: 10 }),
  ms({ rank: 2, bib: '121', team: 'SWT', name: 'スプリンター・ブラボー', elapsed: '0:33:47', gap: '0:00', lapsDone: 10 }),
  ms({ rank: 3, bib: '5', team: 'JCL', name: 'チャーリー・デルタ', elapsed: '0:33:47', gap: '0:00', lapsDone: 10 }),
  ms({ rank: 4, bib: '31', team: 'MAT', name: 'エコー・フォックス', elapsed: '0:33:50', gap: '+0:03', lapsDone: 10 }),
  ms({ rank: 5, bib: '73', team: 'CBW', name: 'ゴルフ・ホテル', elapsed: '0:33:52', gap: '+0:05', lapsDone: 10 }),
  ms({ rank: 6, bib: '8', team: 'TFT', name: 'インディア・ジュリエット', elapsed: '0:34:20', gap: '+0:33', lapsDone: 10 }),
  ms({ rank: 7, bib: '91', team: 'BLZ', name: 'キロ・リマ', elapsed: '0:35:42', gap: '+1:55', lapsDone: 10 }),
  ms({ rank: 8, bib: '44', team: 'KIN', name: 'マイク・ノベンバー', elapsed: '0:35:54', gap: '+2:07', lapsDone: 10 }),
  ms({ rank: 30, bib: '88', team: 'KIN', name: 'ラップド・オスカー', elapsed: '0:32:10', lapsDone: 9, lapsDown: 1 }),
  ms({ rank: 31, bib: '81', team: 'BLZ', name: 'アウト・パパ', elapsed: '0:07:47', lapsDone: 2, lapsDown: 8, status: 'DNF' }),
]

export const mockCriteriumData: LapClipData = {
  eventName: 'Tour of Japan 2026',
  categoryName: '堺国際クリテリウム',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=201',
  fetchedAt: new Date().toISOString(),
  riders: critRiders,
  raceShape: 'mass_start',
  lapsTotal: null,
  isMock: true,
}

// --- Road race: 6 laps, FINISH for finishers, abandons show "X/6周 SPn". ---
const roadRiders: RiderResult[] = [
  ms({ rank: 1, bib: '1', team: 'TUK', name: 'リーダー・アルファ', elapsed: '2:39:06', gap: '0:00', finisher: true }),
  ms({ rank: 2, bib: '71', team: 'VCF', name: 'クライマー・ブラボー', elapsed: '2:39:06', gap: '0:00', finisher: true }),
  ms({ rank: 3, bib: '5', team: 'JCL', name: 'チャーリー・デルタ', elapsed: '2:39:06', gap: '0:00', finisher: true }),
  ms({ rank: 4, bib: '15', team: 'TFT', name: 'エコー・フォックス', elapsed: '2:39:18', gap: '+0:12', finisher: true }),
  ms({ rank: 10, bib: '60', team: 'SBC', name: 'ゴルフ・ホテル', elapsed: '2:42:00', gap: '+2:54', finisher: true }),
  ms({ rank: 20, bib: '27', team: 'AVC', name: 'インディア・ジュリエット', elapsed: '2:46:31', gap: '+7:25', finisher: true }),
  ms({ rank: 30, bib: '95', team: 'BLZ', name: 'ドロップ・キロ', elapsed: '2:02:31', lapsDone: 4, lapsTotal: 6, checkpoint: 'SP2', lapsDown: 2 }),
  ms({ rank: 31, bib: '154', team: 'KIN', name: 'アウト・リマ', elapsed: '1:35:21', lapsDone: 3, lapsTotal: 6, lapsDown: 3 }),
]

export const mockRoadData: LapClipData = {
  eventName: 'Tour of Japan 2026',
  categoryName: 'JPF 京都ステージ',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=002',
  fetchedAt: new Date().toISOString(),
  riders: roadRiders,
  raceShape: 'mass_start',
  lapsTotal: 6,
  isMock: true,
}

// --- Road race IN PROGRESS (lap 4 of 6): a 3-rider break, a chase, the
// peloton, and a dropped group a lap down. Demonstrates the live grouping. ---
const liveRiders: RiderResult[] = [
  ms({ rank: 1, bib: '15', team: 'TFT', name: '逃げ・アルファ', elapsed: '1:48:10', gap: '0:00', lapsDone: 4, lapsTotal: 6, checkpoint: 'SP1', finisher: false }),
  ms({ rank: 2, bib: '8', team: 'JCL', name: '逃げ・ブラボー', elapsed: '1:48:12', gap: '+0:02', lapsDone: 4, lapsTotal: 6, checkpoint: 'SP1', finisher: false }),
  ms({ rank: 3, bib: '44', team: 'KIN', name: '逃げ・チャーリー', elapsed: '1:48:15', gap: '+0:05', lapsDone: 4, lapsTotal: 6, checkpoint: 'SP1', finisher: false }),
  ms({ rank: 4, bib: '22', team: 'TUK', name: '追走・デルタ', elapsed: '1:48:52', gap: '+0:42', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 5, bib: '60', team: 'SBC', name: '追走・エコー', elapsed: '1:48:55', gap: '+0:45', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 6, bib: '1', team: 'TUK', name: '集団・フォックス', elapsed: '1:49:50', gap: '+1:40', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 7, bib: '73', team: 'CBW', name: '集団・ゴルフ', elapsed: '1:49:52', gap: '+1:42', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 8, bib: '91', team: 'BLZ', name: '集団・ホテル', elapsed: '1:49:53', gap: '+1:43', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 9, bib: '5', team: 'JCL', name: '集団・インディア', elapsed: '1:49:55', gap: '+1:45', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 10, bib: '31', team: 'MAT', name: '集団・ジュリエット', elapsed: '1:49:58', gap: '+1:48', lapsDone: 4, lapsTotal: 6, finisher: false }),
  ms({ rank: 30, bib: '120', team: 'AVC', name: '遅れ・キロ', elapsed: '1:33:20', lapsDone: 3, lapsTotal: 6, lapsDown: 1, finisher: false }),
  ms({ rank: 31, bib: '7', team: 'SBC', name: '遅れ・リマ', elapsed: '1:33:45', lapsDone: 3, lapsTotal: 6, lapsDown: 1, finisher: false }),
]

export const mockRoadLiveData: LapClipData = {
  eventName: 'Tour of Japan 2026',
  categoryName: 'いなべステージ',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=003',
  fetchedAt: new Date().toISOString(),
  riders: liveRiders,
  raceShape: 'mass_start',
  lapsTotal: 6,
  isMock: true,
}

// --- Pre-start start list (いなべ "0周" state): no times, no ranks yet. ---
const preStartRiders: RiderResult[] = [
  ms({ rank: 0, bib: '1', team: 'TUK', name: 'スターター・アルファ', elapsed: '-:--:--', lapsDone: 0, finisher: false, status: 'WAIT' }),
  ms({ rank: 0, bib: '2', team: 'TUK', name: 'スターター・ブラボー', elapsed: '-:--:--', lapsDone: 0, finisher: false, status: 'WAIT' }),
  ms({ rank: 0, bib: '11', team: 'JCL', name: 'スターター・チャーリー', elapsed: '-:--:--', lapsDone: 0, finisher: false, status: 'WAIT' }),
  ms({ rank: 0, bib: '44', team: 'KIN', name: 'スターター・デルタ', elapsed: '-:--:--', lapsDone: 0, finisher: false, status: 'WAIT' }),
].map((r) => ({ ...r, officialRank: null, rank: null, gapMs: null }))

export const mockPreStartData: LapClipData = {
  eventName: 'Tour of Japan 2026',
  categoryName: 'いなべステージ',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=003',
  fetchedAt: new Date().toISOString(),
  riders: preStartRiders,
  raceShape: 'mass_start',
  lapsTotal: null,
  isMock: true,
}

// A later snapshot: a late move reshuffles the podium (P2 jumps to P1) and a
// chaser claws back time. Exercises the rank-change flash / feed offline.
export function mockMassDataNext(base: LapClipData): LapClipData {
  const next = base.riders.map((r) => ({ ...r }))
  const top = next
    .filter((r) => r.officialRank != null)
    .sort((a, b) => (a.officialRank ?? 0) - (b.officialRank ?? 0))
  if (top.length >= 2) {
    const a = top[0]
    const b = top[1]
    a.officialRank = 2
    b.officialRank = 1
  }
  const chaser = next.find((r) => r.officialRank === 7)
  if (chaser && chaser.gapMs != null) {
    chaser.gapMs = Math.max(0, chaser.gapMs - 20000)
    chaser.gapText = '+1:35'
    chaser.elapsedText = '0:35:22'
    chaser.elapsedMs = parseTimeToMs('0:35:22')
  }
  return { ...base, fetchedAt: new Date().toISOString(), riders: next, isMock: true }
}
