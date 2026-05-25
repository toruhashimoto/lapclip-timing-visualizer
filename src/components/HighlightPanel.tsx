import type { ReactNode } from 'react'
import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { formatGapMs, formatTimeMs } from '../utils/formatTime'
import { teamColor } from '../utils/teamColor'

type Props = {
  riders: RiderResult[]
  favorites: Set<string>
  favoriteTeams: Set<string>
  latestFinishKey: string | null
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  )
}

function TeamTag({ code }: { code: string | null }) {
  return (
    <span
      className="inline-block rounded border px-1 py-0.5 text-[10px] font-bold"
      style={teamColor(code)}
    >
      {code ?? '—'}
    </span>
  )
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export function HighlightPanel({
  riders,
  favorites,
  favoriteTeams,
  latestFinishKey,
}: Props) {
  const finishers = riders
    .filter((r) => r.finishMs != null && r.rank != null)
    .sort((a, b) => a.rank! - b.rank!)
  const leader = finishers[0] ?? null

  let battle: { a: RiderResult; b: RiderResult; diff: number } | null = null
  for (let i = 1; i < finishers.length; i++) {
    const diff = finishers[i].finishMs! - finishers[i - 1].finishMs!
    if (!battle || diff < battle.diff) {
      battle = { a: finishers[i - 1], b: finishers[i], diff }
    }
  }

  const latestFinish =
    (latestFinishKey && riders.find((r) => riderKey(r) === latestFinishKey)) ||
    null

  const favRiders = riders.filter(
    (r) =>
      favorites.has(riderKey(r)) ||
      (r.teamCode != null && favoriteTeams.has(r.teamCode)),
  )

  const onCourse = riders.filter((r) => r.status === 'RUNNING').length
  const top10 = finishers.slice(0, 10)
  const top10Range =
    top10.length >= 2 ? top10[top10.length - 1].finishMs! - top10[0].finishMs! : null
  const med = median(finishers.map((r) => r.finishMs!))

  return (
    <div className="flex flex-col gap-3">
      <Card title="Current leader">
        {leader ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-amber-300">P1</span>
            <TeamTag code={leader.teamCode} />
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">
              {leader.name}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-amber-200">
              {formatTimeMs(leader.finishMs)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No finishers yet.</p>
        )}
      </Card>

      <Card title="Latest finish">
        {latestFinish ? (
          <div className="lc-pulse flex items-center gap-2">
            <span className="font-mono font-bold text-emerald-300">
              P{latestFinish.rank ?? '?'}
            </span>
            <TeamTag code={latestFinish.teamCode} />
            <span className="min-w-0 flex-1 truncate text-zinc-100">
              {latestFinish.name}
            </span>
            <span className="font-mono tabular-nums text-emerald-200">
              {formatTimeMs(latestFinish.finishMs)}
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-400">
              {formatGapMs(latestFinish.gapMs)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Waiting for the next finish…</p>
        )}
      </Card>

      <Card title="Closest battle">
        {battle ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zinc-300">
              P{battle.a.rank} <span className="text-zinc-500">vs</span> P
              {battle.b.rank}
            </span>
            <span className="truncate text-xs text-zinc-500">
              {battle.a.name} / {battle.b.name}
            </span>
            <span className="font-mono font-bold tabular-nums text-emerald-300">
              {(battle.diff / 1000).toFixed(2)}s
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Need two finishers.</p>
        )}
      </Card>

      {favRiders.length > 0 && (
        <Card title={`Favorites (${favRiders.length})`}>
          <ul className="flex flex-col gap-1">
            {favRiders.map((r) => (
              <li key={riderKey(r)} className="flex items-center gap-2 text-sm">
                <span className="text-yellow-400">★</span>
                <span className="w-8 font-mono font-bold tabular-nums text-zinc-200">
                  {r.rank != null ? `P${r.rank}` : '–'}
                </span>
                <TeamTag code={r.teamCode} />
                <span className="min-w-0 flex-1 truncate text-zinc-200">
                  {r.name}
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-400">
                  {r.finishMs != null
                    ? formatGapMs(r.gapMs)
                    : r.intermediateMs != null
                      ? `中間 ${formatTimeMs(r.intermediateMs)}`
                      : r.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Field summary">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-zinc-500">Finished</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {finishers.length}
          </dd>
          <dt className="text-zinc-500">On course (中間点)</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {onCourse}
          </dd>
          <dt className="text-zinc-500">Top 10 spread</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {top10Range != null ? formatGapMs(top10Range) : '—'}
          </dd>
          <dt className="text-zinc-500">Median finish</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {med != null ? formatTimeMs(med) : '—'}
          </dd>
        </dl>
      </Card>
    </div>
  )
}
