import type { TeamResult } from '../types'
import { parseTimeToMs } from '../utils/parseTime'

// Parse a laptimes.php document into cumulative lap times.
// Table row: <td.syukai>N/M周|FINISH</td>  <td.total>H:MM:SS.ss</td>
export function parseLaptimesDoc(doc: Document, laps: number): (number | null)[] {
  const lapsCumMs: (number | null)[] = new Array(laps).fill(null)
  for (const row of Array.from(doc.querySelectorAll('table tr')).slice(1)) {
    const phase = row.querySelector('.syukai')?.textContent?.trim()
    const totalMs = parseTimeToMs(row.querySelector('.total')?.textContent?.trim() ?? '')
    if (!phase || totalMs == null) continue
    if (/^FINISH$/i.test(phase)) {
      lapsCumMs[laps - 1] = totalMs
    } else {
      // "N/M周" or "N周" — N is the lap number (1-based)
      const m = phase.match(/^(\d+)/)
      if (m) {
        const idx = Number(m[1]) - 1
        if (idx >= 0 && idx < laps) lapsCumMs[idx] = totalMs
      }
    }
  }
  return lapsCumMs
}

// Extract evt and ctg from the current page URL.
export function evtCtgFromUrl(href = location.href): { evt: string; ctg: string } {
  try {
    const p = new URL(href).searchParams
    return { evt: p.get('evt') ?? '', ctg: p.get('ctg') ?? '' }
  } catch {
    return { evt: '', ctg: '' }
  }
}

async function fetchOne(
  bib: string,
  evt: string,
  ctg: string,
  laps: number,
  signal: AbortSignal,
): Promise<(number | null)[]> {
  const url = `/lap/laptimes.php?evt=${encodeURIComponent(evt)}&ctg=${encodeURIComponent(ctg)}&num=${encodeURIComponent(bib)}`
  const resp = await fetch(url, { signal })
  if (!resp.ok) return new Array(laps).fill(null)
  const html = await resp.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return parseLaptimesDoc(doc, laps)
}

// Fetch per-lap splits for teams not yet fully populated, return enriched copies.
// Only FINISH teams need enrichment — in-progress teams already show their
// current checkpoint via result.php. Teams with complete data are skipped.
export async function enrichTeamsWithLaptimes(
  teams: TeamResult[],
  evt: string,
  ctg: string,
  laps: number,
  signal: AbortSignal,
): Promise<TeamResult[]> {
  return Promise.all(
    teams.map(async (team) => {
      if (team.status !== 'FINISH') return team
      if (team.lapsCumMs.every((v) => v != null)) return team
      try {
        const lapsCumMs = await fetchOne(team.teamCode, evt, ctg, laps, signal)
        if (lapsCumMs.every((v) => v == null)) return team
        return {
          ...team,
          lapsCumMs,
          finishMs: team.finishMs ?? lapsCumMs[laps - 1],
          finishText: team.finishText,
        }
      } catch {
        return team
      }
    }),
  )
}
