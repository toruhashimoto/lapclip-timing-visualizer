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

    // The rider/team cell comes in three observed forms:
    //   "[CODE]name"   — TOJ: a bracketed short team code.
    //   "氏名/チーム名" — 全日本ロード 2026: full team name after a slash.
    //   "氏名"          — 全日本ロード 2025: name only, no team.
    const teamNameRaw = nwb[2] ?? ''
    const bracket = teamNameRaw.match(/^\s*[[［]([^\]］]+)[\]］]\s*(.*)$/)
    let teamCode: string | null
    let name: string
    if (bracket) {
      teamCode = bracket[1].trim()
      name = bracket[2].trim()
    } else {
      // Split on the FIRST slash (half- or full-width); the remainder is the
      // team name. No slash → a plain name with no team.
      const slash = teamNameRaw.search(/[/／]/)
      if (slash >= 0) {
        name = teamNameRaw.slice(0, slash).trim()
        teamCode = teamNameRaw.slice(slash + 1).trim() || null
      } else {
        teamCode = null
        name = teamNameRaw.trim()
      }
    }
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

// How many laps the team-TT course is run, by event. result.php never states
// the lap count, so we key it off the event id (the loop length differs per
// venue, not per team):
//   • 全日本選手権 TTT (evt …_jptt) → loop ×2  (会場・周回は年度毎に当日確認;
//     2026 宮崎=14.2km×2 の推定。値が変わる年は要見直し)
//   • TOJ Astemo 大鹿ステージ (ctg=004) → 3.8km loop ×3
// This sets how many "Lap N" columns the team tower draws and how many lap
// splits enrichTeamsWithLaptimes fetches; the splits themselves come from the
// live DOM / laptimes.php.
export function teamLaps(href = location.href): number {
  try {
    const evt = new URL(href).searchParams.get('evt') ?? ''
    if (/jptt/i.test(evt)) return 2 // 全日本 TTT: 14.2km × 2
  } catch {
    /* fall through to the TOJ default */
  }
  return 3 // 大鹿: 3.8km × 3
}

