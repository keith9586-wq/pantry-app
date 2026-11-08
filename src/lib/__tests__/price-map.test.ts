/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheaperNearby, cheaperText, normalizeStore, reportsFromReceipt, zip3, type AreaPrice } from '../priceMap';
import { parseReceiptStore } from '../receipt';

test('only the first three ZIP digits are ever used', () => {
  assert.equal(zip3('94110'), '941');
  assert.equal(zip3('94110-1234'), '941');
  assert.equal(zip3('9411'), null);
  assert.equal(zip3('abcde'), null);
});

test('store names lose numbers and addresses', () => {
  assert.equal(normalizeStore('ALDI #1234'), 'Aldi');
  assert.equal(normalizeStore("TRADER JOE'S 123 MAIN ST"), "Trader Joe's");
  assert.equal(normalizeStore('Safeway Store 0987'), 'Safeway');
  assert.equal(normalizeStore('Whole Foods Market'), 'Whole Foods Market');
  assert.equal(normalizeStore(null), null);
  assert.equal(normalizeStore('#12'), null);
});

test('receipts become per-unit reports with no personal data', () => {
  const lines = [
    { name: 'Large eggs', quantity: 12, unit: 'each', category: 'eggs' as const, price: 3.6 },
    { name: 'Bananas', quantity: 2, unit: 'lb', category: 'produce' as const, price: 1.18 },
    { name: 'Bag fee', quantity: 1, unit: 'each', category: 'other' as const },
  ];
  const r = reportsFromReceipt(lines, 'ALDI #44', '94110');
  assert.deepEqual(r, [
    { zip3: '941', store: 'Aldi', key: 'egg', unit: 'each', unit_price: 0.3 },
    { zip3: '941', store: 'Aldi', key: 'banana', unit: 'lb', unit_price: 0.59 },
  ]);
  assert.deepEqual(reportsFromReceipt(lines, null, '94110'), []);
  assert.deepEqual(reportsFromReceipt(lines, 'Aldi', ''), []);
});

test('cheaper nearby compares the same item and unit with what you last paid', () => {
  const history = {
    egg: { name: 'Eggs', points: [{ at: '2026-11-01T00:00:00Z', unitPrice: 0.4, unit: 'each' }] },
    milk: { name: 'Milk', points: [{ at: '2026-11-01T00:00:00Z', unitPrice: 3.5, unit: 'gal' }] },
    banana: { name: 'Bananas', points: [{ at: '2026-11-01T00:00:00Z', unitPrice: 0.59, unit: 'lb' }] },
  };
  const row = (key: string, unit: string, store: string, unit_price: number): AreaPrice => ({
    zip3: '941', key, unit, store, unit_price, reporters: 3, last_seen: '2026-11-05',
  });
  const area = [
    row('egg', 'each', 'Aldi', 0.25),
    row('egg', 'each', 'Safeway', 0.33),
    row('milk', 'gal', 'Costco', 3.3), // under 10% cheaper: not worth a trip
    row('banana', 'each', 'Aldi', 0.2), // different unit
  ];
  const c = cheaperNearby(history, area);
  assert.deepEqual(c.map((x) => [x.name, x.store, x.saving]), [['Eggs', 'Aldi', 0.15]]);
  assert.equal(cheaperText(c[0]), 'Eggs: $0.25 at Aldi near you, vs $0.40 you paid.');
});

test('the receipt reader passes the store through', () => {
  assert.equal(parseReceiptStore({ store: ' Aldi ', items: [] }), 'Aldi');
  assert.equal(parseReceiptStore({ store: null }), null);
  assert.equal(parseReceiptStore(null), null);
});
