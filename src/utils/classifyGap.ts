import type { RiderResult } from '../types'

export type GapBandKey =
  | 'best'
  | 'close'
  | 'contender'
  | 'losing'
  | 'offpace'
  | 'none'

export type GapBand = {
  key: GapBandKey
  label: string
  barClass: string // bar fill background
  textClass: string // gap value text color
  dotClass: string // small legend swatch background
}

const BANDS: Record<GapBandKey, GapBand> = {
  best: {
    key: 'best',
    label: 'BEST',
    barClass: 'bg-purple-500',
    textClass: 'text-purple-300',
    dotClass: 'bg-purple-500',
  },
  close: {
    key: 'close',
    label: 'Very close',
    barClass: 'bg-emerald-500',
    textClass: 'text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  contender: {
    key: 'contender',
    label: 'Contender',
    barClass: 'bg-yellow-400',
    textClass: 'text-yellow-300',
    dotClass: 'bg-yellow-400',
  },
  losing: {
    key: 'losing',
    label: 'Losing',
    barClass: 'bg-orange-500',
    textClass: 'text-orange-300',
    dotClass: 'bg-orange-500',
  },
  offpace: {
    key: 'offpace',
    label: 'Off pace',
    barClass: 'bg-red-500',
    textClass: 'text-red-300',
    dotClass: 'bg-red-500',
  },
  none: {
    key: 'none',
    label: 'No time',
    barClass: 'bg-zinc-700',
    textClass: 'text-zinc-500',
    dotClass: 'bg-zinc-700',
  },
}

// Thresholds in milliseconds, per the spec's colour rules.
export function classifyGap(gapMs: number | null | undefined): GapBand {
  if (gapMs == null || !Number.isFinite(gapMs)) return BANDS.none
  if (gapMs <= 0) return BANDS.best
  if (gapMs <= 2000) return BANDS.close
  if (gapMs <= 5000) return BANDS.contender
  if (gapMs <= 10000) return BANDS.losing
  return BANDS.offpace
}

export function gapBandForRider(r: RiderResult): GapBand {
  if (r.finishMs == null) return BANDS.none
  return classifyGap(r.gapMs)
}

// Mass-start (criterium / road) gaps span seconds to many minutes, and lapped
// riders ("-N周") get the off-pace band. Used for the mass-start tower / bars.
export function classifyMassStartGap(
  gapMs: number | null | undefined,
  lapsDown?: number | null,
): GapBand {
  if (lapsDown != null && lapsDown > 0) return BANDS.offpace
  if (gapMs == null || !Number.isFinite(gapMs)) return BANDS.none
  if (gapMs <= 1000) return BANDS.best // same bunch / lead group
  if (gapMs <= 30000) return BANDS.close // within ~30s
  if (gapMs <= 120000) return BANDS.contender // within ~2 min
  if (gapMs <= 300000) return BANDS.losing // within ~5 min
  return BANDS.offpace
}

// Ordered list for rendering the colour legend.
export const GAP_BAND_ORDER: GapBandKey[] = [
  'best',
  'close',
  'contender',
  'losing',
  'offpace',
  'none',
]

export function getBand(key: GapBandKey): GapBand {
  return BANDS[key]
}
