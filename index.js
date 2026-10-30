/**
 * EDTF (Extended Date Time Format) Level 1 & 2 Parser
 * Converts EDTF notation to human-readable format
 * Supports Estonian (et) and English (en) translations
 */

/**
 * Single comprehensive regex for EDTF validation.
 * Use this as the Directus field _regex constraint.
 *
 * Building blocks:
 *   D   = -?\d{1,5}(-\d{2}(-\d{2})?)?   (date: YYYY, YYYY-MM, YYYY-MM-DD; supports negative years)
 *   DQ  = D[~?%]?                         (date with optional qualifier)
 *   OD  = \.\.\/?DQ                       (open-date: ..YYYY or ../YYYY)
 *   SM  = \.\.DQ | DQ(\.\.(DQ)?)?          (set member: date, a..b range, ..b or a.. open range)
 *   CS  = \[SM(,SM)*\]                    (EDTF choice set)
 *   START = CS | OD | \.\. | DQ
 *   END   = CS | OD | \.\. | DQ
 *   VALUE = START(\/END)?
 *
 * NB: CS as an interval endpoint (e.g. [1453,1465]/[1462,1473]) is a DL
 * extension — the EDTF spec only shows single dates as interval endpoints.
 */
const RE_DQ = String.raw`-?\d{1,5}(-\d{2}(-\d{2})?)?[~?%]?`
const RE_SM = String.raw`(\.\.${RE_DQ}|${RE_DQ}(\.\.(${RE_DQ})?)?)`
const RE_CS = String.raw`\[${RE_SM}(,${RE_SM})*\]`
const RE_PART = String.raw`(${RE_CS}|\.\.\/?${RE_DQ}|\.\.|${RE_DQ})`
export const EDTF_REGEX = new RegExp(String.raw`^${RE_PART}(\/${RE_PART})?$`)

const MONTH_NAMES = {
  et: {
    1: 'jaanuar',
    2: 'veebruar',
    3: 'märts',
    4: 'aprill',
    5: 'mai',
    6: 'juuni',
    7: 'juuli',
    8: 'august',
    9: 'september',
    10: 'oktoober',
    11: 'november',
    12: 'detsember',
  },
  en: {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December',
  },
}

const SEASON_NAMES = {
  et: {
    21: 'kevad',
    22: 'suvi',
    23: 'sügis',
    24: 'talv',
    25: 'kevad (põhja)',
    26: 'suvi (põhja)',
    27: 'sügis (põhja)',
    28: 'talv (põhja)',
    29: 'kevad (lõuna)',
    30: 'suvi (lõuna)',
    31: 'sügis (lõuna)',
    32: 'talv (lõuna)',
    33: 'kvartal 1',
    34: 'kvartal 2',
    35: 'kvartal 3',
    36: 'kvartal 4',
  },
  en: {
    21: 'spring',
    22: 'summer',
    23: 'autumn',
    24: 'winter',
    25: 'spring (northern)',
    26: 'summer (northern)',
    27: 'autumn (northern)',
    28: 'winter (northern)',
    29: 'spring (southern)',
    30: 'summer (southern)',
    31: 'autumn (southern)',
    32: 'winter (southern)',
    33: 'Q1',
    34: 'Q2',
    35: 'Q3',
    36: 'Q4',
  },
}

const TRANSLATIONS = {
  et: {
    before: 'enne',
    after: 'pärast',
    until: 'kuni',
    from: 'alates',
    approximately: 'umbes',
    uncertain: 'arvatavasti',
    to: '–',
    or: 'või',
    one_of: 'üks järgmistest:',
    uncertain_start: 'algus teadmata',
    uncertain_end: 'lõpp teadmata',
    century: 'sajand',
    year: 'aasta',
    unspecified: 'määramata',
    some_day: 'mõni päev',
    some_month: 'mõni kuu',
    some_year: 'mõni aasta',
    decade: 'aastakümne',
  },
  en: {
    before: 'before',
    after: 'after',
    approximately: 'approximately',
    uncertain: 'uncertain',
    until: 'until',
    from: 'from',
    to: 'to',
    or: 'or',
    one_of: 'one of:',
    uncertain_start: 'unknown start',
    uncertain_end: 'unknown end',
    century: 'century',
    year: 'year',
    unspecified: 'unspecified',
    some_day: 'some day',
    some_month: 'some month',
    some_year: 'some year',
    decade: 'decade',
  },
}

