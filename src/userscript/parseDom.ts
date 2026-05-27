// Browser-side parser for the LIVE LapClip result.php DOM.
//
// This reads the page the user is already viewing in their own browser — there
// is NO network request, NO storage, and NO redistribution. It mirrors the
// selectors the (removed) server parser used: each entry is an
// `<a class="result">` row containing `.nwb` spans (rank / No / [team]name) and
// `.nw` spans (phase / time / gap).
import type {
  LapClipData,
  RaceShape,
  RiderResult,
  RiderStatus,
  TeamData,
  TeamResult,
} from '../types'
import { parseTimeToMs } from '../utils/parseTime'

export type RawEntry = {
  rankText: string // the official placing as shown, e.g. "12位"
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
  // "LAP1" / "LAP 2" / "LAP3" — team TT intermediate checkpoint label.
  // Must be caught before the default fallthrough, which would wrongly treat
  // any unknown phase-with-time as FINISH.
  if (/\bLAP\s*\d+\b/i.test(phase))
    return {
      status: 'RUNNING',
      finishMs: null,
      intermediateMs: timeMs,
      isFinish: false,
      isIntermediate: true,
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

    const rankText = (nwb[0] ?? '').trim()
    const phase = (nw[0] ?? '').trim()
    const timeText = (nw[1] ?? '').trim()
    const gapText = (nw[2] ?? '').replace(/.*Top\s*[:：]\s*/, '').trim() || null

    const key = `${bib}-${teamCode ?? ''}-${name}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ rankText, bib, teamCode, name, phase, timeText, gapText })
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
    raceShape: 'individual_tt',
  }
}

// Team TT (大鹿): one row per team showing the team's current or final time.
// Phase labels observed on the live DOM:
//   "FINISH"  — official finish time
//   "LAP1" / "LAP2" — cumulative time at intermediate checkpoint N
//   "N周" (N > 0)   — alternative checkpoint notation (N laps completed)
//   "0周"            — not yet started
export function parseTeam(root: ParentNode = document, laps = 3): TeamData {
  const { eventName, categoryName } = eventInfo(root)
  const teams: TeamResult[] = parseEntries(root).map((e) => {
    const timeMs = parseTimeToMs(e.timeText)
    const c = classifyPhase(e.phase, timeMs)
    const lapsCumMs: (number | null)[] = new Array(Math.max(1, laps)).fill(null)
    if (timeMs != null) {
      if (c.isFinish) {
        lapsCumMs[lapsCumMs.length - 1] = timeMs
      } else if (c.isIntermediate) {
        // Map the checkpoint label to the correct lap slot (1-based → 0-based).
        // "LAP1"/"LAP 2" and "N周" (N > 0) are both supported.
        const lapLabel = e.phase.match(/\bLAP\s*(\d+)\b/i)
        const lapCycle = e.phase.match(/^(\d+)\s*周$/)
        const n = lapLabel ? Number(lapLabel[1]) : lapCycle ? Number(lapCycle[1]) : null
        if (n != null && n >= 1 && n <= laps) lapsCumMs[n - 1] = timeMs
      }
    }
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

// "12位" -> 12. The mass-start ranking trusts this official placing.
export function parseRankNum(rankText: string): number | null {
  const m = rankText.match(/(\d+)/)
  return m ? Number(m[1]) : null
}

// Parse a mass-start phase label into lap progress + last checkpoint:
//   "FINISH"     -> { done: null, total: null, checkpoint: 'FINISH' }
//   "10周"       -> { done: 10,   total: null }            (criterium: lap count)
//   "4/6周 SP2"  -> { done: 4,    total: 6, checkpoint: 'SP2' }
//   "3/6周"      -> { done: 3,    total: 6 }
export function parseLapPhase(phase: string): {
  lapsDone: number | null
  lapsTotal: number | null
  lastCheckpoint: string | null
} {
  const frac = phase.match(/(\d+)\s*\/\s*(\d+)\s*周/)
  const single = phase.match(/(\d+)\s*周/)
  const lapsDone = frac ? Number(frac[1]) : single ? Number(single[1]) : null
  const lapsTotal = frac ? Number(frac[2]) : null
  // Anything after the 周 token (e.g. "SP2", "KOM") is the last point passed.
  const tail = phase.replace(/.*周/, '').trim()
  const ckMatch = phase.match(/\b(SP\d+|KOM|FINISH)\b/i)
  const lastCheckpoint = ckMatch
    ? ckMatch[1].toUpperCase()
    : tail && !/^\d+$/.test(tail)
      ? tail
      : null
  return { lapsDone, lapsTotal, lastCheckpoint }
}

// Laps down parsed from a gap like "-4周" / "+1周". Returns null for a time gap.
export function parseLapsDown(gapText: string | null): number | null {
  if (!gapText || !gapText.includes('周')) return null
  const m = gapText.match(/(\d+)\s*周/)
  return m ? Number(m[1]) : null
}

// Mass-start (criterium / road): one rider per row, ranked by the official
// placing (位) because bunch finishes share the same time. The phase shows lap
// progress (N周 / X/Y周 / +SPn), the gap is a time for lead-lap riders and
// "-N周" for lapped riders.
export function parseMassStart(root: ParentNode = document): LapClipData {
  const { eventName, categoryName } = eventInfo(root)
  const entries = parseEntries(root)
  let lapsTotal: number | null = null

  const riders: RiderResult[] = entries.map((e) => {
    const elapsedMs = parseTimeToMs(e.timeText)
    // Pre-start / not-yet-timed rows show "0周 / -:--:-- / +Top : 0:00".
    const noTime = elapsedMs == null
    const { lapsDone, lapsTotal: total, lastCheckpoint } = parseLapPhase(e.phase)
    if (total != null) lapsTotal = Math.max(lapsTotal ?? 0, total)
    const officialRank = parseRankNum(e.rankText)
    const lapsDown = parseLapsDown(e.gapText)
    const onLeadLap = lapsDown == null
    // A gap only counts once the rider has a real time on the clock; before the
    // start every rider shows a placeholder "0:00" that must not group them.
    const gapMs = onLeadLap && !noTime ? parseTimeToMs(e.gapText) : null

    const phaseUp = e.phase.toUpperCase()
    // Finished only when the source literally says FINISH — road races flip each
    // row to FINISH as the rider crosses. A criterium keeps showing the lap
    // count even at the end, so it never reports a finisher (source limitation).
    const isFinisher = phaseUp === 'FINISH'

    let status: RiderStatus
    if (/^(DNS|DNF|DNQ|DSQ)$/.test(phaseUp)) status = phaseUp as RiderStatus
    else if (isFinisher) status = 'FINISH'
    else if (noTime) status = 'WAIT'
    else status = 'RUNNING'

    return {
      rank: null,
      bib: e.bib,
      teamCode: e.teamCode,
      name: e.name,
      status,
      intermediateText: null,
      intermediateMs: null,
      // Reuse finishMs so the diff/feed/highlight logic sees finishers too.
      finishText: isFinisher ? e.timeText : null,
      finishMs: isFinisher ? elapsedMs : null,
      gapText: e.gapText,
      gapMs,
      officialRank,
      elapsedText: e.timeText || null,
      elapsedMs,
      lapsDone,
      lapsTotal: total,
      lastCheckpoint,
      lapsDown,
      isFinisher,
    }
  })

  return {
    eventName,
    categoryName,
    sourceUrl: location.href,
    fetchedAt: new Date().toISOString(),
    riders,
    raceShape: 'mass_start',
    lapsTotal,
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

// Detect the race shape from the page CONTENT (not just the URL), so the right
// view is chosen for any TOJ stage — and future events — without a hard-coded
// category map. ctg=004 (大鹿 team TT) is the one URL hint we keep, because a
// team page is otherwise hard to tell from an individual one by content alone.
//
// Signals (in priority order):
//   • 1/100s times or a 中間点 phase  -> individual_tt (TTs are always sub-second).
//   • lap-progress phases (N周 / X/Y周) -> mass_start.
//   • whole-second times that tie across riders (bunch finish) -> mass_start.
//   • nothing parseable yet            -> individual_tt (safe default; re-runs
//                                         once the page populates).
export function detectRaceShape(
  root: ParentNode = document,
  href = location.href,
): RaceShape {
  if (detectMode(href) === 'team') return 'team_tt'
  const entries = parseEntries(root)
  if (entries.length === 0) return 'individual_tt'

  const hasCentiseconds = entries.some((e) => /\d\.\d{2}\b/.test(e.timeText))
  const hasMidpoint = entries.some((e) => e.phase.includes('中間'))
  if (hasCentiseconds || hasMidpoint) return 'individual_tt'

  const hasLapPhase = entries.some((e) => /\d\s*周/.test(e.phase))
  if (hasLapPhase) return 'mass_start'

  // All-FINISH whole-second times: a bunch finish (shared times) is mass-start;
  // unique times would be an unusual TT timed only to the second.
  const times = entries
    .map((e) => parseTimeToMs(e.timeText))
    .filter((t): t is number => t != null)
  const unique = new Set(times).size
  if (times.length >= 3 && unique < times.length) return 'mass_start'

  return 'individual_tt'
}
