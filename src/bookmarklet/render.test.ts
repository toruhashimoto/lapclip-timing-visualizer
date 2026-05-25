import { afterEach, describe, expect, it } from 'vitest'
import { parseMassStart } from '../userscript/parseDom'
import { normalizeMassStart } from '../utils/normalizeMassStart'
import {
  CRIT_TITLE,
  clearPage,
  critRows,
  mountPage,
} from '../userscript/__fixtures__/lapclipHtml'
import { renderMassStart } from './render'

afterEach(() => clearPage())

// Smoke-test the vanilla (no-React) bookmarklet renderer end-to-end: parse the
// live DOM -> normalize -> render. Guards the bookmarklet path that isn't
// exercised by the SPA preview.
describe('bookmarklet renderMassStart', () => {
  it('renders a classification table + situation line for a criterium', () => {
    mountPage(CRIT_TITLE, critRows)
    const data = parseMassStart()
    data.riders = normalizeMassStart(data.riders)
    const el = renderMassStart(data)
    const text = el.textContent ?? ''

    expect(el.querySelector('table')).toBeTruthy()
    expect(el.querySelector('.sit')).toBeTruthy() // live situation line
    expect(text).toContain('メイン集団')
    expect(text).toContain('Rider Uno')
    expect(text).toContain('-6周') // lapped rider's gap
  })
})