const getSeasonName = (seasonNum, locale) => {
  const num = parseInt(seasonNum, 10)
  return SEASON_NAMES[locale]?.[num] || seasonNum
}

const getMonthName = (monthNum, locale) => {
  const num = parseInt(monthNum, 10)
  return MONTH_NAMES[locale]?.[num] || monthNum
}

const getTranslation = (key, locale) => {
  return TRANSLATIONS[locale]?.[key] || key
}

// Year ranges inside a set ([1670..1672]) are listed year by year when short,
// otherwise shown as a range ([1300..1500] -> "1300 – 1500")
const MAX_EXPANDED_SET_RANGE = 5

/**
 * Format one member of an EDTF set: a date, a..b range, ..b or a.. open range
 */
const formatSetMember = (member, locale) => {
  const m = member.trim()
  // [..X] / [X..] is "on or before" / "on or after" (a point in time, not a period), so
  // it reads "enne X" / "pärast X"; only the ../X interval reads "kuni X"
  if (m.startsWith('..')) return [`${getTranslation('before', locale)} ${parseEDTF(m.slice(2), locale)}`]
  if (m.endsWith('..')) return [`${getTranslation('after', locale)} ${parseEDTF(m.slice(0, -2), locale)}`]
  if (!m.includes('..')) return [m]

  const [start, end] = m.split('..')
  if (/^-?\d+$/.test(start) && /^-?\d+$/.test(end)) {
    const from = parseInt(start, 10)
    const to = parseInt(end, 10)
    if (to >= from && to - from < MAX_EXPANDED_SET_RANGE) {
      return Array.from({ length: to - from + 1 }, (_, i) => String(from + i))
    }
  }
  return [`${start} ${getTranslation('to', locale)} ${end}`]
}

const formatChoiceSet = (input, locale) => {
  const members = input.slice(1, -1).split(',')
  const choices = members.flatMap(member => formatSetMember(member, locale))
  // A lone open-ended member ([..1543]) is a single statement, not a choice
  if (members.length === 1 && /^\s*(\.\.[^.]+|[^.]+\.\.)\s*$/.test(members[0])) return choices[0]
  return `${getTranslation('one_of', locale)} ${choices.join(', ')}`
}

/** "uncertain"/"approximately" words for a ?/~/% qualifier string */
const qualifierWords = (qualifier, locale) => {
  const words = []
  if (/[?%]/.test(qualifier)) words.push(getTranslation('uncertain', locale))
  if (/[~%]/.test(qualifier)) words.push(getTranslation('approximately', locale))
  return words
}

/** "<keyword> [uncertain] [approximately] <value>" */
const withQualifier = (key, qualifier, value, locale) =>
  [getTranslation(key, locale), ...qualifierWords(qualifier, locale), value].join(' ')

/**
 * Parse EDTF string to human-readable format
 * @param {string} edtfString - EDTF formatted date string
 * @param {string} locale - Language code: 'et' or 'en'
 * @returns {string} Formatted date string
 */
