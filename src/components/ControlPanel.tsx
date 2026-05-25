import type { ReactNode } from 'react'
import type { DisplayMode, Settings, SortMode } from '../types'
import { teamColor } from '../utils/teamColor'

type Props = {
  sourceUrl: string
  onUrlChange: (url: string) => void
  onLoadUrl: () => void
  onLoadDemo: () => void
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  query: string
  onQueryChange: (q: string) => void
  teams: string[]
  teamFilter: Set<string>
  onToggleTeamFilter: (code: string) => void
  favoriteTeams: Set<string>
  onToggleFavoriteTeam: (code: string) => void
  showFavoritesOnly: boolean
  onToggleFavoritesOnly: () => void
  favoritesCount: number
  compact?: boolean
  loadLabel?: string
  note?: string
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </div>
  )
}

export function ControlPanel(props: Props) {
  const { settings, onSettingsChange } = props

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex flex-col gap-3">
        {/* URL row */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              LapClip result URL
            </span>
            <input
              type="url"
              value={props.sourceUrl}
              onChange={(e) => props.onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') props.onLoadUrl()
              }}
              spellCheck={false}
              placeholder="https://matrix-sports.jp/lap/result.php?evt=...&ctg=..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-600"
            />
          </div>
          <button
            onClick={props.onLoadUrl}
            className="rounded-md border border-sky-700 bg-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/60"
          >
            {props.loadLabel ?? 'Load live'}
          </button>
          <button
            onClick={props.onLoadDemo}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Load demo
          </button>
        </div>

        {props.note && (
          <p className="text-[11px] text-amber-300/80">{props.note}</p>
        )}

        {!props.compact && (
          <>
        {/* Controls row */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Show">
            <Segmented<DisplayMode>
              value={settings.displayMode}
              onChange={(v) => onSettingsChange({ displayMode: v })}
              options={[
                { value: 'top10', label: 'Top 10' },
                { value: 'top20', label: 'Top 20' },
                { value: 'all', label: 'All' },
              ]}
            />
          </Field>

          <Field label="Sort">
            <Segmented<SortMode>
              value={settings.sortMode}
              onChange={(v) => onSettingsChange({ sortMode: v })}
              options={[
                { value: 'rank', label: 'Rank' },
                { value: 'bib', label: 'Bib' },
                { value: 'team', label: 'Team' },
                { value: 'latest', label: 'Latest' },
              ]}
            />
          </Field>

          <Field label="Search">
            <input
              type="search"
              value={props.query}
              onChange={(e) => props.onQueryChange(e.target.value)}
              placeholder="name / No / team"
              className="w-44 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-sky-600"
            />
          </Field>

          <Field label="Filter">
            <button
              onClick={props.onToggleFavoritesOnly}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                props.showFavoritesOnly
                  ? 'border-yellow-600 bg-yellow-950/40 text-yellow-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              ★ Favorites only ({props.favoritesCount})
            </button>
          </Field>
        </div>

        {/* Team chips */}
        {props.teams.length > 0 && (
          <Field label="Teams (click to filter · ★ to favorite)">
            <div className="flex flex-wrap gap-1.5">
              {props.teams.map((code) => {
                const active = props.teamFilter.has(code)
                const fav = props.favoriteTeams.has(code)
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center overflow-hidden rounded-md border ${
                      active ? 'ring-1 ring-sky-500' : ''
                    }`}
                    style={{ borderColor: teamColor(code).borderColor }}
                  >
                    <button
                      onClick={() => props.onToggleTeamFilter(code)}
                      className="px-1.5 py-0.5 text-[11px] font-bold"
                      style={teamColor(code)}
                    >
                      {code}
                    </button>
                    <button
                      onClick={() => props.onToggleFavoriteTeam(code)}
                      title={fav ? 'Unfavorite team' : 'Favorite team'}
                      className={`px-1 py-0.5 text-[11px] ${
                        fav ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {fav ? '★' : '☆'}
                    </button>
                  </span>
                )
              })}
              {props.teamFilter.size > 0 && (
                <button
                  onClick={() =>
                    props.teamFilter.forEach((c) => props.onToggleTeamFilter(c))
                  }
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800"
                >
                  Clear filter
                </button>
              )}
            </div>
          </Field>
        )}
          </>
        )}
      </div>
    </section>
  )
}
