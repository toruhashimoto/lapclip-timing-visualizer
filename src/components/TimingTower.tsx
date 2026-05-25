import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { GAP_BAND_ORDER, getBand } from '../utils/classifyGap'
import { RiderRow } from './RiderRow'

// Shared column template so the header and every row stay aligned.
const ROW_GRID =
  'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_2.75rem_3.25rem_minmax(5rem,1fr)_4.5rem_4.5rem_4rem_minmax(3.5rem,8rem)_4rem]'

type Props = {
  riders: RiderResult[]
  scaleMs: number
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  nonce: string
  // True when the source returned zero results (not just filtered-out), e.g.
  // a stage whose results aren't posted yet ("データがありません").
  noData?: boolean
}

function GapLegend() {
  return (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 md:flex">
      {GAP_BAND_ORDER.map((k) => {
        const b = getBand(k)
        return (
          <span
            key={k}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500"
          >
            <span className={`h-2 w-2 rounded-full ${b.dotClass}`} />
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

export function TimingTower({
  riders,
  scaleMs,
  favorites,
  onToggleFavorite,
  nonce,
  noData,
}: Props) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Timing tower
        </h2>
        <GapLegend />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div
            className={`${ROW_GRID} border-b border-zinc-700 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500`}
          >
            <div />
            <div className="text-center">P</div>
            <div className="text-center">Δ</div>
            <div>No</div>
            <div>Team</div>
            <div>Rider</div>
            <div className="text-right normal-case">中間点</div>
            <div className="text-right">Finish</div>
            <div className="text-right">Gap</div>
            <div className="px-1">Visual gap</div>
            <div className="text-center">Status</div>
          </div>

          {riders.length === 0 ? (
            noData ? (
              <div className="px-3 py-12 text-center">
                <p className="text-sm font-semibold text-zinc-300">
                  まだ結果がありません
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  レースが始まり結果が掲載されると、自動でここに表示されます。
                </p>
              </div>
            ) : (
              <p className="px-3 py-10 text-center text-sm text-zinc-600">
                No riders match the current view.
              </p>
            )
          ) : (
            riders.map((r) => (
              <RiderRow
                key={riderKey(r)}
                rider={r}
                rowGrid={ROW_GRID}
                scaleMs={scaleMs}
                isFavorite={favorites.has(riderKey(r))}
                onToggleFavorite={onToggleFavorite}
                nonce={nonce}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
