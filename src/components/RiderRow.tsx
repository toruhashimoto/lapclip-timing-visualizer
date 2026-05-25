import { useEffect, useState } from 'react'
import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { classifyGap } from '../utils/classifyGap'
import { formatGapMs, formatTimeMs } from '../utils/formatTime'
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

function StatusBadge({ status }: { status: RiderResult['status'] }) {
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
          中間
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

export function RiderRow({
  rider,
  rowGrid,
  scaleMs,
  isFavorite,
  onToggleFavorite,
  nonce,
}: Props) {
  const key = riderKey(rider)
  const finished = rider.finishMs != null
  const band = classifyGap(rider.gapMs)
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
  const dim = finished
    ? ''
    : rider.status === 'RUNNING'
      ? 'text-zinc-300'
      : 'text-zinc-500'

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
        <span className={finished ? 'text-zinc-100' : 'text-zinc-300'}>
          {rider.name}
        </span>
        {rider.isNew && (
          <span className="ml-1.5 rounded bg-zinc-700 px-1 text-[9px] font-bold text-zinc-200">
            NEW
          </span>
        )}
      </div>

      {/* 中間点 (lap-1 intermediate) */}
      <div className="text-right font-mono tabular-nums">
        {rider.intermediateMs != null ? (
          <span className={finished ? 'text-zinc-500' : 'text-sky-300'}>
            {formatTimeMs(rider.intermediateMs)}
          </span>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </div>

      {/* フィニッシュ (2-lap finish) */}
      <div className="text-right font-mono tabular-nums">
        {rider.finishMs != null ? (
          <span className={isLeader ? 'text-amber-200' : 'text-zinc-100'}>
            {formatTimeMs(rider.finishMs)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>

      {/* Gap (to leader finish) */}
      <div className="text-right leading-tight">
        {finished ? (
          <>
            <div className={`font-mono font-semibold tabular-nums ${band.textClass}`}>
              {formatGapMs(rider.gapMs)}
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
        <GapBar gapMs={rider.gapMs} scaleMs={scaleMs} />
      </div>

      <div className="text-center">
        <StatusBadge status={rider.status} />
      </div>
    </div>
  )
}
