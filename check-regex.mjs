// Test EDTF_REGEX (exported from this package) against known valid and invalid values.
// Run: node check-regex.mjs
//
// Use this to verify the regex before copying it into a Directus field _regex constraint.

import { EDTF_REGEX } from './index.js'

console.log('EDTF_REGEX:', EDTF_REGEX.source)
console.log()

// Values that were previously failing and should now pass
const shouldPass = [
    // Choice sets as interval end
    ['1303/[1312,1313]', 'choice set end'],
    ['1234?/[1236,1237,1242]', 'choice set end'],
    ['1500-02-23/[1500-11-04,1500-11-05]', 'choice set full-date end'],
    ['1507/[1518,1520]', 'choice set end'],
    ['1541-07-23/[1556,1557]', 'choice set end'],
    ['1541-08-26/[1556,1557]', 'choice set end'],
    ['1546/[1549,1550]', 'choice set end'],
    // Choice set as interval start
    ['[1549,1550]/1560~', 'choice set start'],
    // Open+bounded start (..YYYY/YYYY)
    ['..1300/1321?', 'open+year start, uncertain end'],
    ['..1470/1473', 'open+year start'],
    ['..1287/1314-11-26', 'open+year start, full date end'],
    // Interval ending with ..YYYY-MM-DD
    ['1399/..1404-10-21', 'end = ..full-date'],
    ['1417-11-26/..1422-03-30', 'end = ..full-date'],
    ['..1473-03-13/..1485-02-24', 'start and end = ..full-date'],
    ['1439-03-20/..1457-03-07', 'end = ..full-date'],
]

// Valid values that must still pass
const mustStillPass = [
    ['1303/1313', 'simple interval'],
    ['1399/1404-10-21', 'date interval'],
    ['../1300', 'open before year (slash form)'],
    ['..1300', 'open before year (no slash)'],
    ['../1473-03-13', 'open before full date'],
    ['1321?', 'uncertain year'],
    ['1321~', 'approx year'],
    ['1557-05-02~', 'approx full date'],
    ['1514-07-16?', 'uncertain full date'],
    ['1985/..', 'open end'],
    ['[1556,1557]', 'standalone choice set'],
    ['1985', 'plain year'],
    ['1985-06', 'year-month'],
    ['1985-06-11', 'full date'],
]

// Values that must NOT match
const mustFail = [
    ['', 'empty string'],
    ['abc', 'non-date string'],
    ['1985-13', 'invalid month 13'],
    ['1985/1990/1995', 'triple slash'],
]

let allOk = true
console.log('--- Väärtused, mis peavad läbima ---')
for (const [v, desc] of shouldPass) {
    const ok = EDTF_REGEX.test(v)
    console.log(ok ? '  OK' : 'FAIL', JSON.stringify(v), '(' + desc + ')')
    if (!ok) allOk = false
}

console.log()
console.log('--- Põhiväärtused ---')
for (const [v, desc] of mustStillPass) {
    const ok = EDTF_REGEX.test(v)
    console.log(ok ? '  OK' : 'FAIL', JSON.stringify(v), '(' + desc + ')')
    if (!ok) allOk = false
}

console.log()
console.log('--- Väärtused, mis ei tohi läbida ---')
for (const [v, desc] of mustFail) {
    const ok = EDTF_REGEX.test(v)
    console.log(!ok ? '  OK (rejected)' : 'FAIL (should reject)', JSON.stringify(v), '(' + desc + ')')
    if (ok) allOk = false
}

console.log()
console.log(allOk ? '✅ Kõik testid läbitud!' : '❌ Mõned testid ebaõnnestusid!')
