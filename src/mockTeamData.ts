import type { TeamData, TeamResult, RiderStatus } from './types'
import { parseTimeToMs } from './utils/parseTime'

const LAPS = 3 // 大鹿: 3.8km × 3

// Team built from cumulative-at-each-lap strings (null = lap not reached yet).
function team(
  teamCode: string,
  teamName: string,
  status: RiderStatus,
  lapsCum: (string | null)[],
): TeamResult {
  const lapsCumMs = lapsCum.map((s) => (s ? parseTimeToMs(s) : null))
  const finishMs =
    status === 'FINISH' ? (lapsCumMs[lapsCumMs.length - 1] ?? null) : null
  const finishText = status === 'FINISH' ? (lapsCum[lapsCum.length - 1] ?? null) : null
  return {
    rank: null,
    teamCode,
    teamName,
    status,
    lapsCumMs,
    finishMs,
    finishText,
    gapText: null,
    gapMs: null,
  }
}

const teams: TeamResult[] = [
  team('UKY', 'JCL TEAM UKYO', 'FINISH', ['0:04:18.20', '0:08:42.50', '0:13:05.80']),
  team('BRL', 'TEAM BRIDGELANE', 'FINISH', ['0:04:20.10', '0:08:45.00', '0:13:10.40']),
  team('VIC', 'VICTOIRE広島', 'FINISH', ['0:04:17.80', '0:08:46.20', '0:13:14.90']),
  team('SHI', 'シマノレーシング', 'FINISH', ['0:04:22.00', '0:08:50.00', '0:13:20.10']),
  team('KIN', 'キナンレーシング', 'FINISH', ['0:04:25.50', '0:08:55.30', '0:13:28.70']),
  team('AIS', '愛三工業レーシング', 'FINISH', ['0:04:28.00', '0:09:01.00', '0:13:40.20']),
  team('MAT', 'マトリックスパワータグ', 'FINISH', ['0:04:30.10', '0:09:05.50', '0:13:52.00']),
  team('SPK', 'スパークルおおいた', 'RUNNING', ['0:04:24.00', '0:08:58.00', null]),
  team('BLZ', '宇都宮ブリッツェン', 'RUNNING', ['0:04:33.00', null, null]),
  team('AVC', 'AVCアイクラフト', 'WAIT', [null, null, null]),
]

export const mockTeamData: TeamData = {
  eventName: 'Tour of Japan 2026',
  categoryName: 'Astemo 大鹿ステージ (チームTT)',
  sourceUrl: 'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=004',
  fetchedAt: new Date().toISOString(),
  laps: LAPS,
  teams,
  isMock: true,
}

// Later snapshot: SPK finishes (slots mid-pack), BLZ reaches lap 2.
export function mockTeamDataNext(): TeamData {
  const next = teams.map((t) => ({ ...t, lapsCumMs: [...t.lapsCumMs] }))
  const spk = next.find((t) => t.teamCode === 'SPK')
  if (spk) {
    spk.status = 'FINISH'
    spk.lapsCumMs[2] = parseTimeToMs('0:13:33.40')
    spk.finishMs = spk.lapsCumMs[2]
    spk.finishText = '0:13:33.40'
  }
  const blz = next.find((t) => t.teamCode === 'BLZ')
  if (blz) blz.lapsCumMs[1] = parseTimeToMs('0:09:12.00')
  return {
    ...mockTeamData,
    fetchedAt: new Date().toISOString(),
    teams: next,
    isMock: true,
  }
}
