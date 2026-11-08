/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adviceTag, adviceText, buySizeAdvice } from '../buysize';
import { eventToRow, rowToEvent } from '../../sync/rows';
import type { WasteEntry } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-10T12:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();

const e = (over: Partial<WasteEntry>): WasteEntry => ({
  name: 'Spinach',
  key: 'spinach',
  at: ago(10),
  outcome: 'used',
  quantity: 2,
  unit: 'lb',
  share: 0,
  ...over,
});

test('a little waste now and then is not worth advice', () => {
  const log = [
    e({ at: ago(5), outcome: 'tossed', share: 0.5, price: 2.5 }),
    e({ at: ago(20), outcome: 'tossed', share: 0.5, price: 2.5 }),
    e({ at: ago(40), outcome: 'used', price: 5 }),
    e({ at: ago(55), outcome: 'used', price: 5 }),
    e({ at: ago(58), outcome: 'tossed', share: 0.2, price: 1 }),
  ];
  // 1.2 of 5 bags thrown out is 24%, under the 25% bar.
  assert.equal(buySizeAdvice(log, NOW).length, 0);
});

test('a third thrown out: 2 lb becomes 1.25 lb, with money per month', () => {
  const log = [
    e({ at: ago(5), outcome: 'tossed', share: 0.5, price: 3 }),
    e({ at: ago(30), outcome: 'tossed', share: 0.5, price: 3 }),
    e({ at: ago(55), outcome: 'used', price: 6 }),
  ];
  const [a] = buySizeAdvice(log, NOW);
  assert.equal(a.wasteShare, 0.33);
  assert.deepEqual(a.usual, { quantity: 2, unit: 'lb' });
  assert.deepEqual(a.suggested, { quantity: 1.25, unit: 'lb' });
  assert.equal(a.wastedPerMonth, round(6 / (55 / 30)));
  assert.equal(adviceText(a), `You throw out about a third of the spinach you buy, about $${a.wastedPerMonth.toFixed(2)} a month. Try 1.25 lb instead of 2 lb.`);
  assert.equal(adviceTag(a), 'buy 1.25 lb, not 2 lb');
});

const round = (n: number) => Math.round(n * 100) / 100;

test('counted items round to whole numbers', () => {
  const eggs = (over: Partial<WasteEntry>) => e({ name: 'Eggs', key: 'egg', unit: 'each', quantity: 18, ...over });
  const [a] = buySizeAdvice([eggs({ outcome: 'tossed', share: 0.5 }), eggs({ outcome: 'tossed', share: 0.5 }), eggs({})], NOW);
  assert.deepEqual(a.suggested, { quantity: 12, unit: 'each' });
  assert.equal(adviceTag(a), 'buy 12, not 18');
});

test('no advice without enough history, for food that gets eaten, or for old entries', () => {
  assert.equal(buySizeAdvice([e({ outcome: 'tossed', share: 1 }), e({ outcome: 'tossed', share: 1 })], NOW).length, 0);
  assert.equal(buySizeAdvice([e({}), e({}), e({}), e({ outcome: 'tossed', share: 0.2 })], NOW).length, 0);
  const old = [e({ at: ago(200), outcome: 'tossed', share: 1 }), e({ at: ago(201), outcome: 'tossed', share: 1 }), e({ at: ago(202) })];
  assert.equal(buySizeAdvice(old, NOW).length, 0);
  // Entries from before this feature have no share and are ignored.
  assert.equal(buySizeAdvice([{ name: 'Milk', at: ago(1), outcome: 'tossed' }], NOW).length, 0);
});

test('without sizes the advice is generic', () => {
  const plain = (over: Partial<WasteEntry>) => e({ quantity: undefined, unit: undefined, ...over });
  const [a] = buySizeAdvice([plain({ outcome: 'tossed', share: 1 }), plain({ outcome: 'tossed', share: 1 }), plain({})], NOW);
  assert.equal(a.suggested, undefined);
  assert.match(adviceText(a), /A smaller pack/);
});

test('event details survive sync', () => {
  const ev = { id: 'x', ...e({ outcome: 'tossed', share: 0.5, price: 2 }) };
  assert.deepEqual(rowToEvent(eventToRow(ev, 'h')), ev);
  const bare = { id: 'y', name: 'Milk', at: ago(1), outcome: 'used' as const, price: undefined };
  assert.deepEqual(rowToEvent(eventToRow(bare, 'h')), bare);
});