export const parseEDTF = (edtfString, locale = 'et') => {
  if (!edtfString || typeof edtfString !== 'string') {
    return edtfString
  }

  const input = edtfString.trim()
  if (!input) return input

  // Open-ended year intervals with optional qualifiers (? ~ %), one block for all four shapes
  // ../YYYY, /YYYY -> kuni; YYYY/.., YYYY/ -> alates; ..YYYY/ -> enne ... lõpp teadmata
  const openYear = input.match(/^(\.\.\/|\/)(\d{4})([?~%]*)$/)
  if (openYear) {
    return withQualifier('until', openYear[3], openYear[2], locale)
  }
  const openEndYear = input.match(/^(\d{4})([?~%]*)(\/\.\.|\/)$/)
  if (openEndYear) {
    return withQualifier('from', openEndYear[2], openEndYear[1], locale)
  }
  const beforeOpenEnd = input.match(/^\.\.(.+?\d)([?~%]*)\/$/)
  if (beforeOpenEnd) {
    const to = getTranslation('to', locale)
    const unknownEnd = getTranslation('uncertain_end', locale)
    return `${withQualifier('before', beforeOpenEnd[2], beforeOpenEnd[1], locale)} ${to} ${unknownEnd}`
  }

  // Pattern: YYYY? (uncertain year)
  if (input.match(/^\d{4}\?$/)) {
    const year = input.replace('?', '')
    const uncertain = getTranslation('uncertain', locale)
    return `${uncertain} ${year}`
  }

  // Pattern: YYYY~ (approximate year)
  if (input.match(/^\d{4}~$/)) {
    const year = input.replace('~', '')
    const approx = getTranslation('approximately', locale)
    return `${approx} ${year}`
  }

  // Pattern: YYYY?~ or YYYY~? or YYYY% (uncertain and approximate)
  if (input.match(/^\d{4}([?~]{2}|%)$/)) {
    const year = input.slice(0, 4)
    return [...qualifierWords(input.slice(4), locale), year].join(' ')
  }

  // Pattern: -YYYY (BCE/negative year)
  if (input.match(/^-\d{4}$/)) {
    const year = Math.abs(parseInt(input, 10))
    const century = Math.ceil(year / 100)
    return locale === 'et'
      ? `${century}. sajand e.m.a.`
      : `${century}th century BCE`
  }

  // Level 1: Seasons (YYYY-21 through YYYY-36) - must come before YYYY-MM
  if (input.match(/^\d{4}-(21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36)$/)) {
    const [year, season] = input.split('-')
    const seasonName = getSeasonName(season, locale)
    return `${seasonName} ${year}`
  }

  // Level 1: Year-month with qualification (e.g., 1979-08~, 2004-06?)
  if (input.match(/^\d{4}-\d{2}[?~%]$/)) {
    const qualifier = input.slice(-1)
    const [year, month] = input.slice(0, -1).split('-')
    const monthName = getMonthName(month, locale)
    let prefix = ''
    if (qualifier === '?') prefix = getTranslation('uncertain', locale) + ' '
    if (qualifier === '~') prefix = getTranslation('approximately', locale) + ' '
    if (qualifier === '%') {
      prefix = getTranslation('uncertain', locale) + ' ' + getTranslation('approximately', locale) + ' '
    }
    return `${prefix}${monthName} ${year}`.trim()
  }

  // Pattern: YYYY-MM (year-month)
  if (input.match(/^\d{4}-\d{2}$/)) {
    const [year, month] = input.split('-')
    const monthName = getMonthName(month, locale)
    return `${monthName} ${year}`
  }

  // Pattern: YYYY-MM-DD (full date)
  if (input.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = input.split('-')
    const monthName = getMonthName(month, locale)
    return `${day}. ${monthName} ${year}`
  }

  // Level 1: Long year simple form (Y followed by more than 4 digits)
  if (input.match(/^Y-?\d{5,}$/)) {
    const year = input.replace('Y', '')
    return year
  }

  // Level 2: Exponential year (Y-17E7)
  if (input.match(/^Y-?\d+E\d+$/)) {
    const match = input.match(/^Y(-?\d+)E(\d+)$/)
    if (match) {
      const base = parseInt(match[1], 10)
      const exp = parseInt(match[2], 10)
      const result = base * Math.pow(10, exp)
      return result.toString()
    }
  }

  // Level 2: Significant digits (1950S2)
  if (input.match(/^\d+S\d+$/)) {
    const match = input.match(/^(\d+)S(\d+)$/)
    if (match) {
      const year = match[1]
      const uncertain = getTranslation('uncertain', locale)
      return `${uncertain} ${year}`
    }
  }

  // Level 1: Unspecified digits (201X, 19XX, 1985-XX, 1985-04-XX, 1985-XX-XX)
  if (input.match(/^\d{0,3}X+$/)) {
    const decade = input.replace(/X+$/, '')
    if (decade.length === 0) {
      return getTranslation('some_year', locale)
    }
    if (decade.length === 3) {
      return `${decade}0 ${getTranslation('decade', locale)}`
    }
    const century = Math.floor(parseInt(decade + '00', 10) / 100) + 1
    return `${century}. ${getTranslation('century', locale)}`
  }
  if (input.match(/^\d{4}-XX$/)) {
    const year = input.split('-')[0]
    return `${getTranslation('some_month', locale)} ${year}`
  }
  if (input.match(/^\d{4}-\d{2}-XX$/)) {
    const [year, month] = input.split('-')
    const monthName = getMonthName(month, locale)
    return `${getTranslation('some_day', locale)} ${monthName} ${year}`
  }
  if (input.match(/^\d{4}-XX-XX$/)) {
    const year = input.split('-')[0]
    return `${getTranslation('some_day', locale)} ${year}`
  }

  // Level 2: Partial uncertain/approximate dates
  // Group qualification: 2004?-06-11 (year uncertain)
  if (input.match(/^\d{4}[?~%]-\d{2}-\d{2}$/)) {
    const qual = input.match(/[?~%]/)[0]
    const cleaned = input.replace(/[?~%]/, '')
    const [year, month, day] = cleaned.split('-')
    const monthName = getMonthName(month, locale)
    let prefix = ''
    if (qual === '?') prefix = getTranslation('uncertain', locale) + ' '
    if (qual === '~') prefix = getTranslation('approximately', locale) + ' '
    if (qual === '%') prefix = getTranslation('uncertain', locale) + ' ' + getTranslation('approximately', locale) + ' '
    return `${day}. ${monthName} ${prefix}${year}`
  }

  // Group qualification: 2004-06~-11 (year and month approximate)
  if (input.match(/^\d{4}-\d{2}[?~%]-\d{2}$/)) {
    const parts = input.split('-')
    const qual = parts[1].match(/[?~%]/)[0]
    const month = parts[1].replace(/[?~%]/, '')
    const year = parts[0]
    const day = parts[2]
    const monthName = getMonthName(month, locale)
    let prefix = ''
    if (qual === '~') prefix = getTranslation('approximately', locale) + ' '
    if (qual === '?') prefix = getTranslation('uncertain', locale) + ' '
    if (qual === '%') prefix = getTranslation('uncertain', locale) + ' ' + getTranslation('approximately', locale) + ' '
    return `${day}. ${prefix}${monthName} ${year}`
  }

  // Component qualification: ?2004-06-11 (year uncertain, rest known)
  if (input.match(/^[?~%]\d{4}-\d{2}-\d{2}$/)) {
    const qual = input[0]
    const cleaned = input.slice(1)
    const [year, month, day] = cleaned.split('-')
    const monthName = getMonthName(month, locale)
    let prefix = ''
    if (qual === '?') prefix = getTranslation('uncertain', locale) + ' '
    if (qual === '~') prefix = getTranslation('approximately', locale) + ' '
    if (qual === '%') prefix = getTranslation('uncertain', locale) + ' ' + getTranslation('approximately', locale) + ' '
    return `${day}. ${monthName} ${prefix}${year}`
  }

  // Component qualification: 2004-06-~11 (day approximate)
  if (input.match(/^\d{4}-\d{2}-[?~%]\d{2}$/)) {
    const parts = input.split('-')
    const qual = parts[2][0]
    const day = parts[2].slice(1)
    const year = parts[0]
    const month = parts[1]
    const monthName = getMonthName(month, locale)
    let prefix = ''
    if (qual === '~') prefix = getTranslation('approximately', locale) + ' '
    if (qual === '?') prefix = getTranslation('uncertain', locale) + ' '
    if (qual === '%') prefix = getTranslation('uncertain', locale) + ' ' + getTranslation('approximately', locale) + ' '
    return `${prefix}${day}. ${monthName} ${year}`
  }

  // Level 2: Partial unspecified (156X-12-25, 15XX-12-25, XXXX-12-XX)
  if (input.match(/^\d{0,3}X+-\d{2}-\d{2}$/)) {
    const [yearPart, month, day] = input.split('-')
    const monthName = getMonthName(month, locale)
    const decade = yearPart.replace(/X+$/, '')
    if (decade.length === 0) {
      return `${day}. ${monthName} ${getTranslation('some_year', locale)}`
    }
    return `${day}. ${monthName} ${decade}X0 ${getTranslation('decade', locale)}`
  }

  // Pattern: Complex intervals with uncertain/approximate/choice sets
  // Examples: ..1700?/1800~, 1700~/1800~, 1541-07-23/[1556,1557]
  if (input.includes('/') && !input.match(/^\d{4}-\d{2}\/\d{4}-\d{2}$/)) {
    const [start, end] = input.split('/')
    const to = getTranslation('to', locale)
    const isOpen = (part) => part === '' || part === '..'

    const formatPart = (part) => {
      // Handle open intervals
      if (part === '..') {
        return getTranslation('uncertain_start', locale)
      }
      if (part === '') {
        return getTranslation('uncertain_end', locale)
      }

      // Handle ..YYYY[?~%]* prefix (open "before YYYY" in a complex interval)
      if (part.match(/^\.\..+\d[?~%]*$/)) {
        const inner = part.replace(/^\.\./, '')
        return withQualifier('before', inner.replace(/[^?~%]/g, ''), inner.replace(/[?~%]/g, ''), locale)
      }

      // Handle choice sets [YYYY,YYYY]
      if (part.match(/^\[.+\]$/)) {
        return formatChoiceSet(part, locale)
      }

      // Handle uncertain/approximate modifiers
      let result = part
      let prefix = ''

      if (result.includes('?')) {
        result = result.replace('?', '')
        prefix += getTranslation('uncertain', locale) + ' '
      }

      if (result.includes('~')) {
        result = result.replace('~', '')
        prefix += getTranslation('approximately', locale) + ' '
      }

      // Handle full dates (YYYY-MM-DD)
      if (result.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = result.split('-')
        const monthName = getMonthName(month, locale)
        return `${prefix}${day}. ${monthName} ${year}`.trim()
      }

      // Handle year-month (YYYY-MM)
      if (result.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = result.split('-')
        const monthName = getMonthName(month, locale)
        return `${prefix}${monthName} ${year}`.trim()
      }

      return `${prefix}${result}`.trim()
    }

    // One open end next to a real date: the open side says nothing about the other
    // ("../1568-07-03" -> "kuni 03. juuli 1568", "1568-07-03/.." -> "alates 03. juuli 1568")
    if (isOpen(start) && !isOpen(end)) return `${getTranslation('until', locale)} ${formatPart(end)}`
    if (isOpen(end) && !isOpen(start)) return `${getTranslation('from', locale)} ${formatPart(start)}`

    const startFormatted = formatPart(start)
    const endFormatted = formatPart(end)

    if (!startFormatted) return endFormatted
    if (!endFormatted) return startFormatted

    return `${startFormatted} ${to} ${endFormatted}`
  }

  // Pattern: YYYY-MM/YYYY-MM (interval with months)
  if (input.match(/^\d{4}-\d{2}\/\d{4}-\d{2}$/)) {
    const [start, end] = input.split('/')
    const [startYear, startMonth] = start.split('-')
    const [endYear, endMonth] = end.split('-')
    const startMonthName = getMonthName(startMonth, locale)
    const endMonthName = getMonthName(endMonth, locale)
    const to = getTranslation('to', locale)

    return `${startMonthName} ${startYear} ${to} ${endMonthName} ${endYear}`
  }

  // Level 2: Choices and sets
  // Pattern: [YYYY, YYYY, ...] (one of these dates)
  if (input.match(/^\[.+\]$/)) {
    return formatChoiceSet(input, locale)
  }

  // Pattern: {YYYY..YYYY} (range with internal uncertainty)
  if (input.match(/^\{.+\.\..+\}$/)) {
    const content = input.slice(1, -1)
    const [start, end] = content.split('..')
    const to = getTranslation('to', locale)
    return `${start.trim()} ${to} ${end.trim()}`
  }

  // Default: return as-is if no pattern matches
  return input
}

