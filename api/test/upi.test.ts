import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upiString } from '@merchantos/qr';

test('UPI payload contains an exact INR amount without floating-point conversion', () => {
  const uri = upiString({
    vpa: 'merchant123@okaxis',
    payeeName: 'Example Store',
    amountMinor: '900719925474099312345',
    currency: 'INR',
    txnRef: '01H00000000000000000000001',
  });
  const url = new URL(uri);
  assert.equal(url.protocol, 'upi:');
  assert.equal(url.hostname, 'pay');
  assert.equal(url.searchParams.get('pa'), 'merchant123@okaxis');
  assert.equal(url.searchParams.get('pn'), 'Example Store');
  assert.equal(url.searchParams.get('am'), '9007199254740993123.45');
  assert.equal(url.searchParams.get('cu'), 'INR');
  assert.equal(url.searchParams.get('tr'), '01H00000000000000000000001');
});

test('UPI payload rejects invalid virtual payment addresses', () => {
  assert.throws(() => upiString({
    vpa: 'not-a-vpa',
    payeeName: 'Example Store',
    amountMinor: '100',
    currency: 'INR',
    txnRef: 'session-1',
  }), /VPA|UPI ID/i);
});

test('UPI payload rejects zero/negative amounts', () => {
  for (const amountMinor of ['0', '-1']) {
    assert.throws(() => upiString({
      vpa: 'merchant123@okaxis',
      payeeName: 'Example Store',
      amountMinor,
      currency: 'INR',
      txnRef: 'session-1',
    }), /positive/i);
  }
});

test('UPI payload refuses non-INR currencies', () => {
  assert.throws(() => upiString({
    vpa: 'merchant123@okaxis',
    payeeName: 'Example Store',
    amountMinor: '100',
    currency: 'USD',
    txnRef: 'session-1',
  }), /INR/i);
});
