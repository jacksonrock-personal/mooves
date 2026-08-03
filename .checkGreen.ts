import { computeExpiresAt, STATUS_TIMES, statusTimeLabel, isStatusTime } from '@/lib/greenExpiry'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗ FAIL', n)) }
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`

console.log('chip list')
ok('five chips, tomorrow between tonight and week',
  JSON.stringify(STATUS_TIMES) === JSON.stringify(['now', 'tonight', 'tomorrow', 'week', 'weekend']))
ok('this week survived', STATUS_TIMES.includes('week'))
ok('now survived', STATUS_TIMES.includes('now'))
ok('label resolves', statusTimeLabel('tomorrow') === 'Tomorrow')
ok('unknown label is null', statusTimeLabel('someday') === null)
ok('isStatusTime rejects junk', !isStatusTime('someday') && isStatusTime('tomorrow'))

console.log('tomorrow expiry')
// Monday 2026-08-03, 10:00 → tomorrow is Tue 4th → covered through Wed 5th 3am
const monDay = new Date(2026, 7, 3, 10)
ok(`Mon 10am → Wed 3am (${fmt(computeExpiresAt('tomorrow', monDay))})`,
  fmt(computeExpiresAt('tomorrow', monDay)) === '2026-08-05 03:00')
// The boundary that would break a next3am-based implementation: after midnight,
// "tonight" is already nearly over, so tomorrow must still be Tuesday.
const monLate = new Date(2026, 7, 3, 1)
ok(`Mon 1am → Wed 3am, not Tue (${fmt(computeExpiresAt('tomorrow', monLate))})`,
  fmt(computeExpiresAt('tomorrow', monLate)) === '2026-08-05 03:00')
ok('tomorrow always outlasts tonight',
  computeExpiresAt('tomorrow', monDay) > computeExpiresAt('tonight', monDay) &&
  computeExpiresAt('tomorrow', monLate) > computeExpiresAt('tonight', monLate))
ok('month rollover is handled',
  fmt(computeExpiresAt('tomorrow', new Date(2026, 7, 30, 10))) === '2026-09-01 03:00')
ok('year rollover is handled',
  fmt(computeExpiresAt('tomorrow', new Date(2026, 11, 30, 10))) === '2027-01-01 03:00')

console.log('the others are untouched')
ok('now → +4h', computeExpiresAt('now', monDay).getTime() - monDay.getTime() === 4 * 3600_000)
ok('tonight → Tue 3am', fmt(computeExpiresAt('tonight', monDay)) === '2026-08-04 03:00')
ok('week → Fri 3am', fmt(computeExpiresAt('week', monDay)) === '2026-08-07 03:00')
ok('weekend → Mon 3am', fmt(computeExpiresAt('weekend', monDay)) === '2026-08-10 03:00')
ok('no chip → +24h', computeExpiresAt(null, monDay).getTime() - monDay.getTime() === 24 * 3600_000)

console.log('server bound')
const MAX = 8 * 24 * 3600_000
ok('every chip stays inside the 8-day server bound',
  STATUS_TIMES.every(t => computeExpiresAt(t, monDay).getTime() - monDay.getTime() <= MAX))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
