import { useEffect, useState } from 'react'
import type { TeamResult } from '../types'
import { classifyGap } from '../utils/classifyGap'
import { formatGapMs, formatTimeMs } from '../utils/formatTime'
import { lapSplits } from '../utils/normalizeTeams'
import { teamColor } from '../utils/teamColor'
import { GapBar } from './GapBar'

type Props = {
  team: TeamResult
  rowGrid: string
  laps: number
  lapBest: (number | null)[]
  scaleMs: number
  isFavorite: boolean
  onToggleFavorite: (code: string) => void
  nonce: string
}

function StatusBadge({ status }: { status: TeamResult['status'] }) {
  switch (status) {
    case 'FINISH':
      return (
        <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          FINISH
        </span>
      )
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-sky-950 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
          <span className="lc-pulse h-1.5 w-1.5 rounded-full bg-sky-400" />
          RUN
        </span>
      )
    case 'WAIT':
      return (
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
          WAIT
        </span>
      )
    default:
      return (
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
          {status}
        </span>
      )
  }
}

function RankDelta({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) return <span className="text-zinc-600">–</span>
  if (delta > 0)
    return <span className="text-[11px] font-bold text-emerald-400">▲{delta}</span>
  return (
    <span className="text-[11px] font-bold text-red-400">▼{Math.abs(delta)}</span>
  )
}

export function TeamRow({
  team,
  rowGrid,
  laps,
  lapBest,
  scaleMs,
  isFavorite,
  onToggleFavorite,
  nonce,
}: Props) {
  const key = team.teamCode
  const finished = team.finishMs != null
  const band = classifyGap(team.gapMs)
  const tc = teamColor(team.teamCode)
  const splits = lapSplits(team)

  const [flashing, setFlashing] = useState(false)
  useEffect(() => {
    if (!team.isUpdated) return
    setFlashing(true)
    const t = window.setTimeout(() => setFlashing(false), 1800)
    return () => window.clearTimeout(t)
  }, [nonce, team.isUpdated])

  const isLeader = team.rank === 1
  const isPodium = team.rank != null && team.rank <= 3
  const rowTone = isLeader
    ? 'bg-gradient-to-r from-purple-900/40 via-purple-900/10 to-transparent'
    : team.rank != null && team.rank <= 5
      ? 'bg-zinc-900/40'
      : ''
  const leftAccent = isLeader
    ? 'border-l-2 border-l-amber-400'
    : team.rank === 2
      ? 'border-l-2 border-l-zinc-300'
      : team.rank === 3
        ? 'border-l-2 border-l-amber-700'
        : isFavorite
          ? 'border-l-2 border-l-sky-400'
          : 'border-l-2 border-l-transparent'
  const dim = finished ? '' : team.status === 'RUNNING' ? 'text-zinc-300' : 'text-zinc-500'

  return (
    <div
      className={`${rowGrid} border-b border-zinc-800/60 px-1.5 py-1.5 ${rowTone} ${leftAccent} ${dim} ${flashing ? 'lc-flash' : ''} hover:bg-zinc-800/30`}
    >
      <button
        onClick={() => onToggleFavorite(key)}
        title={isFavorite ? 'Unpin team' : 'Pin team'}
        className={`text-base leading-none ${isFavorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'}`}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      <div
        className={`text-center font-mono font-bold tabular-nums ${
          isLeader ? 'text-amber-300' : isPodium ? 'text-zinc-100' : 'text-zinc-300'
        }`}
      >
        {team.rank ?? '–'}
      </div>

      <div className="text-center tabular-nums">
        <RankDelta delta={team.rankDelta} />
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="shrink-0 rounded border px-1 py-0.5 text-[10px] font-bold"
          style={tc}
        >
          {team.teamCode}
        </span>
        <span className={`truncate ${finished ? 'text-zinc-100' : 'text-zinc-300'}`} title={team.teamName}>
          {team.teamName}
        </span>
      </div>

      {/* Lap split durations; purple = fastest split for that lap */}
      {Array.from({ length: laps }, (_, i) => {
        const s = splits[i] ?? null
        const best = s != null && lapBest[i] != null && s === lapBest[i]
        return (
          <div
            key={i}
            className={`text-right font-mono tabular-nums ${
              best ? 'font-semibold text-purple-300' : 'text-zinc-400'
            }`}
          >
            {s != null ? formatTimeMs(s) : <span className="text-zinc-700">—</span>}
          </div>
        )
      })}

      {/* Finish (total) */}
      <div className="text-right font-mono tabular-nums">
        {team.finishMs != null ? (
          <span className={isLeader ? 'text-amber-200' : 'text-zinc-100'}>
            {formatTimeMs(team.finishMs)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>

      {/* Gap */}
      <div className="text-right leading-tight">
        {finished ? (
          <>
            <div className={`font-mono font-semibold tabular-nums ${band.textClass}`}>
              {formatGapMs(team.gapMs)}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-zinc-600">
              {band.label}
            </div>
          </>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>

      <div className="px-1">
        <GapBar gapMs={team.gapMs} scaleMs={scaleMs} />
      </div>

      <div className="text-center">
        <StatusBadge status={team.status} />
      </div>
    </div>
  )
}
