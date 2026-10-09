import { useState } from 'react'
import type { LoadFn } from '../../analysis/fetchLapHistory'
import { mockLapHistory } from '../../analysis/mockLapHistory'
import { AnalysisView } from './AnalysisView'

// SPA preview (?mock=analysis): the analysis tab on SYNTHETIC data, with a
// simulated progress bar and no network access.
const mockLoad: LoadFn = async (onProgress, signal) => {
  const h = mockLapHistory()
  onProgress({ phase: 'roster', done: h.riders.length, total: h.riders.length })
  for (let i = 0; i <= h.riders.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    onProgress({ phase: 'laps', done: i, total: h.riders.length })
    await new Promise((r) => setTimeout(r, 40))
  }
  return h
}

export function AnalysisPreview() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(['9-CCC-Rider I', '1-AAA-Rider A']))
  const toggle = (k: string) =>
    setFavorites((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  return (
    <div className="min-h-screen bg-zinc-950 p-3 text-zinc-100">
      <p className="mb-2 text-[11px] text-amber-300">プレビュー：架空データ（?mock=analysis）</p>
      <AnalysisView load={mockLoad} favorites={favorites} onToggleFavorite={toggle} enabled />
    </div>
  )
}
