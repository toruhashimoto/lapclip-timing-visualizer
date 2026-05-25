import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type {
  AppConfig,
  CacheStatus,
  FeedEvent,
  LapClipData,
  Mode,
  RiderResult,
  Settings,
  SortMode,
  TeamData,
} from './types'
import { riderKey } from './types'
import { mockData, mockDataNext } from './mockData'
import { mockTeamData, mockTeamDataNext } from './mockTeamData'
import { diffData } from './utils/diff'
import { diffTeams } from './utils/diffTeams'
import { normalizeRiders } from './utils/normalizeRiders'
import { normalizeTeams } from './utils/normalizeTeams'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBanner } from './components/ErrorBanner'
import { Header } from './components/Header'
import { HighlightPanel } from './components/HighlightPanel'
import { TeamHighlightPanel } from './components/TeamHighlightPanel'
import { TeamTower } from './components/TeamTower'
import { TimingTower } from './components/TimingTower'
import { UpdateFeed } from './components/UpdateFeed'

const DEFAULT_URL =
  'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=001'
const DEFAULT_TEAM_URL =
  'https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=004'

const LS = {
  favorites: 'lapclip_favorites_v1',
  favoriteTeams: 'lapclip_favorite_teams_v1',
  url: 'lapclip_last_url_v1',
  settings: 'lapclip_settings_v1',
}

const DEFAULT_SETTINGS: Settings = {
  autoRefresh: true,
  refreshIntervalSec: 30,
  displayMode: 'top20',
  sortMode: 'rank',
  mode: 'individual',
}

// Hosted 大鹿 (team_tt) version restricts the header toggle to チーム only.
const TEAM_ONLY_MODES: Mode[] = ['team']

function loadLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function saveLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / disabled storage */
  }
}

// The source only shows one phase per rider at a time (中間点 OR FINISH), so a
// finisher's lap-1 intermediate disappears once they finish. Carry forward each
// rider's intermediate/finish times from the previous snapshot when the current
// fetch no longer reports them, so both columns can stay populated.
function mergeRetained(
  raw: LapClipData,
  prev: LapClipData | null,
): LapClipData {
  if (!prev) return raw
  const prevByKey = new Map(prev.riders.map((r) => [riderKey(r), r]))
  return {
    ...raw,
    riders: raw.riders.map((r) => {
      const p = prevByKey.get(riderKey(r))
      if (!p) return r
      const intermediateMs = r.intermediateMs ?? p.intermediateMs
      const finishMs = r.finishMs ?? p.finishMs
      return {
        ...r,
        intermediateMs,
        intermediateText: r.intermediateText ?? p.intermediateText,
        finishMs,
        finishText: r.finishText ?? p.finishText,
        status: finishMs != null ? 'FINISH' : r.status,
      }
    }),
  }
}

// Retain across fetches, normalize (rank by finish), then diff for change flags.
function ingest(raw: LapClipData, prev: LapClipData | null) {
  const merged = mergeRetained(raw, prev)
  const normalized: LapClipData = {
    ...merged,
    riders: normalizeRiders(merged.riders),
  }
  const { riders, events } = diffData(normalized, prev)
  return { data: { ...normalized, riders }, events }
}

// Team-mode equivalent of ingest: normalize (rank by finish) then diff.
function ingestTeams(raw: TeamData, prev: TeamData | null) {
  const normalized: TeamData = { ...raw, teams: normalizeTeams(raw.teams) }
  const { teams, events } = diffTeams(normalized, prev)
  return { data: { ...normalized, teams }, events }
}

