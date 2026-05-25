import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { LapClipData, Mode, Settings, TeamData } from '../types'
import { normalizeRiders } from '../utils/normalizeRiders'
import { normalizeTeams } from '../utils/normalizeTeams'
import { diffData } from '../utils/diff'
import { diffTeams } from '../utils/diffTeams'
import { Header } from '../components/Header'
import { TimingTower } from '../components/TimingTower'
import { TeamTower } from '../components/TeamTower'
import { parseIndividual, parseTeam, detectMode } from './parseDom'

type ModeSetting = Mode | 'auto'

const LS = {
  mode: 'lapclip_us_mode_v1',
  favorites: 'lapclip_us_favorites_v1',
  favoriteTeams: 'lapclip_us_favorite_teams_v1',
  autoReload: 'lapclip_us_autoreload_v1',
  interval: 'lapclip_us_interval_v1',
}

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

// Normalize (rank + gap) then diff against the previous snapshot for flash flags.
function ingestIndividual(
  raw: LapClipData,
  prev: LapClipData | null,
): LapClipData {
  const normalized: LapClipData = { ...raw, riders: normalizeRiders(raw.riders) }
  const { riders } = diffData(normalized, prev)
  return { ...normalized, riders }
}
function ingestTeam(raw: TeamData, prev: TeamData | null): TeamData {
  const normalized: TeamData = { ...raw, teams: normalizeTeams(raw.teams) }
  const { teams } = diffTeams(normalized, prev)
  return { ...normalized, teams }
}

