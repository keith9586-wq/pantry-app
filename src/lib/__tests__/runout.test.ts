/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPurchaseDate, buyInterval, dueWithin, forecastRunOuts, nudgeTime, purchaseDates, runOutLabel, usualShopDay } from '../runout';
import type { InventoryItem } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 20, 12); // a Friday
const ago = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();

test('purchase days are kept once per day, newest first, capped', () => {
  let dates: string[] | undefined;
  dates = addPurchaseDate(dates, new Date(2026, 10, 1, 9));
  dates = addPurchaseDate(dates, new Date(2026, 10, 1, 18));
  dates = addPurchaseDate(dates, new Date(2026, 10, 5));
  assert.equal(dates.length, 2);
  assert.ok(dates[0] > dates[1]);
  for (let i = 0; i < 20; i++) dates = addPurchaseDate(dates, new Date(2026, 9, i + 1));
  assert.equal(dates.length, 10);
});

test('the buying rhythm is the median gap and needs three purchases', () => {
  assert.equal(buyInterval([ago(0), ago(9)]), null);
  assert.equal(buyInterval([ago(8), ago(17), ago(26), ago(40)]), 9);
});

test('eggs bought every 9 days, last 8 days ago, are due tomorrow', () => {
  const counts = {
    egg: { name: 'Eggs', category: 'eggs' as const, count: 3, dates: [ago(8), ago(17), ago(26)] },
    milk: { name: 'Milk', category: 'dairy' as const, count: 3, dates: [ago(1), ago(8), ago(15)] },
    once: { name: 'Saffron', category: 'other' as const, count: 1, dates: [ago(3)] },
  };
  const f = forecastRunOuts(counts, {}, [], NOW);
  assert.deepEqual(f.map((r) => [r.name, r.dueIn]), [['Eggs', 1], ['Milk', 6]]);
  assert.equal(runOutLabel(f[0]), 'every 9 days · last 8 days ago');
  assert.deepEqual(dueWithin(f, 1).map((r) => r.name), ['Eggs']);
});

test('a fresh full one on hand pauses the forecast', () => {
  const counts = { egg: { name: 'Eggs', category: 'eggs' as const, count: 3, dates: [ago(8), ago(17), ago(26)] } };
  const fresh: InventoryItem = {
    id: '1', name: 'Eggs', key: 'egg', category: 'eggs', storage: 'fridge', quantity: 12, unit: 'each',
    fill: 'full', addedAt: ago(1), expiresAt: null, expirySource: 'predicted',
  };
  assert.equal(forecastRunOuts(counts, {}, [fresh], NOW).length, 0);
});

test('older users fall back to price history dates', () => {
  const prices = { egg: { name: 'Eggs', points: [ago(7), ago(14), ago(21)].map((at) => ({ at, unitPrice: 0.3, unit: 'each' })) } };
  const info = { name: 'Eggs', category: 'eggs' as const, count: 3 };
  assert.equal(purchaseDates('egg', info, prices).length, 3);
  assert.equal(forecastRunOuts({ egg: info }, prices, [], NOW)[0].every, 7);
});

test('the usual shop day is the weekday most trips fall on', () => {
  const sat = (weeksAgo: number) => new Date(2026, 10, 14 - weeksAgo * 7, 10).toISOString();
  const counts = {
    a: { name: 'A', category: 'other' as const, count: 3, dates: [sat(0), sat(1), sat(2)] },
    b: { name: 'B', category: 'other' as const, count: 1, dates: [new Date(2026, 10, 11).toISOString()] },
  };
  assert.equal(usualShopDay(counts, {}), 6);
  assert.equal(usualShopDay({}, {}), null);
});

test('the nudge is 6 pm the evening before the next shop day', () => {
  const at = nudgeTime(6, NOW); // Saturday, from Friday noon
  assert.equal(at.getDay(), 5);
  assert.equal(at.getHours(), 18);
  assert.equal(at.getDate(), 20);
  const late = nudgeTime(6, new Date(2026, 10, 20, 19)); // already past 6 pm Friday
  assert.equal(late.getDate(), 27);
});
