import { useMemo } from 'react'
import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { formatGapWhole } from '../utils/formatTime'
import type { RaceGroup, RaceGroupKind } from '../utils/groupRiders'
import {
  clusterGroups,
  lappedRiders,
  passedCheckpoints,
} from '../utils/groupRiders'

type Props = {
  riders: RiderResult[]
  lapsTotal: number | null
  lapsLeader: number | null
  favorites: Set<string>
}

const KIND_STYLE: Record<RaceGroupKind, { dot: string; text: string }> = {
  break: { dot: 'bg-amber-400', text: 'text-amber-300' },
  peloton: { dot: 'bg-sky-400', text: 'text-sky-300' },
  chase: { dot: 'bg-zinc-300', text: 'text-zinc-200' },
  behind: { dot: 'bg-zinc-600', text: 'text-zinc-400' },
}

function GroupRow({
  group,
  favorites,
}: {
  group: RaceGroup
  favorites: Set<string>
}) {
  const s = KIND_STYLE[group.kind]
  const favs = group.riders.filter((r) => favorites.has(riderKey(r)))
  return (
    <div className="flex items-start gap-2 border-b border-zinc-800/60 px-3 py-2 last:border-b-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-semibold ${s.text}`}>
            {group.label}
            <span className="ml-1 text-xs font-normal text-zinc-500">
              {group.size}名
            </span>
          </span>
          <span className="font-mono text-xs tabular-nums text-zinc-300">
            {group.frontGapMs <= 0 ? 'LEAD' : formatGapWhole(group.frontGapMs)}
          </span>
        </div>
        {favs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {favs.map((r) => (
              <span
                key={riderKey(r)}
                className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-200"
              >
                ★ {r.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function RaceSituation({
  riders,
  lapsTotal,
  lapsLeader,
  favorites,
}: Props) {
  const groups = useMemo(() => clusterGroups(riders), [riders])
  const lapped = useMemo(() => lappedRiders(riders), [riders])
  const checkpoints = useMemo(() => passedCheckpoints(riders), [riders])

  const remaining =
    lapsTotal != null && lapsLeader != null ? lapsTotal - lapsLeader : null
  const lapText =
    lapsLeader == null
      ? '—'
      : lapsTotal != null
        ? `${lapsLeader}/${lapsTotal}`
        : `${lapsLeader}`

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          レース状況
        </h2>
        <span className="rounded-md border border-orange-700/60 bg-orange-950/40 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-orange-200">
          {remaining != null && remaining > 0
            ? `残り ${remaining}周`
            : remaining === 0
              ? 'ゴール'
              : `LAP ${lapText}`}
        </span>
      </div>

      {checkpoints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/60 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            通過
          </span>
          {checkpoints.map((c) => (
            <span
              key={c}
              className="rounded bg-fuchsia-950 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-zinc-600">
          コース上のグループ情報がまだありません。
        </p>
      ) : (
        groups.map((g, i) => (
          <GroupRow key={`${g.kind}-${i}`} group={g} favorites={favorites} />
        ))
      )}

      {lapped.length > 0 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-xs">
          <span className="text-zinc-500">周回遅れ</span>
          <span className="font-mono tabular-nums text-orange-300">
            {lapped.length}名
          </span>
        </div>
      )}
    </section>
  )
}
