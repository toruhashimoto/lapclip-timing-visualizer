import type { ReactNode } from 'react'
import type { TeamResult } from '../types'
import { formatGapMs, formatTimeMs } from '../utils/formatTime'
import { lapSplits } from '../utils/normalizeTeams'
import { teamColor } from '../utils/teamColor'

type Props = {
  teams: TeamResult[]
  laps: number
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

function TeamTag({ code }: { code: string }) {
  return (
    <span
      className="inline-block rounded border px-1 py-0.5 text-[10px] font-bold"
      style={teamColor(code)}
    >
      {code}
    </span>
  )
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export function TeamHighlightPanel({ teams, laps }: Props) {
  const finishers = teams
    .filter((t) => t.finishMs != null && t.rank != null)
    .sort((a, b) => a.rank! - b.rank!)
  const leader = finishers[0] ?? null

  // Fastest team for each lap (smallest split).
  const fastest: ({ team: TeamResult; split: number } | null)[] = Array.from(
    { length: laps },
    () => null,
  )
  for (const t of teams) {
    const sp = lapSplits(t)
    for (let i = 0; i < laps; i++) {
      const s = sp[i]
      if (s != null && (fastest[i] == null || s < fastest[i]!.split)) {
        fastest[i] = { team: t, split: s }
      }
    }
  }

  let battle: { a: TeamResult; b: TeamResult; diff: number } | null = null
  for (let i = 1; i < finishers.length; i++) {
    const diff = finishers[i].finishMs! - finishers[i - 1].finishMs!
    if (!battle || diff < battle.diff) {
      battle = { a: finishers[i - 1], b: finishers[i], diff }
    }
  }

  const onCourse = teams.filter((t) => t.status === 'RUNNING').length
  const spread =
    finishers.length >= 2
      ? finishers[finishers.length - 1].finishMs! - finishers[0].finishMs!
      : null
  const med = median(finishers.map((t) => t.finishMs!))

  return (
    <div className="flex flex-col gap-3">
      <Card title="Leading team">
        {leader ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-amber-300">P1</span>
            <TeamTag code={leader.teamCode} />
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">
              {leader.teamName}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-amber-200">
              {formatTimeMs(leader.finishMs)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No finishers yet.</p>
        )}
      </Card>

      <Card title="Fastest lap (周回別ベスト)">
        <ul className="flex flex-col gap-1">
          {fastest.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-12 text-xs font-semibold text-purple-300">
                Lap {i + 1}
              </span>
              {f ? (
                <>
                  <TeamTag code={f.team.teamCode} />
                  <span className="min-w-0 flex-1 truncate text-zinc-200">
                    {f.team.teamName}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-purple-300">
                    {formatTimeMs(f.split)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Closest battle">
        {battle ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zinc-300">
              P{battle.a.rank} <span className="text-zinc-500">vs</span> P
              {battle.b.rank}
            </span>
            <span className="truncate text-xs text-zinc-500">
              {battle.a.teamCode} / {battle.b.teamCode}
            </span>
            <span className="font-mono font-bold tabular-nums text-emerald-300">
              {formatGapMs(battle.diff)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Need two finishers.</p>
        )}
      </Card>

      <Card title="Field summary">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-zinc-500">Teams finished</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {finishers.length}
          </dd>
          <dt className="text-zinc-500">On course</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {onCourse}
          </dd>
          <dt className="text-zinc-500">Spread</dt>
          <dd className="text-right font-mono tabular-nums text-zinc-100">
            {spread != null ? formatGapMs(spread) : '—'}
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
