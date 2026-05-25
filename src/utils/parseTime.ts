// Converts LapClip time/gap strings into milliseconds.
//
// Handles the formats observed on the source and described in the spec:
//   "0:02:58.91"  -> H:MM:SS.cc
//   "2:07:40"     -> H:MM:SS
//   "0:03:00.51"  -> H:MM:SS.cc
//   "+0:01.60"    -> M:SS.cc  (gap)
//   "0:00.00"     -> M:SS.cc  -> 0
//   "+0:12"       -> M:SS
//   "1:02.50"     -> M:SS.cc
//   "58.91"       -> SS.cc
//
// Returns null for anything that is not a real time:
//   "-:--:--.---" / "-:--:--.--" (placeholder), "+1周" (a lap down), "", "-".

export function parseTimeToMs(value: string | null | undefined): number | null {
  if (value == null) return null
  const raw = value.trim()
  if (raw === '') return null

  // Lap-down notation ("+1周", "2周") is not a time.
  if (raw.includes('周')) return null

  // Placeholder / DNF markers contain no digits at all.
  if (!/\d/.test(raw)) return null

  // Capture and strip a leading sign.
  const sign = raw.startsWith('-') ? -1 : 1
  const body = raw.replace(/^[+\-\s]+/, '')

  // Split on colons: [SS], [MM, SS], or [HH, MM, SS].
  const parts = body.split(':')
  if (parts.length === 0 || parts.length > 3) return null

  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n))) return null

  let seconds = 0
  if (nums.length === 3) {
    seconds = nums[0] * 3600 + nums[1] * 60 + nums[2]
  } else if (nums.length === 2) {
    seconds = nums[0] * 60 + nums[1]
  } else {
    seconds = nums[0]
  }

  return Math.round(seconds * 1000) * sign
}
