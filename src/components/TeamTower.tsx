import type { TeamResult } from '../types'
import { GAP_BAND_ORDER, getBand } from '../utils/classifyGap'
import { perLapBest } from '../utils/normalizeTeams'
import { TeamRow } from './TeamRow'

// Column widths: star | P | Δ | Team | Lap1..LapN | Finish | Gap | Bar | Status
// All lap columns show per-lap split times; "Finish" is always the total time.
// Key = laps + 1 (N lap-split cols + 1 finish col). Tailwind JIT needs full strings.
const ROW_GRIDS: Record<number, string> = {
  2: 'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_minmax(8rem,1fr)_4.25rem_5rem_4.25rem_minmax(3.5rem,8rem)_4rem]',
  3: 'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_minmax(8rem,1fr)_4.25rem_4.25rem_5rem_4.25rem_minmax(3.5rem,8rem)_4rem]',
  4: 'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_minmax(8rem,1fr)_4.25rem_4.25rem_4.25rem_5rem_4.25rem_minmax(3.5rem,8rem)_4rem]',
  5: 'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_minmax(8rem,1fr)_4.25rem_4.25rem_4.25rem_4.25rem_5rem_4.25rem_minmax(3.5rem,8rem)_4rem]',
}
function rowGrid(laps: number): string {
  return ROW_GRIDS[laps + 1] ?? ROW_GRIDS[4]
}

type Props = {
  teams: TeamResult[]
  laps: number
  scaleMs: number
  favorites: Set<string>
  onToggleFavorite: (code: string) => void
  nonce: string
}

function Legend() {
  return (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 md:flex">
      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="h-2 w-2 rounded-full bg-purple-500" />
        周回別ベスト
      </span>
      {GAP_BAND_ORDER.filter((k) => k !== 'best' && k !== 'none').map((k) => {
        const b = getBand(k)
        return (
          <span key={k} className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${b.dotClass}`} />
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

export function TeamTower({
  teams,
  laps,
  scaleMs,
  favorites,
  onToggleFavorite,
  nonce,
}: Props) {
  const lapBest = perLapBest(teams, laps)

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Team timing tower
        </h2>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div
            className={`${rowGrid(laps)} border-b border-zinc-700 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500`}
          >
            <div />
            <div className="text-center">P</div>
            <div className="text-center">Δ</div>
            <div>Team</div>
            {Array.from({ length: laps }, (_, i) => (
              <div key={i} className="text-right">
                Lap {i + 1}
              </div>
            ))}
            <div className="text-right">Finish</div>
            <div className="text-right">Gap</div>
            <div className="px-1">Visual gap</div>
            <div className="text-center">Status</div>
          </div>

          {teams.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-zinc-600">
              No teams to show.
            </p>
          ) : (
            teams.map((t) => (
              <TeamRow
                key={t.teamCode}
                team={t}
                rowGrid={rowGrid(laps)}
                laps={laps}
                lapBest={lapBest}
                scaleMs={scaleMs}
                isFavorite={favorites.has(t.teamCode)}
                onToggleFavorite={onToggleFavorite}
                nonce={nonce}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
