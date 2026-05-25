import type { LapClipData, RiderResult, RiderStatus } from './types'
import { parseTimeToMs } from './utils/parseTime'

// Finisher: intermediate (lap-1 cumulative) + finish (2-lap cumulative).
function fin(
  bib: string,
  teamCode: string,
  name: string,
  inter: string,
  finish: string,
): RiderResult {
  return {
    rank: null,
    bib,
    teamCode,
    name,
    status: 'FINISH',
    intermediateText: inter,
    intermediateMs: parseTimeToMs(inter),
    finishText: finish,
    finishMs: parseTimeToMs(finish),
    gapText: null,
    gapMs: null,
  }
}

// On course: passed the intermediate, no finish yet.
function onCourse(
  bib: string,
  teamCode: string,
  name: string,
  inter: string,
): RiderResult {
  return {
    rank: null,
    bib,
    teamCode,
    name,
    status: 'RUNNING',
    intermediateText: inter,
    intermediateMs: parseTimeToMs(inter),
    finishText: null,
    finishMs: null,
    gapText: null,
    gapMs: null,
  }
}

function pending(
  bib: string,
  teamCode: string,
  name: string,
  status: RiderStatus = 'WAIT',
): RiderResult {
  return {
    rank: null,
    bib,
    teamCode,
    name,
    status,
    intermediateText: null,
    intermediateMs: null,
    finishText: null,
    finishMs: null,
    gapText: null,
    gapMs: null,
  }
}

const riders: RiderResult[] = [
  fin('15', 'TFT', 'ドゥシャン・ラヨビッチ', '0:01:28.40', '0:02:58.91'),
  fin('22', 'TUK', 'トンマーゾ・ダーティ', '0:01:27.90', '0:02:59.65'),
  fin('73', 'CBW', 'リアム・ウォルシュ', '0:01:29.10', '0:03:00.51'),
  fin('71', 'CBW', 'キャメロン・スコット', '0:01:29.80', '0:03:01.02'),
  fin('91', 'BLZ', '岡 篤志', '0:01:30.20', '0:03:01.79'),
  fin('5', 'JCL', 'アンドレア・ダマト', '0:01:31.00', '0:03:03.19'),
  fin('31', 'MAT', '山本 哲央', '0:01:31.50', '0:03:03.90'),
  fin('44', 'KIN', 'ニコロ・ガリッボ', '0:01:32.20', '0:03:05.31'),
  fin('8', 'TFT', '中根 英登', '0:01:33.00', '0:03:06.76'),
  fin('132', 'RKB', '小林 海', '0:01:34.10', '0:03:08.31'),
  fin('27', 'AVC', '橋本 英也', '0:01:35.00', '0:03:10.11'),
  fin('60', 'SBC', '草場 啓吾', '0:01:36.20', '0:03:12.57'),
  onCourse('103', 'BLZ', '今村 駿介', '0:01:30.80'),
  onCourse('11', 'JCL', 'マルコ・カノラ', '0:01:29.40'),
  onCourse('88', 'KIN', '石上 優大', '0:01:33.60'),
  pending('46', 'AVC', '武山 晃輔'),
  pending('120', 'RKB', '横塚 浩平'),
  pending('7', 'SBC', 'レイモンド・クレダー', 'DNS'),
]

export const mockData: LapClipData = {
  eventName: 'Tour of Japan 2026',
  categoryName: 'チャリ・ロト 堺ステージ',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=001',
  fetchedAt: new Date().toISOString(),
  riders,
  isMock: true,
}

// A later snapshot: two on-course riders finish (カノラ slots into P2), one
// waiting rider starts. Exercises the finish/split/flash/diff paths offline.
export function mockDataNext(): LapClipData {
  const next = riders.map((r) => ({ ...r }))
  const r103 = next.find((r) => r.bib === '103')
  if (r103) {
    r103.status = 'FINISH'
    r103.finishText = '0:03:02.40'
    r103.finishMs = parseTimeToMs('0:03:02.40')
  }
  const r11 = next.find((r) => r.bib === '11')
  if (r11) {
    r11.status = 'FINISH'
    r11.finishText = '0:02:59.20'
    r11.finishMs = parseTimeToMs('0:02:59.20')
  }
  const r46 = next.find((r) => r.bib === '46')
  if (r46) {
    r46.status = 'RUNNING'
    r46.intermediateText = '0:01:34.50'
    r46.intermediateMs = parseTimeToMs('0:01:34.50')
  }
  return {
    ...mockData,
    fetchedAt: new Date().toISOString(),
    riders: next,
    isMock: true,
  }
}
