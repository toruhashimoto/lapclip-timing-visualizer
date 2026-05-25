// Browser-side parser for the LIVE LapClip result.php DOM.
//
// This reads the page the user is already viewing in their own browser — there
// is NO network request, NO storage, and NO redistribution. It mirrors the
// selectors the (removed) server parser used: each entry is an
// `<a class="result">` row containing `.nwb` spans (rank / No / [team]name) and
// `.nw` spans (phase / time / gap).
import type {
  LapClipData,
  RiderResult,
  RiderStatus,
  TeamData,
  TeamResult,
} from '../types'
import { parseTimeToMs } from '../utils/parseTime'

export type RawEntry = {
  bib: string
  teamCode: string | null
  name: string
  phase: string
  timeText: string
  gapText: string | null
}

// Phase label decides what the single shown time means:
//   FINISH -> final time; 中間点 / "N周" -> intermediate; 0周 -> not started.
function classifyPhase(
  phase: string,
  timeMs: number | null,
): {
  status: RiderStatus
  intermediateMs: number | null
  finishMs: number | null
  isIntermediate: boolean
  isFinish: boolean
} {
  const up = phase.toUpperCase()
  if (up === 'FINISH')
    return {
      status: 'FINISH',
      finishMs: timeMs,
      intermediateMs: null,
      isFinish: true,
      isIntermediate: false,
    }
  if (phase.includes('中間'))
    return {
      status: 'RUNNING',
      finishMs: null,
      intermediateMs: timeMs,
      isFinish: false,
      isIntermediate: true,
    }
  if (/^(DNS|DNF|DNQ|DSQ)$/.test(up))
    return {
      status: up as RiderStatus,
      finishMs: null,
      intermediateMs: null,
      isFinish: false,
      isIntermediate: false,
    }
  if (/\d+\s*周/.test(phase)) {
    if (timeMs != null)
      return {
        status: 'RUNNING',
        finishMs: null,
        intermediateMs: timeMs,
        isFinish: false,
        isIntermediate: true,
      }
    return {
      status: 'WAIT',
      finishMs: null,
      intermediateMs: null,
      isFinish: false,
      isIntermediate: false,
    }
  }
  return {
    status: timeMs != null ? 'FINISH' : 'WAIT',
    finishMs: timeMs,
    intermediateMs: null,
    isFinish: timeMs != null,
    isIntermediate: false,
  }
}

// Extract the raw rows from the live DOM. `root` defaults to the document so the
// userscript can call parseEntries() with no args; passing a fragment is handy
// for unit tests.
export function parseEntries(root: ParentNode = document): RawEntry[] {
  const entries: RawEntry[] = []
  const seen = new Set<string>()
  for (const el of Array.from(root.querySelectorAll('a.result'))) {
    const nwb = Array.from(el.querySelectorAll('.nwb')).map((s) =>
      (s.textContent ?? '').trim(),
    )
    const nw = Array.from(el.querySelectorAll('.nw')).map((s) =>
      (s.textContent ?? '').trim(),
    )
    if (nwb.length < 2 || nw.length < 1) continue

    let bib = (el.getAttribute('name') ?? '').trim()
    if (!bib) {
      const m = (nwb[1] ?? '').match(/No\.?\s*(\d+)/)
      bib = m ? m[1] : ''
    }
    if (!bib) continue

    const teamNameRaw = nwb[2] ?? ''
    const tnm = teamNameRaw.match(/^\s*[[［]([^\]］]+)[\]］]\s*(.*)$/)
    const teamCode = tnm ? tnm[1].trim() : null
    const name = (tnm ? tnm[2] : teamNameRaw).trim()
    if (!name) continue

    const phase = (nw[0] ?? '').trim()
    const timeText = (nw[1] ?? '').trim()
    const gapText = (nw[2] ?? '').replace(/.*Top\s*[:：]\s*/, '').trim() || null

    const key = `${bib}-${teamCode ?? ''}-${name}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ bib, teamCode, name, phase, timeText, gapText })
  }
  return entries
}

function eventInfo(root: ParentNode): {
  eventName: string
  categoryName: string
} {
  const title = (root.querySelector('title')?.textContent ?? document.title ?? '')
    .trim()
  const eventName =
    title
      .split(/[|｜/／-]/)
      .map((s) => s.trim())
      .filter(Boolean)[0] ?? 'Tour of Japan'
  let categoryName = ''
  for (const h of Array.from(
    root.querySelectorAll('h1, h2, h3, .title, .category'),
  )) {
    const t = (h.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t && /ステージ|カテゴリ|stage|category/i.test(t)) {
      categoryName = t
      break
    }
  }
  return { eventName, categoryName }
}

// Individual TT: one rider per result row.
export function parseIndividual(root: ParentNode = document): LapClipData {
  const { eventName, categoryName } = eventInfo(root)
  const riders: RiderResult[] = parseEntries(root).map((e) => {
    const timeMs = parseTimeToMs(e.timeText)
    const c = classifyPhase(e.phase, timeMs)
    return {
      rank: null,
      bib: e.bib,
      teamCode: e.teamCode,
      name: e.name,
      status: c.status,
      intermediateText: c.isIntermediate ? e.timeText : null,
      intermediateMs: c.intermediateMs,
      finishText: c.isFinish ? e.timeText : null,
      finishMs: c.finishMs,
      gapText: e.gapText,
      gapMs: null,
    }
  })
  return {
    eventName,
    categoryName,
    sourceUrl: location.href,
    fetchedAt: new Date().toISOString(),
    riders,
  }
}

// Team TT (大鹿): best-effort mapping of each result row to a team. result.php
// shows the team's current/finish time + gap; per-lap splits (Lap 1/2/3) are
// NOT on this page, so lapsCumMs is filled only for the finish checkpoint until
// the parser is calibrated against the real team-TT DOM on race day. The tower
// renders finish + gap regardless, so this is safe to ship.
export function parseTeam(root: ParentNode = document, laps = 3): TeamData {
  const { eventName, categoryName } = eventInfo(root)
  const teams: TeamResult[] = parseEntries(root).map((e) => {
    const timeMs = parseTimeToMs(e.timeText)
    const c = classifyPhase(e.phase, timeMs)
    const lapsCumMs: (number | null)[] = new Array(Math.max(1, laps)).fill(null)
    if (c.isFinish && timeMs != null) lapsCumMs[lapsCumMs.length - 1] = timeMs
    return {
      rank: null,
      teamCode: e.teamCode ?? e.bib,
      teamName: e.name,
      status: c.status,
      lapsCumMs,
      finishMs: c.finishMs,
      finishText: c.isFinish ? e.timeText : null,
      gapText: e.gapText,
      gapMs: null,
    }
  })
  return {
    eventName,
    categoryName,
    sourceUrl: location.href,
    fetchedAt: new Date().toISOString(),
    laps,
    teams,
  }
}

// Pick mode from the result.php category (ctg=004 = 大鹿 team TT). The caller can
// override; this is just the default heuristic.
export function detectMode(href = location.href): 'individual' | 'team' {
  try {
    const ctg = new URL(href).searchParams.get('ctg') ?? ''
    return ctg.startsWith('004') ? 'team' : 'individual'
  } catch {
    return 'individual'
  }
}
