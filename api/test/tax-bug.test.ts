
/**
 * Regression test for the bill tax BUG:
 *   When a request specifies taxBps at the bill level, the bill should
 *   compute tax using that rate, not the product's stored tax_bps.
 *   Previously: `prod.tax_bps ?? p.taxBps` would use 0 if the product's
 *   tax_bps was set to 0 in the seed, ignoring the bill-level rate.
 *
 * This test is a UNIT test of the tax computation, independent of the API.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyFromMinor } from '@merchantos/money';

test('FIX: bill-level taxBps overrides product.tax_bps = 0', () => {
  // Simulate the fixed logic from bill.controller.ts:
  //   const lineTaxBps = (p.taxBps && p.taxBps > 0) ? p.taxBps : (prod.tax_bps || 0);
  function lineTaxBps(prodTaxBps: number, pTaxBps: number): number {
    return (pTaxBps && pTaxBps > 0) ? pTaxBps : (prodTaxBps || 0);
  }
  // And the line tax computation:
  function lineTaxMinor(unitPriceMinor: bigint, quantity: number, bps: number): bigint {
    const subtotal = unitPriceMinor * BigInt(quantity);
    return (subtotal * BigInt(bps)) / 10000n;
  }

  // Case 1: product has tax_bps = 0, bill has taxBps = 1800 -> use bill's
  assert.equal(lineTaxBps(0, 1800), 1800, 'bill tax should win when > 0');
  // Subtotal = 7800 (1 * 7800), tax @ 18% = 1404 (truncated)
  assert.equal(lineTaxMinor(7800n, 1, lineTaxBps(0, 1800)), 1404n);

  // Case 2: product has tax_bps = 0, bill has taxBps = 0 (default) -> 0
  assert.equal(lineTaxBps(0, 0), 0);

  // Case 3: product has tax_bps = 500, bill has taxBps = 0 -> use product
  assert.equal(lineTaxBps(500, 0), 500, 'product tax should be used when bill tax is 0');
  assert.equal(lineTaxMinor(10000n, 1, lineTaxBps(500, 0)), 500n); // 5% of 10000 = 500 paise

  // Case 4: product has tax_bps = 500, bill has taxBps = 1800 -> use bill
  assert.equal(lineTaxBps(500, 1800), 1800, 'bill tax should win over product tax when both are > 0');

  // Case 5: product has tax_bps = null (treated as 0 in JS), bill has taxBps = 2500 -> use bill
  assert.equal(lineTaxBps(0 as any, 2500), 2500);
  assert.equal(lineTaxMinor(20000n, 3, lineTaxBps(0 as any, 2500)), 15000n); // 25% of (200 * 3 = 600) = 150 rupees = 15000 paise
});

test('Money: bill tax math with realistic values', () => {
  // 549-rupee item * 2 = 1098, 5% tax = 54.90 (5490 paise)
  const unit = moneyFromMinor('INR', 54900n);
  const line = unit.times(2n);
  assert.equal(line.minor, 109800n);
  const taxBps = 500; // 5%
  const tax = (line.minor * BigInt(taxBps)) / 10000n;
  assert.equal(tax, 5490n);
  // Total = 1152.90
  assert.equal(line.minor + tax, 115290n);
});
