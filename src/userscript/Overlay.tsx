import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { LapClipData, Mode, RaceShape, Settings, TeamData } from '../types'
import { normalizeRiders } from '../utils/normalizeRiders'
import { leaderLap, normalizeMassStart } from '../utils/normalizeMassStart'
import { normalizeTeams } from '../utils/normalizeTeams'
import { diffData } from '../utils/diff'
import { diffTeams } from '../utils/diffTeams'
import { Header } from '../components/Header'
import { TimingTower } from '../components/TimingTower'
import { MassStartTower } from '../components/MassStartTower'
import { RaceSituation } from '../components/RaceSituation'
import { TeamTower } from '../components/TeamTower'
import {
  detectRaceShape,
  parseIndividual,
  parseMassStart,
  parseTeam,
} from './parseDom'
import {
  enrichTeamsWithLaptimes,
  evtCtgFromUrl,
} from './fetchLaptimes'

type ModeSetting = Mode | 'auto'

// Resolve the race shape from the user's toggle + the page content.
//   'auto'       -> fully content-detected (incl. the ctg=004 team hint).
//   'individual' -> honour the choice but still auto-pick TT vs mass-start.
//   'team'       -> force the team-TT view.
function resolveShape(setting: ModeSetting): RaceShape {
  if (setting === 'team') return 'team_tt'
  if (setting === 'individual') return detectRaceShape(document, 'about:blank')
  return detectRaceShape()
}

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
// Mass-start equivalent: rank by official place, then diff for flash flags.
function ingestMass(raw: LapClipData, prev: LapClipData | null): LapClipData {
  const normalized: LapClipData = {
    ...raw,
    riders: normalizeMassStart(raw.riders),
  }
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
  // The detected race shape drives which tower renders. It is recomputed on each
  // reparse (the page content may change as a race starts / finishes).
  const [shape, setShape] = useState<RaceShape>(() =>
    resolveShape(loadLS<ModeSetting>(LS.mode, 'auto')),
  )
  const teamMode = shape === 'team_tt'
  const massStart = shape === 'mass_start'
  // The header toggle only offers 個人 / チーム; map the shape onto it.
  const toggleMode: Mode = teamMode ? 'team' : 'individual'

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
      const s = resolveShape(modeSetting)
      setShape(s)
      if (s === 'team_tt') {
        const tm = ingestTeam(parseTeam(), teamRef.current)
        teamRef.current = tm
        setTeamData(tm)
      } else if (s === 'mass_start') {
        const ms = ingestMass(parseMassStart(), dataRef.current)
        dataRef.current = ms
        setData(ms)
      } else {
        const ind = ingestIndividual(parseIndividual(), dataRef.current)
        dataRef.current = ind
        setData(ind)
      }
    } catch (e) {
      // Never break the original page if parsing fails.
      console.warn('[LapClip Visualizer] parse failed; original page intact', e)
    } finally {
      setParsedOnce(true)
    }
  }, [modeSetting])

  // Switching the toggle resets the diff baseline so the new view doesn't flash
  // every row as "changed".
  const handleModeChange = useCallback((m: Mode) => {
    dataRef.current = null
    teamRef.current = null
    setModeSetting(m)
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

  // After each team-TT parse, fetch per-lap splits from laptimes.php for
  // finished teams whose lapsCumMs is incomplete. Results are cached by bib
  // so each team is fetched at most once per session.
  const laptimesCache = useRef<Map<string, (number | null)[]>>(new Map())
  const laptimerAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!teamMode || !teamData) return
    const { evt, ctg } = evtCtgFromUrl()
    if (!evt || !ctg) return

    // Apply any already-cached laps immediately.
    const applyCache = (teams: typeof teamData.teams) =>
      teams.map((t) => {
        const cached = laptimesCache.current.get(t.teamCode)
        if (!cached) return t
        return {
          ...t,
          lapsCumMs: cached,
          finishMs: t.finishMs ?? cached[teamData.laps - 1],
        }
      })

    const withCache = applyCache(teamData.teams)
    const needFetch = withCache.filter(
      (t) => t.status === 'FINISH' && t.lapsCumMs.some((v) => v == null),
    )
    if (needFetch.length === 0) {
      // Cache was complete — just update display if cache added anything.
      if (withCache.some((t, i) => t !== teamData.teams[i])) {
        setTeamData((prev) =>
          prev ? { ...prev, teams: normalizeTeams(withCache) } : prev,
        )
      }
      return
    }

    laptimerAbort.current?.abort()
    const ac = new AbortController()
    laptimerAbort.current = ac

    enrichTeamsWithLaptimes(withCache, evt, ctg, teamData.laps, ac.signal)
      .then((enriched) => {
        if (ac.signal.aborted) return
        enriched.forEach((t) => {
          if (t.lapsCumMs.some((v) => v != null))
            laptimesCache.current.set(t.teamCode, t.lapsCumMs)
        })
        setTeamData((prev) =>
          prev ? { ...prev, teams: normalizeTeams(enriched) } : prev,
        )
      })
      .catch(() => {})
  // Re-run when new data arrives (fetchedAt changes each reparse).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamData?.fetchedAt, teamMode])

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
  // The leader's lap, for the mass-start lap counter in the header.
  const leaderLapsDone = useMemo(
    () => leaderLap(data?.riders ?? [], data?.lapsTotal ?? null),
    [data],
  )

  const toggle = (setter: Dispatch<SetStateAction<string[]>>, value: string) =>
    setter((arr) =>
      arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
    )

  const settings: Settings = {
    autoRefresh: autoReload,
    refreshIntervalSec: intervalSec,
    displayMode: 'all',
    sortMode: 'rank',
    mode: toggleMode,
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
        mode={toggleMode}
        raceShape={shape}
        lapsTotal={massStart ? (data?.lapsTotal ?? null) : null}
        lapsLeader={massStart ? leaderLapsDone : null}
        onModeChange={handleModeChange}
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
        ) : massStart ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <div className="order-2 lg:order-1">
              <MassStartTower
                riders={data?.riders ?? []}
                lapsTotal={data?.lapsTotal ?? null}
                favorites={favoritesSet}
                onToggleFavorite={(k) => toggle(setFavorites, k)}
                nonce={nonce}
              />
            </div>
            <div className="order-1 lg:order-2">
              <RaceSituation
                riders={data?.riders ?? []}
                lapsTotal={data?.lapsTotal ?? null}
                lapsLeader={leaderLapsDone}
                favorites={favoritesSet}
              />
            </div>
          </div>
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