/**
 * Check if a string looks like an EDTF date pattern
 * @param {string} str - String to check
 * @returns {boolean} True if string matches EDTF pattern
 */
export const isEDTFPattern = (str) => {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()

  // EDTF patterns we support
  const patterns = [
    // Level 0
    /^\d{4}$/, // YYYY
    /^\d{4}-\d{2}$/, // YYYY-MM
    /^\d{4}-\d{2}[?~%]$/, // YYYY-MM? or YYYY-MM~ or YYYY-MM%
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}\/\d{4}$/, // YYYY/YYYY interval

    // Level 1: Open/unknown intervals
    /^\.\.\/\d{4}[?~]*$/, // ../YYYY or ../YYYY? or ../YYYY~
    /^\d{4}[?~]*\/\.\.$/, // YYYY/.. or YYYY~/.. or YYYY?/..

    // Level 1: Uncertain/Approximate
    /^\d{4}[?~%]+$/, // YYYY? or YYYY~ or YYYY?~
    /^\d{4}[?~]*\/\d{4}[?~]*$/, // YYYY/YYYY or YYYY~/YYYY~ or YYYY?/YYYY? etc.

    // Level 1: BCE/Negative years
    /^-\d{4}$/, // -YYYY

    // Level 1: Seasons
    /^\d{4}-(21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36)$/, // YYYY-SS

    // Level 1: Long year
    /^Y-?\d{5,}$/, // Y170000002 or Y-170000002

    // Level 1: Unspecified digits
    /^\d{0,3}X+$/, // 201X, 19XX, XXXX
    /^\d{4}-XX$/, // YYYY-XX
    /^\d{4}-\d{2}-XX$/, // YYYY-MM-XX
    /^\d{4}-XX-XX$/, // YYYY-XX-XX

    // Level 2: Exponential year
    /^Y-?\d+E\d+$/, // Y-17E7

    // Level 2: Significant digits
    /^\d+S\d+$/, // 1950S2

    // Level 2: Partial uncertain/approximate (group qualification)
    /^\d{4}[?~%]-\d{2}-\d{2}$/, // 2004?-06-11
    /^\d{4}-\d{2}[?~%]-\d{2}$/, // 2004-06~-11

    // Level 2: Component qualification
    /^[?~%]\d{4}-\d{2}-\d{2}$/, // ?2004-06-11
    /^\d{4}-\d{2}-[?~%]\d{2}$/, // 2004-06-~11
    /^\d{4}-[?~%]\d{2}$/, // 2004-~06

    // Level 2: Partial unspecified
    /^\d{0,3}X+-\d{2}-\d{2}$/, // 156X-12-25, XXXX-12-XX
    /^\d{4}-\d{1}X$/, // 1984-1X (Oct, Nov, or Dec)

    // Intervals with .. prefix on end date (meaning "no later than")
    /^\d{4}-\d{2}-\d{2}[?~]*\/\.\.\d{4}-\d{2}-\d{2}[?~]*$/, // YYYY-MM-DD/..YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}[?~]*\/\.\.\d{4}-\d{2}[?~]*$/, // YYYY-MM-DD/..YYYY-MM
    /^\d{4}-\d{2}-\d{2}[?~]*\/\.\.\d{4}[?~]*$/, // YYYY-MM-DD/..YYYY
    /^\d{4}-\d{2}[?~]*\/\.\.\d{4}-\d{2}-\d{2}[?~]*$/, // YYYY-MM/..YYYY-MM-DD
    /^\d{4}-\d{2}[?~]*\/\.\.\d{4}-\d{2}[?~]*$/, // YYYY-MM/..YYYY-MM
    /^\d{4}-\d{2}[?~]*\/\.\.\d{4}[?~]*$/, // YYYY-MM/..YYYY
    /^\d{4}[?~]*\/\.\.\d{4}-\d{2}-\d{2}[?~]*$/, // YYYY/..YYYY-MM-DD
    /^\d{4}[?~]*\/\.\.\d{4}-\d{2}[?~]*$/, // YYYY/..YYYY-MM
    /^\d{4}[?~]*\/\.\.\d{4}[?~]*$/, // YYYY/..YYYY
    /^\d{4}-\d{2}-\d{2}\/\[.+\]$/, // YYYY-MM-DD/[YYYY,YYYY]

    // Mixed intervals: open start with full date end
    /^\.\.\/\d{4}-\d{2}-\d{2}[?~]*$/, // ../YYYY-MM-DD or ../YYYY-MM-DD?
    /^\.\.\/\d{4}-\d{2}[?~]*$/, // ../YYYY-MM or ../YYYY-MM?

    // Mixed intervals: year-only start with date end
    /^\d{4}[?~]*\/\d{4}-\d{2}-\d{2}[?~]*$/, // YYYY/YYYY-MM-DD or YYYY/YYYY-MM-DD?
    /^\d{4}[?~]*\/\d{4}-\d{2}[?~]*$/, // YYYY/YYYY-MM or YYYY/YYYY-MM?

    // Full date to full date intervals
    /^\d{4}-\d{2}-\d{2}[?~]*\/\d{4}-\d{2}-\d{2}[?~]*$/, // YYYY-MM-DD/YYYY-MM-DD
    /^\d{4}-\d{2}[?~]*\/\d{4}-\d{2}[?~]*$/, // YYYY-MM/YYYY-MM

    // Mixed intervals: date start with year-only end
    /^\d{4}-\d{2}-\d{2}[?~]*\/\d{4}[?~]*$/, // YYYY-MM-DD/YYYY or YYYY-MM-DD?/YYYY
    /^\d{4}-\d{2}[?~]*\/\d{4}[?~]*$/, // YYYY-MM/YYYY

    // Sets
    /^\{\d{4}(,\d{4})+\}$/, // {YYYY,YYYY,YYYY}
    /^\[\d{4}(,\d{4})+\]$/, // [YYYY,YYYY]
    /^\[\d{4}\.\.\d{4}\]$/, // [YYYY..YYYY]
    /^\[\.\..*\]$/, // [..YYYY-MM-DD]
    new RegExp(String.raw`^${RE_CS}$`), // [1300..1500,1720..1809], [1760-01,1760-12..]
    new RegExp(String.raw`^${RE_CS}\/${RE_PART}$`), // [1453,1465]/[1462,1473] (DL extension)
    new RegExp(String.raw`^${RE_PART}\/${RE_CS}$`), // 1450/[1462,1473] (DL extension)

    // Additional open interval shorthands
    /^\/\d{4}[?~]*$/, // /YYYY - until YYYY
    /^\d{4}[?~]*\/$/, // YYYY/ - from YYYY
    /^\.\.\d{4}[?~]*\/$/, // ..YYYY/ - before YYYY, open end
  ]

  return patterns.some(pattern => pattern.test(trimmed))
}

