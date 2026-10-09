import type { LapHistory, RaceEvent } from '../../analysis/types'
import { RIDER_COLORS } from './svgAxis'

type Props = {
  history: LapHistory
  events: RaceEvent[]
  selected: string[]
  persistentOnly: boolean
  onTogglePersistent: () => void
  majorOnly: boolean
  onToggleMajor: () => void
  hiddenCount: number
  onSelectLap: (lap: number) => void
  onToggleRider: (bib: string) => void
  highlightLap: number | null
}

const s1 = (ms: number) => `+${(ms / 1000).toFixed(1)}s`

// ② Event list in lap order. A / B are the riders on either side of the gap
// (B = first behind it); clicking a row highlights that lap in the timeline.
export function SplitEventList({
  history, events, selected, persistentOnly, onTogglePersistent, majorOnly, onToggleMajor, hiddenCount,
  onSelectLap, onToggleRider, highlightLap,
}: Props) {
  const names = new Map(history.riders.map((r) => [r.bib, r.name]))
  const shown = events // already filtered by AnalysisView (shared with the timeline)

  const Rider = ({ bib, strong }: { bib: string; strong?: boolean }) => {
    const ci = selected.indexOf(bib)
    return (
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          onToggleRider(bib)
        }}
        className={`rounded px-1 font-mono ${strong ? 'font-bold text-amber-200' : 'text-zinc-300'} hover:bg-zinc-800`}
        style={ci >= 0 ? { boxShadow: `inset 0 -2px 0 ${RIDER_COLORS[ci % RIDER_COLORS.length]}` } : undefined}
        title={names.get(bib) ?? ''}
      >
        No.{bib} {names.get(bib) ?? ''}
      </button>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">中切れイベント</h2>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <label className="flex items-center gap-1" title="脱落（後ろ側3名以下）と除外を隠す">
            <input type="checkbox" checked={majorOnly} onChange={onToggleMajor} />
            主要のみ（中切れ・抜け出し・合流）
          </label>
          <label className="flex items-center gap-1" title="翌周に合流した分断を隠す">
            <input type="checkbox" checked={persistentOnly} onChange={onTogglePersistent} />
            持続のみ
          </label>
          {hiddenCount > 0 && <span className="text-zinc-500">非表示 {hiddenCount}件</span>}
        </div>
      </div>
      <p className="border-b border-zinc-800/60 px-3 py-1.5 text-[10px] text-zinc-500">
        計測はフィニッシュラインで周1回。「L周」は L周目の途中で発生し L周目通過で確認。A/B は切れ目の前後の選手（B＝後ろ側の先頭）。
      </p>
      <ul className="max-h-[32rem] overflow-y-auto text-xs">
        {shown.length === 0 && <li className="px-3 py-6 text-center text-zinc-500">イベントなし</li>}
        {shown.map((e, i) => (
          <li
            key={i}
            onClick={() => onSelectLap(e.lap)}
            className={`cursor-pointer border-b border-zinc-800/60 px-3 py-1.5 hover:bg-zinc-800/40 ${highlightLap === e.lap ? 'bg-violet-950/40' : ''}`}
          >
            <span className="mr-2 font-mono font-bold text-zinc-200">L{e.lap}</span>
            {e.type === 'split' && (
              <>
                <span className={`mr-2 rounded px-1 text-[10px] font-bold ${e.kind === '中切れ' ? 'bg-amber-900 text-amber-200' : e.kind === '抜け出し' ? 'bg-sky-900 text-sky-200' : 'bg-zinc-700 text-zinc-200'}`}>
                  {e.kind}
                </span>
                <span className="mr-2 font-mono text-zinc-400">{e.frontSize}｜{e.rearSize}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-zinc-500">A</span>
                  <Rider bib={e.a} />
                  <span className="text-zinc-500">⇢ B</span>
                  <Rider bib={e.b} strong />
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  {s1(e.gapMs)}
                  {e.followUp.slice(0, 3).map((f) => ` → L${f.lap} ${s1(f.gapMs)}`).join('')}
                  {e.followUp.length > 3 ? ' …' : ''}
                  <span className="ml-2">
                    {e.rejoinedLap != null ? `L${e.rejoinedLap}で合流${e.transient ? '（一時的）' : ''}` : '持続'}
                  </span>
                </div>
              </>
            )}
            {e.type === 'merge' && (
              <span className="text-sky-300">合流 {e.size}名（{e.fromGroups}集団）</span>
            )}
            {e.type === 'pulled' && <span className="text-red-300">除外 {e.bibs.length}名</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
