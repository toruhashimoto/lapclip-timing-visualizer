import { useMemo, useRef, useState } from 'react'
import { detectEvents } from '../../analysis/events'
import type { LoadFn, LoadProgress } from '../../analysis/fetchLapHistory'
import { DEFAULT_THRESHOLD_MS, groupsByLap } from '../../analysis/groups'
import type { Group, LapHistory } from '../../analysis/types'
import { riderKey } from '../../types'
import { GroupTimeline } from './GroupTimeline'
import { LapTimeChart } from './LapTimeChart'
import { PositionChart } from './PositionChart'
import { SplitEventList } from './SplitEventList'

type Props = {
  load: LoadFn
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  enabled: boolean
  disabledReason?: string
}

type Status = 'idle' | 'loading' | 'done' | 'aborted' | 'error'
const MAX_COLORED = 5

// Analysis tab: loads the per-lap history only on demand, keeps it in memory,
// and recomputes groups/events locally when the threshold changes.
export function AnalysisView({ load, favorites, onToggleFavorite, enabled, disabledReason }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [history, setHistory] = useState<LapHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [thresholdMs, setThresholdMs] = useState(DEFAULT_THRESHOLD_MS)
  const [persistentOnly, setPersistentOnly] = useState(false)
  const [highlightLap, setHighlightLap] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  const start = () => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setStatus('loading')
    setError(null)
    setProgress(null)
    load(setProgress, ac.signal)
      .then((h) => {
        if (ac.signal.aborted) return
        setHistory(h)
        setStatus('done')
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) setStatus('aborted')
        else {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      })
  }
  const stop = () => abort.current?.abort()

  const byLap = useMemo(
    () => (history ? groupsByLap(history, thresholdMs) : new Map<number, Group[]>()),
    [history, thresholdMs],
  )
  const events = useMemo(() => (history ? detectEvents(history, byLap) : []), [history, byLap])
  const selected = useMemo(
    () => (history ? history.riders.filter((r) => favorites.has(riderKey(r))).map((r) => r.bib).slice(0, MAX_COLORED) : []),
    [history, favorites],
  )
  const toggleRider = (bib: string) => {
    const r = history?.riders.find((x) => x.bib === bib)
    if (r) onToggleFavorite(riderKey(r))
  }

  if (!enabled)
    return (
      <p className="px-3 py-12 text-center text-sm text-zinc-500">
        {disabledReason ?? '分析は周回レース（3周以上のマススタート）で利用できます。'}
      </p>
    )

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs">
        {status === 'loading' ? (
          <button onClick={stop} className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200">
            中止
          </button>
        ) : (
          <button onClick={start} className="rounded-md bg-violet-700 px-3 py-1.5 font-semibold text-white hover:bg-violet-600">
            {history ? '再読み込み' : '分析を読み込む'} ▶
          </button>
        )}
        {status === 'loading' && (
          <span className="flex items-center gap-2 text-zinc-400">
            {progress?.phase === 'laps' ? (
              <>
                <span className="inline-block h-1.5 w-32 overflow-hidden rounded bg-zinc-800">
                  <span className="block h-full bg-violet-500" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
                </span>
                ラップ取得 {progress.done}/{progress.total}
              </>
            ) : (
              '選手リスト取得中…'
            )}
          </span>
        )}
        {status === 'aborted' && <span className="text-zinc-500">中止しました</span>}
        {status === 'error' && <span className="text-red-400">取得に失敗しました：{error}</span>}
        {history && history.failedBibs.length > 0 && (
          <span className="text-amber-400">取得失敗 {history.failedBibs.length}名</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-zinc-400">
          しきい値
          <input
            type="range" min={1000} max={10000} step={500} value={thresholdMs}
            onChange={(e) => setThresholdMs(Number(e.target.value))}
          />
          <span className="w-10 font-mono text-zinc-200">{(thresholdMs / 1000).toFixed(1)}秒</span>
        </label>
        <span className="w-full text-[10px] text-zinc-500">
          閲覧中の LapClip と同じサイトの公開ページ（各選手のラップ一覧）をこのブラウザ内で順番に読み取ります（250ms間隔）。保存・送信はしません。
        </span>
      </section>

      {history ? (
        <>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <h2 className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              集団タイムライン <span className="normal-case text-zinc-500">（縦＝先頭との差・帯の太さ＝人数・◆分断 ●合流 ×除外）</span>
            </h2>
            <div className="p-2">
              <GroupTimeline history={history} byLap={byLap} events={events} selected={selected} highlightLap={highlightLap} />
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SplitEventList
              history={history} events={events} selected={selected}
              persistentOnly={persistentOnly} onTogglePersistent={() => setPersistentOnly((v) => !v)}
              onSelectLap={(lap) => setHighlightLap((cur) => (cur === lap ? null : lap))}
              onToggleRider={toggleRider} highlightLap={highlightLap}
            />
            <div className="flex flex-col gap-3">
              <PositionChart history={history} selected={selected} />
              <LapTimeChart history={history} selected={selected} />
            </div>
          </div>
        </>
      ) : (
        status !== 'loading' && (
          <p className="px-3 py-10 text-center text-sm text-zinc-500">
          「分析を読み込む」を押すと、全選手の周回データを読み込んで集団の分断を可視化します。
          </p>
        )
      )}
    </div>
  )
}
