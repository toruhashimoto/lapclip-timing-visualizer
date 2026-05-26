// SYNTHETIC LapClip result.php fixtures for tests.
//
// These reproduce the real DOM *structure* and *string formats* observed on the
// source (phase labels, time precision, "+Top : ..." gaps) but use entirely
// FABRICATED riders, teams and times. No real LapClip result data is stored or
// committed here — that would violate the project's no-redistribution rule.

export type FixtureRow = {
  rank: string
  bib: string
  team?: string
  name: string
  phase: string
  time: string
  gap: string // value only; the "+Top : " prefix is added to mirror the source
}

// Build one <a class="result"> row exactly like result.php emits it.
export function resultRow(r: FixtureRow): string {
  const team = r.team ? `[${r.team}]` : ''
  return [
    `<a href="#" class="result" name="${r.bib}">`,
    '<div class="row"><div class="left">',
    `<span class="nwb">${r.rank}</span>`,
    `<span class="nwb">No.${r.bib}</span>`,
    `<span class="nwb">${team}${r.name}</span></div>`,
    '<div class="left">',
    `<span class="nw">${r.phase}</span>`,
    `<span class="nw">${r.time}</span>`,
    `<span class="nw">+Top : ${r.gap}</span></div></div><div class="arw"></div></a>`,
  ].join('')
}

// Mount a fixture into the jsdom document so parseEntries(document) can read it.
export function mountPage(title: string, rows: FixtureRow[]): void {
  document.title = title
  document.body.innerHTML = `<div class="content">${rows
    .map(resultRow)
    .join('\n')}</div>`
}

export function clearPage(): void {
  document.title = ''
  document.body.innerHTML = ''
}

// --- Individual time trial (堺ステージ shape): 1/100s times, FINISH phase. ---
export const TT_TITLE =
  'Tour of Japan 2026 - チャリ・ロト 堺ステージのリザルト | LAP CLIP'
export const ttRows: FixtureRow[] = [
  { rank: '1位', bib: '1', team: 'AAA', name: 'Rider Alpha', phase: 'FINISH', time: '0:02:57.94', gap: '0:00.00' },
  { rank: '2位', bib: '2', team: 'AAA', name: 'Rider Bravo', phase: 'FINISH', time: '0:02:59.12', gap: '+0:01.18' },
  { rank: '3位', bib: '3', team: 'BBB', name: 'Rider Charlie', phase: 'FINISH', time: '0:03:05.50', gap: '+0:07.56' },
]

// TT mid-race: one finisher + one rider still on course at the 中間点.
export const ttLiveRows: FixtureRow[] = [
  { rank: '1位', bib: '1', team: 'AAA', name: 'Rider Alpha', phase: 'FINISH', time: '0:02:57.94', gap: '0:00.00' },
  { rank: '-', bib: '5', team: 'BBB', name: 'Rider Echo', phase: '中間点', time: '0:01:30.00', gap: '-:--' },
]

// --- Criterium (堺国際クリテリウム shape): whole-second, "N周" phase, no FINISH. ---
export const CRIT_TITLE =
  'Tour of Japan 2026 - 堺国際クリテリウムのリザルト | LAP CLIP'
export const critRows: FixtureRow[] = [
  { rank: '1位', bib: '16', team: 'TFT', name: 'Rider Uno', phase: '10周', time: '0:33:47', gap: '0:00' },
  { rank: '2位', bib: '121', team: 'SWT', name: 'Rider Dos', phase: '10周', time: '0:33:47', gap: '0:00' },
  { rank: '3位', bib: '5', team: 'AAA', name: 'Rider Tres', phase: '10周', time: '0:35:42', gap: '+1:55' },
  { rank: '94位', bib: '151', team: 'BBB', name: 'Rider Tail', phase: '4周', time: '0:14:48', gap: '-6周' },
]

// --- Pre-start / not-yet-timed (いなべステージ shape): rank "-", phase "0周",
// placeholder time, every gap a default "0:00". ---
export const PRESTART_TITLE =
  'Tour of Japan 2026 - いなべステージのリザルト | LAP CLIP'
