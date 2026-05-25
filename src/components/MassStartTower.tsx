import { useMemo } from 'react'
import type { RiderResult } from '../types'
import { riderKey } from '../types'
import { MassStartRow } from './MassStartRow'

// Column template shared by the header and every row (mass-start layout).
const ROW_GRID =
  'grid items-center gap-x-2 grid-cols-[1.5rem_2rem_1.75rem_2.75rem_3.25rem_minmax(5rem,1fr)_3.5rem_4.5rem_4.5rem_minmax(3.5rem,8rem)_4rem]'

type Props = {
  riders: RiderResult[]
  lapsTotal: number | null
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  nonce: string
  noData?: boolean
}

export function MassStartTower({
  riders,
  favorites,
  onToggleFavorite,
  nonce,
  noData,
}: Props) {
  // Scale the gap bars to the largest lead-lap gap (lapped riders are excluded),
  // capped at 5 minutes so a single dropped group doesn't flatten everyone else.
  const scaleMs = useMemo(() => {
    let max = 0
    for (const r of riders) {
      if (r.lapsDown == null && r.gapMs != null && r.gapMs > max) max = r.gapMs
    }
    return Math.min(300000, Math.max(5000, max))
  }, [riders])

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Classification
        </h2>
        <span className="text-[10px] text-zinc-500">
          着順は公式リザルト（位）に準拠
        </span>
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
            <div className="text-right normal-case">周回</div>
            <div className="text-right">Time</div>
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
              <MassStartRow
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
