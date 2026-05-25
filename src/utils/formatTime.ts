// Display formatters for the timing tower. All inputs are milliseconds.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

// Two-decimal seconds with zero padding, e.g. 58.91 -> "58.91", 3.2 -> "03.20".
function secs2(totalSeconds: number): string {
  const whole = Math.floor(totalSeconds)
  const cents = Math.round((totalSeconds - whole) * 100)
  // Guard against rounding 59.999 -> 60.00.
  if (cents >= 100) return `${pad2(whole + 1)}.00`
  return `${pad2(whole)}.${cents < 10 ? `0${cents}` : cents}`
}

// A full time. Drops the hours component when zero: 178910 -> "2:58.91".
export function formatTimeMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const totalSeconds = ms / 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    const s = secs2(seconds)
    return `${hours}:${pad2(minutes)}:${s}`
  }
  return `${minutes}:${secs2(seconds)}`
}

// A gap to the leader. <=0 -> "BEST"; under a minute -> "+1.60";
// a minute or more -> "+1:02.50".
export function formatGapMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms <= 0) return 'BEST'
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) {
    return `+${totalSeconds.toFixed(2)}`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `+${minutes}:${secs2(seconds)}`
}

// Mass-start (criterium / road) elapsed time: whole seconds, hours kept.
// 9546000 -> "2:39:06"; 2027000 -> "33:47".
export function formatDurationWhole(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
  return `${minutes}:${pad2(seconds)}`
}

// Mass-start gap to the leader: whole seconds. 0 -> "+0:00"; 115000 -> "+1:55".
export function formatGapWhole(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms <= 0) return '+0:00'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `+${minutes}:${pad2(seconds)}`
}

// Local wall-clock time (HH:MM:SS) from an ISO string, for "last update" and feed lines.
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '--:--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
