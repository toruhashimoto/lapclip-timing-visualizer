import type { CacheStatus, Mode, Settings } from '../types'
import { formatClock } from '../utils/formatTime'

type Props = {
  eventName: string
  categoryName: string
  fetchedAt: string | null
  loading: boolean
  usingMock: boolean
  settings: Settings
  mode: Mode
  onModeChange: (m: Mode) => void
  onToggleAuto: () => void
  onChangeInterval: (sec: number) => void
  onRefresh: () => void
  sourceUrl: string
  sharedMode?: boolean
  lockMode?: boolean
  modeOptions?: Mode[]
  cacheStatus?: CacheStatus | null
}

const INTERVALS = [15, 30, 60, 120]

function ModeToggle({
  mode,
  onChange,
  options,
}: {
  mode: Mode
  onChange: (m: Mode) => void
  options?: Mode[]
}) {
  const all: { value: Mode; label: string }[] = [
    { value: 'individual', label: '個人' },
    { value: 'team', label: 'チーム' },
  ]
  const opts = options ? all.filter((o) => options.includes(o.value)) : all
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === o.value
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Header({
  eventName,
  categoryName,
  fetchedAt,
  loading,
  usingMock,
  settings,
  mode,
  onModeChange,
  onToggleAuto,
  onChangeInterval,
  onRefresh,
  sourceUrl,
  sharedMode,
  lockMode,
  modeOptions,
  cacheStatus,
}: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">
              LapClip Timing Visualizer
            </h1>
            {sharedMode && (
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                Private viewing
              </span>
            )}
            {usingMock && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Demo data
              </span>
            )}
            {loading && (
              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Updating…
              </span>
            )}
          </div>
          <div className="truncate text-xs text-zinc-400">
            <span className="text-zinc-200">{eventName || 'Tour of Japan'}</span>
            {categoryName ? (
              <span className="text-zinc-500"> / {categoryName}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!lockMode && (
            <ModeToggle mode={mode} onChange={onModeChange} options={modeOptions} />
          )}

          <span className="font-mono text-zinc-400">
            Last update{' '}
            <span className="tabular-nums text-zinc-200">
              {formatClock(fetchedAt)}
            </span>
          </span>

          {cacheStatus && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                cacheStatus === 'fresh'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {cacheStatus === 'fresh' ? 'Live' : 'Stale'}
            </span>
          )}

          <button
            onClick={onToggleAuto}
            className={`rounded-md border px-2 py-1 font-medium ${
              settings.autoRefresh
                ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400'
            }`}
          >
            Auto {settings.autoRefresh ? 'ON' : 'OFF'}
          </button>

          <select
            value={settings.refreshIntervalSec}
            onChange={(e) => onChangeInterval(Number(e.target.value))}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
            aria-label="Refresh interval"
          >
            {INTERVALS.map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-md border border-sky-700 bg-sky-950/60 px-2.5 py-1 font-medium text-sky-200 hover:bg-sky-900/60 disabled:opacity-50"
          >
            Refresh
          </button>

          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Open source ↗
          </a>
        </div>
      </div>
    </header>
  )
}
