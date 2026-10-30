/**
 * EDTF Parser Test Suite
 *
 */

import { EDTF_REGEX, isEDTFPattern, normalizeEDTF, parseEDTF } from '../index.js'
import { describe, expect, it } from 'vitest'

const cases = [
  // Before/After/Until/From patterns
  { input: '../1277', locale: 'et', expected: 'kuni 1277' },
  { input: '1985/..', locale: 'et', expected: 'alates 1985' },
  { input: '../1277', locale: 'en', expected: 'until 1277' },
  { input: '1985/..', locale: 'en', expected: 'from 1985' },

  // Uncertain/Approximate
  { input: '1984?', locale: 'et', expected: 'arvatavasti 1984' },
  { input: '1984~', locale: 'et', expected: 'umbes 1984' },
  { input: '1984?~', locale: 'et', expected: 'arvatavasti umbes 1984' },
  { input: '1984?', locale: 'en', expected: 'uncertain 1984' },
  { input: '1984~', locale: 'en', expected: 'approximately 1984' },

  // Month/Day
  { input: '1550-09', locale: 'et', expected: 'september 1550' },
  { input: '1550-09-15', locale: 'et', expected: '15. september 1550' },
  { input: '1550-09', locale: 'en', expected: 'September 1550' },

  // Intervals
  { input: '1700/1800', locale: 'et', expected: '1700 – 1800' },
  { input: '1700~/1800~', locale: 'et', expected: 'umbes 1700 – umbes 1800' },
  { input: '1700-01/1800-12', locale: 'et', expected: 'jaanuar 1700 – detsember 1800' },

  // Open interval patterns (standard EDTF only)
  { input: '../1700', locale: 'et', expected: 'kuni 1700' },
  { input: '../1700~', locale: 'et', expected: 'kuni umbes 1700' },
  { input: '../1700?', locale: 'et', expected: 'kuni arvatavasti 1700' },
  { input: '../1700', locale: 'en', expected: 'until 1700' },
  { input: '1700/..', locale: 'et', expected: 'alates 1700' },
  { input: '1700~/..', locale: 'et', expected: 'alates umbes 1700' },
  { input: '1700/..', locale: 'en', expected: 'from 1700' },

  // Choice sets
  { input: '[1556,1557]', locale: 'et', expected: 'üks järgmistest: 1556, 1557' },
  { input: '[1556,1557]', locale: 'en', expected: 'one of: 1556, 1557' },

  // Complex intervals with dates and choice sets
  { input: '1541-07-23/[1556,1557]', locale: 'et', expected: '23. juuli 1541 – üks järgmistest: 1556, 1557' },
  { input: '1541-07-23/[1556,1557]', locale: 'en', expected: '23. July 1541 to one of: 1556, 1557' },

  // Level 1: Seasons
  { input: '2001-21', locale: 'et', expected: 'kevad 2001' },
  { input: '2001-22', locale: 'et', expected: 'suvi 2001' },
  { input: '2001-23', locale: 'et', expected: 'sügis 2001' },
  { input: '2001-24', locale: 'et', expected: 'talv 2001' },
  { input: '2001-21', locale: 'en', expected: 'spring 2001' },

  // Level 1: Unspecified digits
  { input: '201X', locale: 'et', expected: '2010 aastakümne' },
  { input: '19XX', locale: 'et', expected: '20. sajand' },
  { input: '14XX', locale: 'en', expected: '15. century' },
  { input: '1985-XX', locale: 'et', expected: 'mõni kuu 1985' },
  { input: '1985-04-XX', locale: 'et', expected: 'mõni päev aprill 1985' },
  { input: '1985-XX-XX', locale: 'et', expected: 'mõni päev 1985' },
  { input: 'XXXX', locale: 'et', expected: 'mõni aasta' },

  // Level 1: Long years
  { input: 'Y170000002', locale: 'et', expected: '170000002' },
  { input: 'Y-170000002', locale: 'et', expected: '-170000002' },

  // Level 2: Exponential years
  { input: 'Y-17E7', locale: 'et', expected: '-170000000' },
  { input: 'Y17E7', locale: 'et', expected: '170000000' },

  // Level 2: Significant digits
  { input: '1950S2', locale: 'et', expected: 'arvatavasti 1950' },
  { input: '1950S2', locale: 'en', expected: 'uncertain 1950' },

  // Level 2: Partial uncertain/approximate (group qualification)
  { input: '2004?-06-11', locale: 'et', expected: '11. juuni arvatavasti 2004' },
  { input: '2004-06~-11', locale: 'et', expected: '11. umbes juuni 2004' },
  { input: '2004?-06-11', locale: 'en', expected: '11. June uncertain 2004' },
  { input: '1979-08~', locale: 'en', expected: 'approximately August 1979' },
  { input: '1879-06~', locale: 'et', expected: 'umbes juuni 1879' },

  // Level 2: Component qualification
  { input: '?2004-06-11', locale: 'et', expected: '11. juuni arvatavasti 2004' },
  { input: '2004-06-~11', locale: 'et', expected: 'umbes 11. juuni 2004' },
  { input: '?2004-06-11', locale: 'en', expected: '11. June uncertain 2004' },

  // Level 2: Partial unspecified
  { input: '156X-12-25', locale: 'et', expected: '25. detsember 156X0 aastakümne' },
  { input: '15XX-12-25', locale: 'et', expected: '25. detsember 15X0 aastakümne' },
  { input: 'XXXX-12-25', locale: 'et', expected: '25. detsember mõni aasta' },

  // Negative years (BCE)
  { input: '-1987', locale: 'et', expected: '20. sajand e.m.a.' },
  { input: '-1850', locale: 'en', expected: '19th century BCE' },

  // Sets (choices)
  { input: '[1667,1668,1670..1672]', locale: 'et', expected: 'üks järgmistest: 1667, 1668, 1670, 1671, 1672' },
  { input: '[2020, 2021]', locale: 'en', expected: 'one of: 2020, 2021' },
  // Long ranges inside a set stay ranges instead of listing every year (#253)
  { input: '[1300..1500,1720..1809]', locale: 'et', expected: 'üks järgmistest: 1300 – 1500, 1720 – 1809' },
  { input: '[1300..1500,1720..1809]', locale: 'en', expected: 'one of: 1300 to 1500, 1720 to 1809' },
  // [..X] / [X..] is a point in time ("on or before"/"on or after"), not a period (#277)
  { input: '[..1984]', locale: 'et', expected: 'enne 1984' },
  { input: '[..1984]', locale: 'en', expected: 'before 1984' },
  { input: '[1984..]', locale: 'et', expected: 'pärast 1984' },
  { input: '[1984..]', locale: 'en', expected: 'after 1984' },
  { input: '[..1543-07-03]', locale: 'et', expected: 'enne 03. juuli 1543' },
  { input: '[1760-01,1760-02,1760-12..]', locale: 'en', expected: 'one of: 1760-01, 1760-02, after December 1760' },
  // Open-ended intervals stay periods; year and full date are worded the same (#277)
  { input: '../1543', locale: 'et', expected: 'kuni 1543' },
  { input: '../1568-07-03', locale: 'et', expected: 'kuni 03. juuli 1568' },
  { input: '/1568-07-03', locale: 'en', expected: 'until 03. July 1568' },
  { input: '1568-07-03/..', locale: 'et', expected: 'alates 03. juuli 1568' },
  { input: '1568-07/..', locale: 'en', expected: 'from July 1568' },
  // % = uncertain and approximate (the converter used to write the invalid ~?)
  { input: '1500%', locale: 'et', expected: 'arvatavasti umbes 1500' },
  { input: '1500%/..', locale: 'en', expected: 'from uncertain approximately 1500' },
  { input: '[1500%..]', locale: 'et', expected: 'pärast arvatavasti umbes 1500' },
  { input: '[..1480%]', locale: 'en', expected: 'before uncertain approximately 1480' },
  // Sets as interval endpoints — DL extension, not in the EDTF spec
  { input: '[1453,1465]/[1462,1473]', locale: 'et', expected: 'üks järgmistest: 1453, 1465 – üks järgmistest: 1462, 1473' },
  { input: '1450/[1462..1470]', locale: 'et', expected: '1450 – üks järgmistest: 1462 – 1470' },

  // Edge cases
  { input: null, locale: 'et', expected: null },
  { input: '', locale: 'et', expected: '' },
  { input: 'invalid', locale: 'et', expected: 'invalid' },
]

describe('parseEDTF', () => {
  it.each(cases)('$input ($locale) -> $expected', ({ input, locale, expected }) => {
    expect(parseEDTF(input, locale)).toBe(expected)
  })
})

describe('EDTF sets with ranges (#253)', () => {
  const valid = ['[1300..1500,1720..1809]', '[1667,1668,1670..1672]', '[..1984]', '[1760-01,1760-12..]', '[1453,1465]/[1462,1473]']

  it.each(valid)('%s is accepted by EDTF_REGEX and isEDTFPattern', (value) => {
    expect(EDTF_REGEX.test(value)).toBe(true)
    expect(isEDTFPattern(value)).toBe(true)
  })

  it('rejects intervals inside a set', () => {
    expect(EDTF_REGEX.test('[1300/1500,1720/1809]')).toBe(false)
    expect(isEDTFPattern('[1300/1500,1720/1809]')).toBe(false)
  })

  it('normalizeEDTF turns intervals inside a set into .. ranges', () => {
    expect(normalizeEDTF('[1300/1500,1720/1809]')).toBe('[1300..1500,1720..1809]')
    expect(normalizeEDTF('[1300/1500, 1720]')).toBe('[1300..1500,1720]')
  })
})