/**
 * Parse EDTF value, handling arrays and nested structures
 * @param {string|array} value - EDTF value (string or array)
 * @param {string} locale - Language code: 'et' or 'en'
 * @returns {string|array} Parsed value
 */
export const parseEDTFValue = (value, locale = 'et') => {
  if (Array.isArray(value)) {
    return value.map(v => parseEDTFValue(v, locale))
  }
  if (typeof value === 'object' && value !== null) {
    return value // Return objects as-is
  }
  return parseEDTF(value, locale)
}

/**
 * Normalize a raw CSV date string into a valid EDTF string.
 * Handles common formatting variants found in spreadsheet input:
 *   "~1435"       → "1435~"       (qualifier prefix → suffix)
 *   "1470-1473"   → "1470/1473"   (year range → EDTF interval)
 *   "1483, 1520"  → "[1483,1520]" or "1483/1520" (comma-separated → set or interval)
 *   "..1533"      → "../1533"     (open start shorthand)
 *   "1533.."      → "1533/.."     (open end shorthand)
 *
 * Uses EDTF_REGEX internally to validate candidate normalizations.
 *
 * @param {string} raw - Raw date value from CSV
 * @param {{ allowSetNotation?: boolean }} options
 *   allowSetNotation: if true, comma-separated years may be returned as [a,b] EDTF set;
 *   otherwise falls back to interval notation.
 * @returns {string} Normalized EDTF string, or the original value if no rule matched.
 */