function bibNum(r: RiderResult): number {
  const n = parseInt(r.bib, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

function rankKey(r: RiderResult): number {
  return r.rank ?? Number.MAX_SAFE_INTEGER
}

function sortRiders(riders: RiderResult[], mode: SortMode): RiderResult[] {
  const out = [...riders]
  switch (mode) {
    case 'bib':
      out.sort((a, b) => bibNum(a) - bibNum(b))
      break
    case 'team':
      out.sort(
        (a, b) =>
          (a.teamCode ?? 'zzz').localeCompare(b.teamCode ?? 'zzz') ||
          rankKey(a) - rankKey(b),
      )
      break
    case 'latest':
      out.sort(
        (a, b) =>
          Number(!!b.isUpdated) - Number(!!a.isUpdated) ||
          rankKey(a) - rankKey(b),
      )
      break
    case 'rank':
    default:
      // Stable sort: finishers ascend by rank; unranked riders keep the
      // canonical order from normalizeRiders (on-course before waiting).
      out.sort((a, b) => rankKey(a) - rankKey(b))
  }
  return out
}

export default function App() {
  const [sourceUrl, setSourceUrl] = useState(() =>
    loadLS<string>(LS.url, DEFAULT_URL),
  )
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadLS<Partial<Settings>>(LS.settings, {}),
  }))
  const [data, setData] = useState<LapClipData>(() => ingest(mockData, null).data)
  const [previousData, setPreviousData] = useState<LapClipData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(true)
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [latestFinishKey, setLatestFinishKey] = useState<string | null>(null)
  const [teamData, setTeamData] = useState<TeamData>(
    () => ingestTeams(mockTeamData, null).data,
  )
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)

  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadLS<string[]>(LS.favorites, []),
  )
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() =>
    loadLS<string[]>(LS.favoriteTeams, []),
  )

  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  const teamDataRef = useRef(teamData)
  useEffect(() => {
    teamDataRef.current = teamData
  }, [teamData])

  const mode = settings.mode

  // Persist user state.
  useEffect(() => saveLS(LS.settings, settings), [settings])
  useEffect(() => saveLS(LS.favorites, favorites), [favorites])
  useEffect(() => saveLS(LS.favoriteTeams, favoriteTeams), [favoriteTeams])

  const applyEvents = useCallback((events: FeedEvent[]) => {
    if (events.length === 0) return
    setFeed((f) => [...events, ...f].slice(0, 60))
    const fe =
      events.find((e) => e.kind === 'finish') ??
      events.find((e) => e.kind === 'leader')
    if (fe) setLatestFinishKey(fe.riderKey)
  }, [])

  const fetchLive = useCallback(
    async (url: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/lapclip?url=${encodeURIComponent(url)}`)
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const j = (await res.json()) as { error?: string }
            if (j?.error) msg = j.error
          } catch {
            /* non-JSON error body */
          }
          throw new Error(msg)
        }
        const raw = (await res.json()) as LapClipData
        // The first live load after demo data is a fresh baseline, not a diff
        // (otherwise every rider reads as "new" and floods the feed).
        const wasMock = dataRef.current?.isMock ?? false
        const prev = wasMock ? null : dataRef.current
        const { data: next, events } = ingest(raw, prev)
        setPreviousData(prev)
        setData(next)
        if (wasMock) {
          setFeed([])
          setLatestFinishKey(null)
        } else {
          applyEvents(events)
        }
        setError(null)
        setUsingMock(false)
        saveLS(LS.url, url)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [applyEvents],
  )

  // The Refresh button advances the demo when on mock data (so the flash /
  // feed behaviour is visible offline), otherwise re-fetches the live source.
  const handleRefresh = useCallback(() => {
    if (mode === 'team') {
      const prev = teamDataRef.current
      const { data: next, events } = ingestTeams(mockTeamDataNext(), prev)
      setTeamData(next)
      applyEvents(events)
      return
    }
    if (usingMock) {
      const prev = dataRef.current
      const { data: next, events } = ingest(mockDataNext(), prev)
      setPreviousData(prev)
      setData(next)
      applyEvents(events)
    } else {
      fetchLive(sourceUrl)
    }
  }, [mode, usingMock, sourceUrl, fetchLive, applyEvents])

  const handleLoadDemo = useCallback(() => {
    if (mode === 'team') {
      setTeamData(ingestTeams(mockTeamData, null).data)
      setFeed([])
      setLatestFinishKey(null)
      setError(null)
      return
    }
    setPreviousData(null)
    setData(ingest(mockData, null).data)
    setUsingMock(true)
    setError(null)
    setFeed([])
    setLatestFinishKey(null)
  }, [mode])

  const handleModeChange = useCallback((m: Mode) => {
    setSettings((s) => ({ ...s, mode: m }))
    setFeed([])
    setLatestFinishKey(null)
    setError(null)
  }, [])

  // Auto-refresh: only against a live source, never the demo.
  useEffect(() => {
    if (mode === 'team' || !settings.autoRefresh || usingMock || !sourceUrl)
      return
    const ms = Math.max(15, settings.refreshIntervalSec) * 1000
    const id = window.setInterval(() => fetchLive(sourceUrl), ms)
    return () => window.clearInterval(id)
  }, [
    mode,
    settings.autoRefresh,
    settings.refreshIntervalSec,
    usingMock,
    sourceUrl,
    fetchLive,
  ])

  // Load server runtime config once. In shared mode it fixes the source URL,
  // forces the timing mode + refresh cadence, and triggers the first fetch.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/config')
        if (!res.ok) return
        const cfg = (await res.json()) as AppConfig
        if (cancelled) return
        setAppConfig(cfg)
        if (cfg.appMode === 'shared') {
          const src = cfg.sourceUrl ?? sourceUrl
          setSourceUrl(src)
          setSettings((s) => ({
            ...s,
            mode: cfg.timingMode === 'team_tt' ? 'team' : 'individual',
            autoRefresh: true,
            refreshIntervalSec: Math.max(
              cfg.minRefreshSec,
              cfg.refreshIntervalSec,
            ),
          }))
          if (cfg.timingMode !== 'team_tt') fetchLive(src)
        }
      } catch {
        /* config unavailable -> local defaults */
      }
    })()
    return () => {
      cancelled = true
    }
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const favoritesSet = useMemo(() => new Set(favorites), [favorites])
  const favoriteTeamsSet = useMemo(() => new Set(favoriteTeams), [favoriteTeams])
  const teamFilterSet = useMemo(() => new Set(teamFilter), [teamFilter])

  const teams = useMemo(() => {
    const s = new Set<string>()
    for (const r of data.riders) if (r.teamCode) s.add(r.teamCode)
    return [...s].sort()
  }, [data.riders])

  // Build the filtered + sorted view.
  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hasFilter =
      q !== '' || teamFilterSet.size > 0 || showFavoritesOnly

    let rows = data.riders
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.bib.toLowerCase().includes(q) ||
          (r.teamCode ?? '').toLowerCase().includes(q),
      )
    }
    if (teamFilterSet.size > 0) {
      rows = rows.filter((r) => r.teamCode && teamFilterSet.has(r.teamCode))
    }
    if (showFavoritesOnly) {
      rows = rows.filter(
        (r) =>
          favoritesSet.has(riderKey(r)) ||
          (r.teamCode != null && favoriteTeamsSet.has(r.teamCode)),
      )
    }

    // Cap to Top N (by canonical order) only when not actively filtering.
    if (!hasFilter && settings.displayMode !== 'all') {
      const n = settings.displayMode === 'top10' ? 10 : 20
      const allow = new Set(data.riders.slice(0, n).map((r) => riderKey(r)))
      rows = rows.filter((r) => allow.has(riderKey(r)))
    }

    return sortRiders(rows, settings.sortMode)
  }, [
    data.riders,
    query,
    teamFilterSet,
    showFavoritesOnly,
    favoritesSet,
    favoriteTeamsSet,
    settings.displayMode,
    settings.sortMode,
  ])

  // Scale gap bars to the largest visible gap, capped at 30s.
  const scaleMs = useMemo(() => {
    let max = 0
    for (const r of view) {
      if (r.gapMs != null && r.gapMs > max) max = r.gapMs
    }
    return Math.min(30000, Math.max(1000, max))
  }, [view])

  // Team gaps are typically larger; scale to the field, capped at 60s.
  const scaleMsTeam = useMemo(() => {
    let max = 0
    for (const t of teamData.teams)
      if (t.gapMs != null && t.gapMs > max) max = t.gapMs
    return Math.min(60000, Math.max(1000, max))
  }, [teamData.teams])

  const teamMode = mode === 'team'
  const sharedMode = appConfig?.appMode === 'shared'
  const teamOnlyToggle = sharedMode && appConfig?.timingMode === 'team_tt'
  const cacheStatus: CacheStatus | null =
    !teamMode && !usingMock ? (data.cacheStatus ?? null) : null

  const toggle = (
    setter: Dispatch<SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((arr) =>
      arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
    )

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <Header
        eventName={teamMode ? teamData.eventName : data.eventName}
        categoryName={teamMode ? teamData.categoryName : data.categoryName}
        fetchedAt={teamMode ? teamData.fetchedAt : data.fetchedAt}
        loading={loading}
        usingMock={teamMode ? !!teamData.isMock : usingMock}
        settings={settings}
        mode={mode}
        onModeChange={handleModeChange}
        onToggleAuto={() =>
          setSettings((s) => ({ ...s, autoRefresh: !s.autoRefresh }))
        }
        onChangeInterval={(sec) =>
          setSettings((s) => ({ ...s, refreshIntervalSec: Math.max(15, sec) }))
        }
        onRefresh={handleRefresh}
        sourceUrl={teamMode ? DEFAULT_TEAM_URL : sourceUrl}
        sharedMode={sharedMode}
        // Hosted 大鹿 version: show the mode toggle but restrict it to チーム
        // only (team_tt). Local/individual deployments still get both modes.
        lockMode={false}
        modeOptions={teamOnlyToggle ? TEAM_ONLY_MODES : undefined}
        cacheStatus={cacheStatus}
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 p-3 lg:p-4">
        {!sharedMode && (
          <ControlPanel
          sourceUrl={teamMode ? DEFAULT_TEAM_URL : sourceUrl}
          onUrlChange={teamMode ? () => {} : setSourceUrl}
          onLoadUrl={teamMode ? () => {} : () => fetchLive(sourceUrl)}
          onLoadDemo={handleLoadDemo}
          compact={teamMode}
          note={
            teamMode
              ? 'チームTTの実データ対応はレース当日に校正予定（現在はモック表示）。Refreshでデモ更新。'
              : undefined
          }
          settings={settings}
          onSettingsChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          query={query}
          onQueryChange={setQuery}
          teams={teams}
          teamFilter={teamFilterSet}
          onToggleTeamFilter={(c) => toggle(setTeamFilter, c)}
          favoriteTeams={favoriteTeamsSet}
          onToggleFavoriteTeam={(c) => toggle(setFavoriteTeams, c)}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
          favoritesCount={favorites.length}
          />
        )}

        {error && (
          <ErrorBanner
            error={error}
            lastFetchedAt={data?.fetchedAt ?? null}
            onRetry={() => fetchLive(sourceUrl)}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <main className="order-2 lg:order-1">
            {teamMode ? (
              <TeamTower
                teams={teamData.teams}
                laps={teamData.laps}
                scaleMs={scaleMsTeam}
                favorites={favoriteTeamsSet}
                onToggleFavorite={(c) => toggle(setFavoriteTeams, c)}
                nonce={teamData.fetchedAt}
              />
            ) : (
              <TimingTower
                riders={view}
                scaleMs={scaleMs}
                favorites={favoritesSet}
                onToggleFavorite={(k) => toggle(setFavorites, k)}
                nonce={data.fetchedAt}
                noData={!usingMock && data.riders.length === 0}
              />
            )}
          </main>
          <aside className="order-1 flex flex-col gap-3 lg:order-2">
            {teamMode ? (
              <TeamHighlightPanel teams={teamData.teams} laps={teamData.laps} />
            ) : (
              <HighlightPanel
                riders={data.riders}
                favorites={favoritesSet}
                favoriteTeams={favoriteTeamsSet}
                latestFinishKey={latestFinishKey}
              />
            )}
            <UpdateFeed events={feed} />
          </aside>
        </div>

        <footer className="border-t border-zinc-800 pt-3 text-center text-xs text-zinc-600">
          <p>
            Data source:{' '}
            <a
              href={teamMode ? DEFAULT_TEAM_URL : sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline hover:text-zinc-200"
            >
              LAP CLIP
            </a>{' '}
            (matrix-sports.jp). Unofficial personal second-screen tool — not
            affiliated with LapClip or the event organizer.
          </p>
          {previousData && (
            <p className="mt-1 text-zinc-700">
              Diffing against snapshot from{' '}
              {new Date(previousData.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}
