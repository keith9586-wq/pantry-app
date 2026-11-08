/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKey, matchRecalls, parseFdaRecalls, parseFsisRecalls } from '../recalls';
import { sanitizeParsedLines } from '../receipt';
import { productFromOpenFoodFacts } from '../barcode';
import { itemToRow, rowToItem } from '../../sync/rows';
import type { InventoryItem } from '../types';

const NOW = new Date('2026-11-10T12:00:00Z');

const fda = {
  results: [
    {
      recall_number: 'F-0101-2027',
      product_description: 'Fresh Express Baby Spinach, 5 oz clamshell, UPC 0 71279 30101 6',
      recalling_firm: 'Fresh Express Inc.',
      reason_for_recall: 'Potential Listeria monocytogenes contamination',
      classification: 'Class I',
      status: 'Ongoing',
      recall_initiation_date: '20261102',
      report_date: '20261105',
    },
    { recall_number: 'F-0001-2026', product_description: 'Peanut butter', status: 'Terminated', recall_initiation_date: '20261101' },
    { recall_number: 'F-0002-2026', product_description: 'Old cookies', status: 'Ongoing', recall_initiation_date: '20260101' },
    { product_description: 'no number' },
  ],
};

const fsis = [
  {
    field_recall_number: '045-2026',
    field_title: 'Example Farms Recalls Ground Beef Products Due to Possible E. Coli',
    field_product_items: '1-lb. packages of "Example Farms 80/20 Ground Beef"',
    field_establishment: 'Example Farms LLC',
    field_recall_reason: 'Product Contamination',
    field_risk_level: 'High - Class I',
    field_recall_date: '2026-11-03',
    field_archive_recall: 'False',
  },
  { field_recall_number: '001-2025', field_title: 'Archived', field_recall_date: '2025-01-01', field_archive_recall: 'True' },
];

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: over.key ?? 'x',
  name: 'Item',
  key: 'item',
  category: 'other',
  storage: 'fridge',
  quantity: 1,
  unit: 'each',
  fill: 'full',
  addedAt: NOW.toISOString(),
  expiresAt: null,
  expirySource: 'predicted',
  ...over,
});

test('FDA and USDA feeds parse, skipping closed and unreadable ones', () => {
  const a = parseFdaRecalls(fda);
  assert.deepEqual(a.map((r) => r.id), ['fda:F-0101-2027', 'fda:F-0002-2026']);
  assert.equal(a[0].serious, true);
  assert.equal(a[0].date.slice(0, 10), '2026-11-02');
  const b = parseFsisRecalls(fsis);
  assert.deepEqual(b.map((r) => r.id), ['usda:045-2026']);
  assert.equal(b[0].serious, true);
  assert.deepEqual(parseFdaRecalls(null), []);
  assert.deepEqual(parseFsisRecalls({}), []);
});

test('recalls match food on hand by name, and by brand when we know it', () => {
  const recalls = [...parseFdaRecalls(fda), ...parseFsisRecalls(fsis)];
  const items = [
    item({ id: '1', name: 'Baby spinach', key: 'baby spinach', brand: 'Fresh Express' }),
    item({ id: '2', name: 'Spinach', key: 'spinach', brand: 'Earthbound Farm' }),
    item({ id: '3', name: 'Ground beef', key: 'ground beef' }),
    item({ id: '4', name: 'Cookies', key: 'cookie' }), // recall is too old
    item({ id: '5', name: 'Chili (Tuesday)', key: 'leftover:5' }),
    item({ id: '6', name: 'Beef broth', key: 'beef broth' }),
  ];
  const m = matchRecalls(recalls, items, [], NOW);
  assert.deepEqual(
    m.map((x) => [x.item.id, x.strength]),
    [
      ['1', 'brand'],
      ['3', 'name'],
    ],
  );
  assert.deepEqual(matchRecalls(recalls, items, [matchKey(m[0])], NOW).map((x) => x.item.id), ['3']);
});

test('brands come through from receipts, barcodes and sync', () => {
  const [line] = sanitizeParsedLines({ items: [{ name: 'Whole milk', quantity: 1, unit: 'gal', category: 'dairy', price: 3.48, brand: ' Great Value ' }] });
  assert.equal(line.brand, 'Great Value');
  const [noBrand] = sanitizeParsedLines({ items: [{ name: 'Bananas', quantity: 1, unit: 'lb', category: 'produce', price: 1, brand: null }] });
  assert.equal('brand' in noBrand, false);
  const p = productFromOpenFoodFacts({ status: 1, product: { product_name: 'Oat milk', brands: 'Oatly,Oatly AB' } });
  assert.equal(p?.brand, 'Oatly');
  const it = item({ brand: 'Oatly', price: undefined });
  assert.deepEqual(rowToItem(itemToRow(it, 'h')), it);
});
