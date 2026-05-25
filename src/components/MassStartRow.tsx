import { useEffect, useState } from 'react'
import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { classifyMassStartGap } from '../utils/classifyGap'
import { formatDurationWhole, formatGapWhole } from '../utils/formatTime'
import { teamColor } from '../utils/teamColor'
import { GapBar } from './GapBar'

type Props = {
  rider: RiderResult
  rowGrid: string
  scaleMs: number
  isFavorite: boolean
  onToggleFavorite: (key: string) => void
  nonce: string
}

// Lap progress label: "10周" (criterium), "4/6" (road abandon), "FIN" (road
// finisher), with the last sprint / KOM point as a small badge.
function Progress({ rider }: { rider: RiderResult }) {
  const { lapsDone, lapsTotal, lastCheckpoint, isFinisher } = rider
  let main: string
  if (lapsDone != null && lapsTotal != null) main = `${lapsDone}/${lapsTotal}`
  else if (lapsDone != null) main = `${lapsDone}周`
  else if (isFinisher) main = 'FIN'
  else main = '—'
  const sprint = lastCheckpoint && lastCheckpoint !== 'FINISH' ? lastCheckpoint : null
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono tabular-nums text-zinc-300">{main}</span>
      {sprint && (
        <span className="rounded bg-fuchsia-950 px-1 text-[9px] font-bold text-fuchsia-300">
          {sprint}
        </span>
      )}
    </span>
  )
}

function MassStatusBadge({ rider }: { rider: RiderResult }) {
  const s = rider.status
  if (s === 'DNS' || s === 'DNF' || s === 'DNQ' || s === 'DSQ')
    return (
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
        {s}
      </span>
    )
  if (rider.lapsDown != null && rider.lapsDown > 0)
    return (
      <span className="rounded bg-orange-950 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
        -{rider.lapsDown}周
      </span>
    )
  if (rider.isFinisher)
    return (
      <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
        FINISH
      </span>
    )
  if (s === 'WAIT')
    return (
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
        出走前
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded bg-sky-950 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
      <span className="lc-pulse h-1.5 w-1.5 rounded-full bg-sky-400" />
      RACING
    </span>
  )
}

function RankDelta({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) return <span className="text-zinc-600">–</span>
  if (delta > 0)
    return <span className="text-[11px] font-bold text-emerald-400">▲{delta}</span>
  return (
    <span className="text-[11px] font-bold text-red-400">▼{Math.abs(delta)}</span>
  )
}

export function MassStartRow({
  rider,
  rowGrid,
  scaleMs,
  isFavorite,
  onToggleFavorite,
  nonce,
}: Props) {
  const key = riderKey(rider)
  const lapped = rider.lapsDown != null && rider.lapsDown > 0
  const pending = rider.status === 'WAIT'
  const band = classifyMassStartGap(rider.gapMs, rider.lapsDown)
  const tc = teamColor(rider.teamCode)

  const [flashing, setFlashing] = useState(false)
  useEffect(() => {
    if (!rider.isUpdated) return
    setFlashing(true)
    const t = window.setTimeout(() => setFlashing(false), 1800)
    return () => window.clearTimeout(t)
  }, [nonce, rider.isUpdated])

  const isLeader = rider.rank === 1
  const isPodium = rider.rank != null && rider.rank <= 3
  const isTop10 = rider.rank != null && rider.rank <= 10

  const rowTone = isLeader
    ? 'bg-gradient-to-r from-purple-900/40 via-purple-900/10 to-transparent'
    : isTop10
      ? 'bg-zinc-900/40'
      : ''
  const leftAccent = isLeader
    ? 'border-l-2 border-l-amber-400'
    : rider.rank === 2
      ? 'border-l-2 border-l-zinc-300'
      : rider.rank === 3
        ? 'border-l-2 border-l-amber-700'
        : isFavorite
          ? 'border-l-2 border-l-sky-400'
          : 'border-l-2 border-l-transparent'
  const dim = lapped || pending ? 'text-zinc-500' : ''

  return (
    <div
      className={`${rowGrid} border-b border-zinc-800/60 px-1.5 py-1.5 ${rowTone} ${leftAccent} ${dim} ${flashing ? 'lc-flash' : ''} hover:bg-zinc-800/30`}
    >
      <button
        onClick={() => onToggleFavorite(key)}
        title={isFavorite ? 'Unpin rider' : 'Pin rider'}
        className={`text-base leading-none ${isFavorite ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'}`}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      <div
        className={`text-center font-mono font-bold tabular-nums ${
          isLeader ? 'text-amber-300' : isPodium ? 'text-zinc-100' : 'text-zinc-300'
        }`}
      >
        {rider.rank ?? '–'}
      </div>

      <div className="text-center tabular-nums">
        <RankDelta delta={rider.rankDelta} />
      </div>

      <div className="font-mono tabular-nums text-zinc-400">{rider.bib}</div>

      <div>
        <span
          className="inline-block rounded border px-1 py-0.5 text-[10px] font-bold"
          style={tc}
        >
          {rider.teamCode ?? '—'}
        </span>
      </div>

      <div className="min-w-0 truncate" title={rider.name}>
        <span className={lapped ? 'text-zinc-400' : 'text-zinc-100'}>
          {rider.name}
        </span>
        {rider.isNew && (
          <span className="ml-1.5 rounded bg-zinc-700 px-1 text-[9px] font-bold text-zinc-200">
            NEW
          </span>
        )}
      </div>

      {/* Lap progress + sprint/KOM point */}
      <div className="text-right">
        <Progress rider={rider} />
      </div>

      {/* Elapsed time at the current checkpoint */}
      <div className="text-right font-mono tabular-nums">
        {rider.elapsedMs != null ? (
          <span className={isLeader ? 'text-amber-200' : 'text-zinc-100'}>
            {formatDurationWhole(rider.elapsedMs)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>

      {/* Gap: a time for lead-lap riders, "-N周" for lapped riders */}
      <div className="text-right leading-tight">
        {lapped ? (
          <span className="font-mono font-semibold tabular-nums text-orange-300">
            -{rider.lapsDown}周
          </span>
        ) : rider.gapMs != null ? (
          <span className={`font-mono font-semibold tabular-nums ${band.textClass}`}>
            {rider.gapMs <= 0 ? '+0:00' : formatGapWhole(rider.gapMs)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>

      <div className="px-1">
        {lapped ? (
          <div className="h-2 w-full rounded-full bg-orange-950/60" aria-hidden="true" />
        ) : (
          <GapBar gapMs={rider.gapMs} scaleMs={scaleMs} band={band} />
        )}
      </div>

      <div className="text-center">
        <MassStatusBadge rider={rider} />
      </div>
    </div>
  )
}
