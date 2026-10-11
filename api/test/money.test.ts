// Money arithmetic tests. No float. BigInt minor units only.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Money, moneyFromMinor, sumMoney, CurrencyMismatchError, NegativeMinorError } from '@merchantos/money';

test('Money.fromMinor stores exact paise', () => {
  const m = Money.fromMinor('INR', 10050n);
  assert.equal(m.currency, 'INR');
  assert.equal(m.minor, 10050n);
  assert.equal(m.toString(), '10050 INR');
});

test('Money rejects negative minor', () => {
  assert.throws(() => Money.fromMinor('INR', -1n), NegativeMinorError);
});

test('Money rejects non-3-letter currency', () => {
  assert.throws(() => Money.fromMinor('IN', 100n), /3-letter/);
});

test('Money.plus exact, no float drift', () => {
  // The classic 0.1 + 0.2 != 0.3 trap, in paise.
  // 0.1 INR = 10n paise, 0.2 INR = 20n paise, 0.3 INR = 30n paise.
  const a = moneyFromMinor('INR', 10n);
  const b = moneyFromMinor('INR', 20n);
  const sum = a.plus(b);
  assert.equal(sum.minor, 30n);
  assert.equal(sum.currency, 'INR');
});

test('Money.plus across 549 rupee items stays exact', () => {
  // 549 * 3 = 1647 rupees, 164700 paise.
  const unit = moneyFromMinor('INR', 54900n); // 549 rupees
  const total = unit.times(3n);
  assert.equal(total.minor, 164700n);
});

test('Money.minus refuses different currency', () => {
  const a = moneyFromMinor('INR', 100n);
  const b = moneyFromMinor('USD', 50n);
  assert.throws(() => a.minus(b), CurrencyMismatchError);
});

test('sumMoney accumulates 1000 items without drift', () => {
  const items = Array.from({ length: 1000 }, () => moneyFromMinor('INR', 549n));
  const total = sumMoney(items, 'INR');
  assert.equal(total.minor, 549000n);
});

test('Money.equals is currency AND value', () => {
  const a = moneyFromMinor('INR', 100n);
  const b = moneyFromMinor('INR', 100n);
  const c = moneyFromMinor('USD', 100n);
  assert.ok(a.equals(b));
  assert.ok(!a.equals(c));
});

test('toJSON serializes minor as string (preserves bigint precision)', () => {
  const m = moneyFromMinor('INR', 100n);
  const j = m.toJSON();
  assert.equal(j.currency, 'INR');
  assert.equal(j.minor, '100');
  // Roundtrip via JSON: bigint comes back as string, no precision loss.
  const round = JSON.parse(JSON.stringify(j));
  assert.equal(round.minor, '100');
});

test('times by quantity preserves bigint (no JS number overflow)', () => {
  // 1 INR * 2^53 would overflow JS Number; bigint handles it.
  const huge = (1n << 60n);
  const m = moneyFromMinor('INR', 1n);
  const r = m.times(huge);
  assert.equal(r.minor, huge);
});