export const preStartRows: FixtureRow[] = [
  { rank: '-', bib: '1', team: 'TUK', name: 'Rider Alpha', phase: '0周', time: '-:--:--', gap: '0:00' },
  { rank: '-', bib: '2', team: 'TUK', name: 'Rider Bravo', phase: '0周', time: '-:--:--', gap: '0:00' },
  { rank: '-', bib: '3', team: 'AAA', name: 'Rider Charlie', phase: '0周', time: '-:--:--', gap: '0:00' },
]

// --- 8-lap circuit road (いなべステージ real shapes, observed 2026-05-26). ---
// Mid-race: everyone on "0/8周" (total laps known), a 2-rider break + 5-rider
// peloton ~30s back. Final: a FINISH bunch (same time), a chaser, a gruppetto
// ~12 min down, plus abandons shown as "X/8周" / "X/8周 SP1" a lap or more down.
export const ROAD8_TITLE =
  'Tour of Japan 2026 - いなべステージのリザルト | LAP CLIP'
export const road8LiveRows: FixtureRow[] = [
  { rank: '1位', bib: '121', team: 'SWT', name: 'Break A', phase: '0/8周', time: '0:11:02', gap: '0:00' },
  { rank: '2位', bib: '22', team: 'TUK', name: 'Break B', phase: '0/8周', time: '0:11:05', gap: '+0:03' },
  { rank: '3位', bib: '2', team: 'JCL', name: 'Peloton A', phase: '0/8周', time: '0:11:32', gap: '+0:30' },
  { rank: '4位', bib: '42', team: 'AAA', name: 'Peloton B', phase: '0/8周', time: '0:11:33', gap: '+0:31' },
  { rank: '5位', bib: '14', team: 'BBB', name: 'Peloton C', phase: '0/8周', time: '0:11:34', gap: '+0:32' },
  { rank: '6位', bib: '8', team: 'TFT', name: 'Peloton D', phase: '0/8周', time: '0:11:35', gap: '+0:33' },
  { rank: '7位', bib: '91', team: 'BLZ', name: 'Peloton E', phase: '0/8周', time: '0:11:36', gap: '+0:34' },
]
export const road8FinalRows: FixtureRow[] = [
  { rank: '1位', bib: '3', team: 'TUK', name: 'Winner', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
  { rank: '2位', bib: '71', team: 'VCF', name: 'Second', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
  { rank: '3位', bib: '53', team: 'JCL', name: 'Third', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
  { rank: '4位', bib: '15', team: 'TFT', name: 'Fourth', phase: 'FINISH', time: '2:39:42', gap: '+0:36' },
  { rank: '5位', bib: '60', team: 'SBC', name: 'Gruppetto A', phase: 'FINISH', time: '2:51:00', gap: '+11:54' },
  { rank: '6位', bib: '27', team: 'AVC', name: 'Gruppetto B', phase: 'FINISH', time: '2:51:02', gap: '+11:56' },
  { rank: '85位', bib: '24', team: 'KIN', name: 'Abandon A', phase: '6/8周 SP1', time: '2:02:31', gap: '-2周' },
  { rank: '86位', bib: '122', team: 'BLZ', name: 'Abandon B', phase: '5/8周', time: '1:35:21', gap: '-3周' },
]

// --- Road (京都ステージ shape): whole-second, FINISH + "X/Y周 SPn" phases. ---
export const ROAD_TITLE =
  'Tour of Japan 2026 - JPF 京都ステージのリザルト | LAP CLIP'
export const roadRows: FixtureRow[] = [
  { rank: '1位', bib: '1', team: 'TUK', name: 'Rider Uno', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
  { rank: '2位', bib: '71', team: 'VCF', name: 'Rider Dos', phase: 'FINISH', time: '2:39:06', gap: '0:00' },
  { rank: '88位', bib: '3', team: 'CCC', name: 'Rider Mid', phase: 'FINISH', time: '2:42:00', gap: '+2:54' },
  { rank: '90位', bib: '95', team: 'DDD', name: 'Rider Drop', phase: '4/6周 SP2', time: '2:02:31', gap: '-2周' },
  { rank: '93位', bib: '154', team: 'EEE', name: 'Rider Out', phase: '3/6周', time: '1:35:21', gap: '-3周' },
]
