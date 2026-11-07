/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOf, goodUntil, goodUntilLabel, nearbyBlock, offerAmount, shareText, sortOffers, type Offer } from '../surplus';
import type { InventoryItem } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 10, 12); // Tuesday

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'i',
  name: 'Spinach',
  key: 'spinach',
  category: 'produce',
  storage: 'fridge',
  quantity: 1,
  unit: 'bag',
  fill: 'full',
  addedAt: NOW.toISOString(),
  expiresAt: new Date(2026, 10, 13, 9).toISOString(),
  expirySource: 'predicted',
  ...over,
});

test('raw meat, fish, leftovers and expired food stay off the neighbor board', () => {
  assert.equal(nearbyBlock(item({}), NOW), null);
  assert.match(nearbyBlock(item({ category: 'meat' }), NOW)!, /friends/);
  assert.match(nearbyBlock(item({ category: 'seafood' }), NOW)!, /friends/);
  assert.match(nearbyBlock(item({ key: 'leftover:abc' }), NOW)!, /Home-cooked/);
  assert.match(nearbyBlock(item({ expiresAt: new Date(NOW.getTime() - DAY).toISOString() }), NOW)!, /past/);
});

test('amounts and dates read naturally', () => {
  assert.equal(offerAmount(item({})), '1 bag');
  assert.equal(offerAmount(item({ unit: 'each', quantity: 6 })), '6');
  assert.equal(offerAmount(item({ unit: 'each', quantity: 1 })), '');
  assert.equal(goodUntil(item({}), NOW), '2026-11-13');
  assert.equal(goodUntil(item({ expiresAt: null }), NOW), '2026-11-13');
  assert.equal(goodUntilLabel('2026-11-10', NOW), 'good today');
  assert.equal(goodUntilLabel('2026-11-11', NOW), 'good until tomorrow');
  assert.match(goodUntilLabel('2026-11-13', NOW), /^good until /);
});

test('the message for friends says what, how much and until when', () => {
  assert.match(shareText(item({}), NOW), /^I've got spinach \(1 bag\) I won't use in time, good until .+\. Want it\? Free\.$/);
});

test('areas are the first three ZIP digits', () => {
  assert.equal(areaOf('94110'), '941');
  assert.equal(areaOf('941'), null);
  assert.equal(areaOf("941' or 1=1"), null);
});

test('offers that spoil soonest come first', () => {
  const o = (id: string, good_until: string, created_at: string) => ({ id, good_until, created_at }) as Offer;
  const sorted = sortOffers([o('a', '2026-11-13', '2026-11-10'), o('b', '2026-11-11', '2026-11-09'), o('c', '2026-11-11', '2026-11-10')]);
  assert.deepEqual(sorted.map((x) => x.id), ['c', 'b', 'a']);
});
