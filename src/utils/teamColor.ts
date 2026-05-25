// Deterministic dark chip colour per team code, so each team reads as a
// consistent colour across the tower without a hand-maintained palette.
export type TeamColor = {
  backgroundColor: string
  color: string
  borderColor: string
}

export function teamColor(code: string | null | undefined): TeamColor {
  if (!code) {
    return {
      backgroundColor: '#27272a',
      color: '#a1a1aa',
      borderColor: '#3f3f46',
    }
  }
  let h = 0
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) % 360
  }
  return {
    backgroundColor: `hsl(${h} 45% 19%)`,
    color: `hsl(${h} 72% 74%)`,
    borderColor: `hsl(${h} 45% 32%)`,
  }
}