// The F1-style overlay. All data comes from the live page DOM (parseDom); there
// is NO network access here. `onHide` reveals the original LapClip page.
export function Overlay({ onHide }: { onHide: () => void }) {
  const [modeSetting, setModeSetting] = useState<ModeSetting>(() =>
    loadLS<ModeSetting>(LS.mode, 'auto'),
  )
  const resolvedMode: Mode = modeSetting === 'auto' ? detectMode() : modeSetting
  const teamMode = resolvedMode === 'team'

  const [data, setData] = useState<LapClipData | null>(null)
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const dataRef = useRef<LapClipData | null>(null)
  const teamRef = useRef<TeamData | null>(null)
  const [parsedOnce, setParsedOnce] = useState(false)

  const [favorites, setFavorites] = useState<string[]>(() =>
    loadLS<string[]>(LS.favorites, []),
  )
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() =>
    loadLS<string[]>(LS.favoriteTeams, []),
  )
  const [autoReload, setAutoReload] = useState<boolean>(() =>
    loadLS<boolean>(LS.autoReload, false),
  )
  const [intervalSec, setIntervalSec] = useState<number>(() =>
    loadLS<number>(LS.interval, 60),
  )

  useEffect(() => saveLS(LS.mode, modeSetting), [modeSetting])
  useEffect(() => saveLS(LS.favorites, favorites), [favorites])
  useEffect(() => saveLS(LS.favoriteTeams, favoriteTeams), [favoriteTeams])
  useEffect(() => saveLS(LS.autoReload, autoReload), [autoReload])
  useEffect(() => saveLS(LS.interval, intervalSec), [intervalSec])

  const reparse = useCallback(() => {
    try {
      const ind = ingestIndividual(parseIndividual(), dataRef.current)
      dataRef.current = ind
      setData(ind)
      const tm = ingestTeam(parseTeam(), teamRef.current)
      teamRef.current = tm
      setTeamData(tm)
    } catch (e) {
      // Never break the original page if parsing fails.
      console.warn('[LapClip Visualizer] parse failed; original page intact', e)
    } finally {
      setParsedOnce(true)
    }
  }, [])

  // Initial parse + re-parse when the official page updates its results in place.
  useEffect(() => {
    reparse()
    const target = document.querySelector('.content') ?? document.body
    let timer: number | undefined
    const obs = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reparse, 400)
    })
    obs.observe(target, { childList: true, subtree: true, characterData: true })
    return () => {
      obs.disconnect()
      window.clearTimeout(timer)
    }
  }, [reparse])

  // Optional auto-reload of the OFFICIAL page (off by default, min 30s). Reloading
  // re-runs the userscript, which re-parses — we never fetch data ourselves.
  useEffect(() => {
    if (!autoReload) return
    const sec = Math.max(30, intervalSec)
    const id = window.setTimeout(() => location.reload(), sec * 1000)
    return () => window.clearTimeout(id)
  }, [autoReload, intervalSec])

  const favoritesSet = useMemo(() => new Set(favorites), [favorites])
  const favoriteTeamsSet = useMemo(() => new Set(favoriteTeams), [favoriteTeams])

  const scaleMs = useMemo(() => {
    let max = 0
    for (const r of data?.riders ?? [])
      if (r.gapMs != null && r.gapMs > max) max = r.gapMs
    return Math.min(30000, Math.max(1000, max))
  }, [data])
  const scaleMsTeam = useMemo(() => {
    let max = 0
    for (const t of teamData?.teams ?? [])
      if (t.gapMs != null && t.gapMs > max) max = t.gapMs
    return Math.min(60000, Math.max(1000, max))
  }, [teamData])

  const toggle = (setter: Dispatch<SetStateAction<string[]>>, value: string) =>
    setter((arr) =>
      arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
    )

  const settings: Settings = {
    autoRefresh: autoReload,
    refreshIntervalSec: intervalSec,
    displayMode: 'all',
    sortMode: 'rank',
    mode: resolvedMode,
  }

  const active = teamMode ? teamData : data
  const eventName = active?.eventName ?? 'Tour of Japan'
  const categoryName = active?.categoryName ?? ''
  const fetchedAt = active?.fetchedAt ?? null
  const nonce = active?.fetchedAt ?? ''
  const noData = teamMode
    ? (teamData?.teams.length ?? 0) === 0
    : (data?.riders.length ?? 0) === 0

  return (
    <div className="pointer-events-auto fixed inset-0 flex flex-col overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between gap-3 bg-amber-950/40 px-3 py-1.5 text-[11px] leading-snug text-amber-200/90">
        <span>
          非公式の表示補助ツールです。公式結果は LapClip の表示を確認してください。
        </span>
        <button
          onClick={onHide}
          className="shrink-0 rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
        >
          元のLapClip表示に戻す
        </button>
      </div>

      <Header
        eventName={eventName}
        categoryName={categoryName}
        fetchedAt={fetchedAt}
        loading={false}
        usingMock={false}
        settings={settings}
        mode={resolvedMode}
        onModeChange={(m) => setModeSetting(m)}
        onToggleAuto={() => setAutoReload((v) => !v)}
        onChangeInterval={(s) => setIntervalSec(Math.max(30, s))}
        onRefresh={reparse}
        sourceUrl={location.href}
        sharedMode={false}
        lockMode={false}
        cacheStatus={null}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-3">
        {noData && parsedOnce ? (
          <p className="px-3 py-12 text-center text-sm text-zinc-500">
            この公式ページから読み取れる結果がまだありません。レースが始まり公式ページが更新されると、自動で表示されます。
          </p>
        ) : teamMode ? (
          <TeamTower
            teams={teamData?.teams ?? []}
            laps={teamData?.laps ?? 3}
            scaleMs={scaleMsTeam}
            favorites={favoriteTeamsSet}
            onToggleFavorite={(c) => toggle(setFavoriteTeams, c)}
            nonce={nonce}
          />
        ) : (
          <TimingTower
            riders={data?.riders ?? []}
            scaleMs={scaleMs}
            favorites={favoritesSet}
            onToggleFavorite={(k) => toggle(setFavorites, k)}
            nonce={nonce}
          />
        )}
      </main>
    </div>
  )
}
