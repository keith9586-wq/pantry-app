import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Empty, SectionTitle } from '../../components/ui';
import { colors, space, urgencyColor } from '../../components/theme';
import { daysLeft, expiryLabel, urgency } from '../../lib/expiry';
import type { InventoryItem, StorageSpot } from '../../lib/types';
import { moneyStats, useRecallMatches, useStore } from '../../store/useStore';
import { enableReminders } from '../../notify/reminders';
import { checkedToday, pickChecks } from '../../lib/confidence';
import { leftoversFirst } from '../../lib/leftovers';

const SPOTS: { key: StorageSpot | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'freezer', label: 'Freezer' },
  { key: 'pantry', label: 'Pantry' },
];

const FILL_LABEL = { full: 'Full', half: 'Half left', low: 'Running low' } as const;

function ItemRow({ item }: { item: InventoryItem }) {
  const finishItem = useStore((s) => s.finishItem);
  const u = urgency(item.expiresAt);
  const c = urgencyColor[u];
  const qty = item.leftover
    ? `${item.quantity} ${item.quantity === 1 ? 'portion' : 'portions'}`
    : item.unit === 'each'
      ? item.quantity === 1
        ? ''
        : `${item.quantity} · `
      : `${item.quantity} ${item.unit} · `;

  return (
    <View style={styles.row}>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        accessibilityHint="Edit, log part of it, or fix the date"
      >
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {qty}
          {item.leftover ? '' : FILL_LABEL[item.fill]}
          {!item.leftover && item.expirySource === 'predicted' ? ' · estimated date' : ''}
        </Text>
      </Pressable>
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.fg }]}>{expiryLabel(item.expiresAt)}</Text>
      </View>
      <Pressable
        style={styles.more}
        onPress={() =>
          Alert.alert(item.name, 'What happened to it?', [
            { text: 'Used it up', onPress: () => finishItem(item.id, 'used') },
            { text: 'Threw it out', style: 'destructive', onPress: () => finishItem(item.id, 'tossed') },
            { text: 'Cancel', style: 'cancel' },
          ])
        }
        accessibilityLabel={`Finish ${item.name}`}
      >
        <Text style={styles.moreText}>✓</Text>
      </Pressable>
    </View>
  );
}

export default function KitchenScreen() {
  const items = useStore((s) => s.items);
  const log = useStore((s) => s.log);
  const [spot, setSpot] = useState<StorageSpot | 'all'>('all');

  const lastCheckAt = useStore((s) => s.lastCheckAt);
  const toCheck = useMemo(() => (checkedToday(lastCheckAt) ? [] : pickChecks(items)), [items, lastCheckAt]);
  const leftovers = useMemo(() => leftoversFirst(items), [items]);

  const { useSoon, rest } = useMemo(() => {
    const filtered = items
      .filter((i) => !i.leftover)
      .filter((i) => spot === 'all' || i.storage === spot)
      .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
    return {
      useSoon: filtered.filter((i) => {
        const d = daysLeft(i.expiresAt);
        return d !== null && d <= 3;
      }),
      rest: filtered.filter((i) => {
        const d = daysLeft(i.expiresAt);
        return d === null || d > 3;
      }),
    };
  }, [items, spot]);

  const recallMatches = useRecallMatches();
  const stats = moneyStats(log);
  const remindersOn = useStore((s) => s.remindersOn);
  const [hideReminderCard, setHideReminderCard] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{items.length}</Text>
          <Text style={styles.statLabel}>items on hand</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.primary }]}>${stats.usedValue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>eaten this month</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, stats.tossedValue > 0 && { color: colors.danger }]}>
            ${stats.tossedValue.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>wasted this month</Text>
        </View>
      </View>

      {recallMatches.length > 0 && (
        <Pressable style={styles.recall} onPress={() => router.push('/recalls')} accessibilityRole="button">
          <Text style={styles.recallTitle}>
            {recallMatches[0].strength === 'brand' ? `Recall: your ${recallMatches[0].item.name}` : `Possible recall: ${recallMatches[0].item.name}`}
            {recallMatches.length > 1 ? ` and ${recallMatches.length - 1} more` : ''}
          </Text>
          <Text style={styles.recallBody}>Tap to see the notice and check your package.</Text>
        </Pressable>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space(4) }}>
        {SPOTS.map((s) => (
          <Chip key={s.key} label={s.label} active={spot === s.key} onPress={() => setSpot(s.key)} />
        ))}
      </ScrollView>

      {items.length === 0 ? (
        <Empty
          title="Your kitchen is empty"
          body="Scan a grocery receipt, or sweep your phone across the fridge and pantry to fill it in one go."
        />
      ) : (
        <>
          {!remindersOn && !hideReminderCard && (
            <View style={styles.tip}>
              <Text style={styles.tipText}>Get a heads-up the morning before food expires.</Text>
              <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
                <Button title="Turn on reminders" onPress={() => enableReminders()} style={{ flex: 1 }} />
                <Button kind="secondary" title="Not now" onPress={() => setHideReminderCard(true)} />
              </View>
            </View>
          )}
          {toCheck.length > 0 && (
            <Pressable style={styles.tip} onPress={() => router.push('/check')} accessibilityRole="button">
              <Text style={[styles.tipText, { fontWeight: '700' }]}>Quick check · {toCheck.length} {toCheck.length === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.tipText}>About 10 seconds. Tell us what's still here so your list stays right.</Text>
            </Pressable>
          )}
          {leftovers.length > 0 && (
            <>
              <SectionTitle>Leftovers to eat first</SectionTitle>
              {leftovers.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </>
          )}
          {useSoon.length > 0 && (
            <>
              <SectionTitle>Use soon</SectionTitle>
              {useSoon.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
              <Button
                kind="secondary"
                title="Find recipes for these"
                onPress={() => router.navigate('/recipes')}
                style={{ marginTop: space(2) }}
              />
            </>
          )}
          {rest.length > 0 && <SectionTitle>Everything else</SectionTitle>}
          {rest.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </>
      )}

      <View style={styles.actions}>
        <Button title="Scan receipt" onPress={() => router.navigate('/scan')} style={{ flex: 1 }} />
        <Button kind="secondary" title="Scan barcode" onPress={() => router.push('/barcode')} style={{ flex: 1 }} />
      </View>
      <View style={[styles.actions, { marginTop: space(2) }]}>
        <Button kind="secondary" title="Sweep shelves" onPress={() => router.push('/shelf-scan')} style={{ flex: 1 }} />
        <Button kind="secondary" title="Type an item" onPress={() => router.push('/add')} style={{ flex: 1 }} />
      </View>
      {items.length > 0 && <Text style={styles.hint}>Tap an item to edit it or log part of it. Tap ✓ when it's gone.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  recall: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: space(4), marginTop: space(4) },
  recallTitle: { fontSize: 16, fontWeight: '700', color: colors.danger },
  recallBody: { fontSize: 14, color: colors.text, marginTop: 2 },
  stats: { flexDirection: 'row', gap: space(2) },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: space(3), borderWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: space(3),
    paddingLeft: space(4),
    marginBottom: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  badgeText: { fontSize: 12, fontWeight: '600' },
  more: { paddingHorizontal: space(4), paddingVertical: space(2) },
  moreText: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: space(3), marginTop: space(6) },
  tip: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: space(4), marginTop: space(4) },
  tipText: { fontSize: 15, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(3) },
});