export const normalizeEDTF = (raw, { allowSetNotation = false } = {}) => {
  if (raw === undefined || raw === null) return raw
  let val = String(raw).trim()
  if (!val) return raw

  // Normalize spaces inside set/choice notation: "[1312, 1313]" -> "[1312,1313]"
  if (val.startsWith('[') && val.endsWith(']')) {
    const cleaned = val.replace(/\[\s*(.*?)\s*\]/, (_, inner) => {
      const normalized = inner.split(',').map(p => p.trim()).join(',')
      return `[${normalized}]`
    })
    if (cleaned !== val) {
      console.warn(`⚠️  EDTF tühikud eemaldatud: "${val}" -> "${cleaned}"`)
      val = cleaned
    }
  }

  // Intervals inside a set are not valid EDTF: "[1300/1500,1720/1809]" -> "[1300..1500,1720..1809]"
  if (/^\[[^\]]*\/[^\]]*\]$/.test(val)) {
    const ranged = val.replace(/\//g, '..')
    console.warn(`⚠️  EDTF set'i intervallid teisendatud: "${val}" -> "${ranged}"`)
    val = ranged
  }

  const isValid = s => EDTF_REGEX.test(String(s))

  const pickSingleMarker = (markers) => {
    if (!markers) return ''
    const s = String(markers)
    if (s.includes('?')) return '?'
    if (s.includes('~')) return '~'
    if (s.includes('%')) return '%'
    return ''
  }

  const normalizeToken = (token) => {
    if (token === undefined || token === null) return token
    let t = String(token).trim()
    if (!t) return t

    // "..~1547" -> "../1547~" (open start + marker)
    const openStartMarked = t.match(/^\.{2}([~?%]+)(\d.*)$/)
    if (openStartMarked) {
      const mark = pickSingleMarker(openStartMarked[1])
      const rest = openStartMarked[2]
      return `../${rest}${mark}`
    }

    // Leading markers -> move to suffix
    const lead = t.match(/^([~?%]+)(.*)$/)
    if (lead && /^\d|\.\./.test(lead[2])) {
      t = `${lead[2]}${lead[1]}`
    }

    // Collapse multiple trailing markers to a single one
    const tail = t.match(/^(.*?)([~?%]+)$/)
    if (tail) {
      const mark = pickSingleMarker(tail[2])
      t = `${tail[1]}${mark}`
    }

    return t
  }

  // Mixed comma list with intervals: "1530, 1545/1550" -> "1530/1550"
  if (val.includes(',') && val.includes('/')) {
    const parts = val.split(',').map(p => p.trim()).filter(p => p.length > 0)
    const first = parts[0]
    const last = parts[parts.length - 1]
    const firstStart = normalizeToken(first.split('/')[0])
    const lastEnd = normalizeToken(last.includes('/') ? last.split('/')[1] : last)
    const asInterval = `${String(firstStart).replace(/[~?%]+$/, '')}/${String(lastEnd).replace(/[~?%]+$/, '')}`
    if (isValid(asInterval)) return asInterval
  }

  // Normalize YYYY/MM to YYYY-MM (year-month format, not interval)
  const yearMonth = val.match(/^(\d{1,5})\/(\d{1,2})([~?%]*)$/)
  if (yearMonth) {
    const month = parseInt(yearMonth[2], 10)
    if (month >= 1 && month <= 12 && yearMonth[2].length <= 2) {
      const paddedMonth = String(month).padStart(2, '0')
      return `${yearMonth[1]}-${paddedMonth}${yearMonth[3] || ''}`
    }
  }

  // Normalize open-ended range shorthand:
  // "1533.." -> "1533/.."
  const openEnd = val.match(/^(\d{1,5})(\.\.)([~?%]*)$/)
  if (openEnd) return `${openEnd[1]}/..${openEnd[3] || ''}`

  // Pattern: ..YYYY/ (open start before YYYY, open end)
  const openBoth = val.match(/^(\.\.)(\d{1,5})([~?%]*)\//)
  if (openBoth) return `..${openBoth[2]}${openBoth[3] || ''}/`

  // Pattern: ..YYYY (before YYYY, no trailing slash) -> ../YYYY
  const openStart = val.match(/^(\.\.)(\d{1,5})([~?%]*)$/)
  if (openStart) {
    const normalized = `../${openStart[2]}${openStart[3] || ''}`
    console.log(`📅 Normaliseerin date_string: "${val}" -> "${normalized}" (openStart match)`)
    return normalized
  }

  // Normalize simple year-year range: "1470-1473" -> "1470/1473"
  // BUT: Don't convert YYYY-MM (year-month) format to interval
  const yearRange = val.match(/^(\d{1,5})-(\d{1,5})([~?%]*)$/)
  if (yearRange) {
    const second = yearRange[2]
    if (second.length <= 2 && parseInt(second, 10) <= 12) return val
    return `${yearRange[1]}/${yearRange[2]}${yearRange[3] || ''}`
  }

  // Normalize comma-separated years to EDTF set or interval notation
  if (val.includes(',')) {
    const parts = val.split(',').map(p => p.trim()).filter(p => p.length > 0)
    if (
      parts.length >= 2
      && parts.every(p => /^-?\d{1,5}(?:-\d{2})?(?:-\d{2})?[~?%]?$/.test(p))
    ) {
      const asSet = `[${parts.join(',')}]`
      if (allowSetNotation && isValid(asSet)) return asSet

      const stripSuffix = s => String(s).replace(/[~?%]+$/, '')
      const asInterval = `${stripSuffix(parts[0])}/${stripSuffix(parts[parts.length - 1])}`
      if (isValid(asInterval)) return asInterval

      return allowSetNotation ? asSet : asInterval
    }
  }

  // General cleanup: normalize each side of an interval token-by-token
  if (val.includes('/')) {
    const [a, b] = val.split('/', 2)
    const na = normalizeToken(a)
    const nb = b !== undefined ? normalizeToken(b) : b
    const result = nb !== undefined ? `${na}/${nb}` : na
    if (result !== val) {
      console.log(`📅 Normaliseerin intervall: "${val}" -> "${result}" (a="${a}"->"${na}", b="${b}"->"${nb}")`)
    }
    return result
  }

  const result = normalizeToken(val)
  if (result !== val) {
    console.log(`📅 Normaliseerin date_string (normalizeToken): "${val}" -> "${result}"`)
  }
  return result
}