// Team TT: one row per team showing the team's current or final time.
// Phase labels observed on the live DOM:
//   "FINISH"  — official finish time
//   "LAP1" / "LAP2" — cumulative time at intermediate checkpoint N
//   "N周" (N > 0)   — alternative checkpoint notation (N laps completed)
//   "0周"            — not yet started
// `laps` defaults to the per-event value (teamLaps): All-Japan TTT draws 2, 大鹿 3.
export function parseTeam(
  root: ParentNode = document,
  laps = teamLaps(),
): TeamData {
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
        // "N周" or "N/M周" (N = laps done, M = total)
        const lapCycle = e.phase.match(/^(\d+)(?:\/\d+)?\s*周$/)
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

    // Status from the phase label. Only the confirmed ASCII abnormal codes
    // (DNS/DNF/DNQ/DSQ) and FINISH map to a known status; a lap-progress phase
    // ("…周") or an empty/unstamped phase is the normal running/waiting case.
    // ANYTHING ELSE — OTL / リタイア / 降車 / a code we have not positively seen —
    // is kept as an explicit UNKNOWN with the source's own wording intact, never
    // guessed into DNF or RUNNING. statusText preserves the original text so the
    // UI can show it verbatim.
    let status: RiderStatus
    let statusText: string | null = null
    if (/^(DNS|DNF|DNQ|DSQ)$/.test(phaseUp)) {
      status = phaseUp as RiderStatus
      statusText = e.phase
    } else if (isFinisher) {
      status = 'FINISH'
    } else if (/\d\s*周/.test(e.phase) || e.phase === '') {
      status = noTime ? 'WAIT' : 'RUNNING'
    } else {
      status = 'UNKNOWN'
      statusText = e.phase
    }
    // For any abnormal-status row (DNS/DNF/DNQ/DSQ/UNKNOWN) the phase is a label,
    // not a checkpoint, so don't let parseLapPhase's tail fallback leak it into
    // the SPn/KOM checkpoint field (which feeds passedCheckpoints / the badge).
    const checkpoint = statusText != null ? null : lastCheckpoint

    return {
      rank: null,
      bib: e.bib,
      teamCode: e.teamCode,
      name: e.name,
      status,
      statusText,
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
      lastCheckpoint: checkpoint,
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

// A team-TT page named in its own title/headings. TOJ 大鹿 is caught by the
// ctg=004 URL hint, but the 全日本 TTT uses alpha ctg codes (like ME-T/MU-T for
// the ITTs) that we can't enumerate in advance — so we read the page's own label
// instead. The ITT event name "…個人タイムトライアル…" never contains a team
// marker, so this stays false for individual pages.
function looksLikeTeamTT(root: ParentNode): boolean {
  const parts = [root.querySelector('title')?.textContent ?? document.title]
  for (const h of Array.from(root.querySelectorAll('h1, h2, h3, .title, .category')))
    parts.push(h.textContent ?? '')
  const text = parts.join(' ')
  return /チーム\s*(タイム)?トライアル|チーム\s*TT|team\s*time\s*trial|\bTTT\b/i.test(
    text,
  )
}

// The mirror of looksLikeTeamTT for the other unambiguous case: a page that
// titles itself a ロード・レース (road race) and does NOT mention a time trial is
// a mass-start road race. Keyed off the page's own title — the 全日本 road event
// id (…_jprr) is never inspected — so it also covers future road events. The TT
// exclusion keeps 個人/チーム TT titles (which never say ロード・レース) on their
// own paths.
function looksLikeRoadRace(root: ParentNode): boolean {
  const title = root.querySelector('title')?.textContent ?? document.title ?? ''
  const isRoad = /ロード\s*[・･]?\s*レース/.test(title)
  const mentionsTT =
    /タイムトライアル|team\s*time\s*trial|\bTTT\b|\bITT\b|\bTT\b/i.test(title)
  return isRoad && !mentionsTT
}

// Pick mode from the result.php category (ctg=004 = 大鹿 team TT) or the page's
// own team-TT label (全日本 TTT). The caller can override; this is just the
// default heuristic.
export function detectMode(
  href = location.href,
  root: ParentNode = document,
): 'individual' | 'team' {
  try {
    const ctg = new URL(href).searchParams.get('ctg') ?? ''
    if (ctg.startsWith('004')) return 'team'
  } catch {
    /* fall through to the content check */
  }
  return looksLikeTeamTT(root) ? 'team' : 'individual'
}

// Detect the race shape from the page CONTENT (not just the URL), so the right
// view is chosen for any TOJ stage — and future events — without a hard-coded
// category map. Team TT is hard to tell from an individual TT by row content
// alone (both are sub-second times), so it is keyed off two hints: the ctg=004
// URL (大鹿) and the page's own team-TT title/heading (全日本 TTT). This must run
// before the centisecond check below, which would otherwise call a TTT page
// (sub-second LAP1/LAP2 splits) an individual_tt.
//
// Signals (in priority order):
//   • ctg=004 or a team-TT title    -> team_tt (detectMode).
//   • a ロード・レース title (no TT wording) -> mass_start (looksLikeRoadRace);
//     pinned before the sub-second check so a sparse/odd road page can't slip
//     through to individual_tt.
//   • 1/100s times or a 中間点 phase  -> individual_tt (TTs are always sub-second).
//   • lap-progress phases (N周 / X/Y周) -> mass_start.
//   • whole-second times that tie across riders (bunch finish) -> mass_start.
//   • nothing parseable yet            -> individual_tt (safe default; re-runs
//                                         once the page populates).
export function detectRaceShape(
  root: ParentNode = document,
  href = location.href,
): RaceShape {
  if (detectMode(href, root) === 'team') return 'team_tt'
  // An explicit ロード・レース title (without any time-trial wording) is a
  // mass-start road race — pinned here, before the content heuristics, so a
  // pre-start / sparse / oddly-timed road page can't fall through to
  // individual_tt. For normal road data (whole-second times + N周) this simply
  // agrees with the content signals below.
  if (looksLikeRoadRace(root)) return 'mass_start'
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
