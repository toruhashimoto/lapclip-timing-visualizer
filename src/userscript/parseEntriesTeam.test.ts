// Name / team separation in parseEntries across the source's different
// rider-cell forms:
//   • "[CODE]name"        — TOJ (bracketed short team code)
//   • "氏名/チーム名"      — 全日本ロード 2026 (full team name after a slash)
//   • "氏名"              — 全日本ロード 2025 (name only, no team)
import { afterEach, describe, expect, it } from 'vitest'
import { parseEntries } from './parseDom'
import { clearPage, mountPage } from './__fixtures__/lapclipHtml'

const TITLE = '全日本自転車競技選手権大会 ロード・レース - Men Eliteのリザルト'

afterEach(() => clearPage())

describe('parseEntries — rider name / team separation', () => {
  it('splits "氏名/チーム名" (2026 全日本ロード) into name + teamCode', () => {
    mountPage(TITLE, [
      { rank: '-', bib: '801', name: '松井　丈治/愛三工業レーシングチーム', phase: '0周', time: '-:--:--.---', gap: '0:00.000' },
    ])
    const [e] = parseEntries()
    expect(e.name).toBe('松井　丈治')
    expect(e.teamCode).toBe('愛三工業レーシングチーム')
  })

  it('keeps the "[CODE]name" bracket form (TOJ) working', () => {
    mountPage(TITLE, [
      { rank: '1位', bib: '1', team: 'TUK', name: 'Rider Alpha', phase: '10周', time: '0:33:47', gap: '0:00' },
    ])
    const [e] = parseEntries()
    expect(e.teamCode).toBe('TUK')
    expect(e.name).toBe('Rider Alpha')
  })

  it('leaves a plain name (no team, 2025 全日本ロード) untouched', () => {
    mountPage(TITLE, [
      { rank: '1位', bib: '705', name: '仲村　陽子', phase: '4周', time: '1:08:13.599', gap: '0:00.000' },
    ])
    const [e] = parseEntries()
    expect(e.teamCode).toBeNull()
    expect(e.name).toBe('仲村　陽子')
  })

  it('splits on the first slash only (team name kept intact)', () => {
    mountPage(TITLE, [
      { rank: '-', bib: '9', name: '山本　元喜/KINAN Racing Team', phase: '0周', time: '-:--:--.---', gap: '0:00.000' },
    ])
    const [e] = parseEntries()
    expect(e.name).toBe('山本　元喜')
    expect(e.teamCode).toBe('KINAN Racing Team')
  })
})
