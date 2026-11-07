import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Empty, Input, SectionTitle } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { expiryLabel, predictExpiry } from '../../lib/expiry';
import { ingredientKey } from '../../lib/normalize';
import type { FillLevel, StorageSpot } from '../../lib/types';
import { useStore } from '../../store/useStore';

const DAY = 24 * 60 * 60 * 1000;
const SPOTS: StorageSpot[] = ['fridge', 'freezer', 'pantry'];
const FILLS: { key: FillLevel; label: string }[] = [
  { key: 'full', label: 'Full' },
  { key: 'half', label: 'Half left' },
  { key: 'low', label: 'Running low' },
];

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore((s) => s.items.find((i) => i.id === id));
  const updateItem = useStore((s) => s.updateItem);
  const useSome = useStore((s) => s.useSome);
  const finishItem = useStore((s) => s.finishItem);
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState('1');

  if (!item) return <Empty title="Item not found" body="It may have been used up or removed." />;

  const shiftDays = (days: number) => {
    const base = item.expiresAt ? new Date(item.expiresAt).getTime() : Date.now();
    updateItem(item.id, { expiresAt: new Date(base + days * DAY).toISOString(), expirySource: 'user' });
  };

  const moveTo = (storage: StorageSpot) => {
    // Moving to the freezer (or back) changes how long it lasts; re-predict from today
    // unless the user set the date themselves.
    const patch =
      item.expirySource === 'predicted'
        ? { storage, expiresAt: predictExpiry(item.key, item.category, storage, new Date()).toISOString() }
        : { storage };
    updateItem(item.id, patch);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: item.name }} />

      <SectionTitle>Name</SectionTitle>
      <Input
        value={name}
        onChangeText={setName}
        onEndEditing={() => name.trim() && name !== item.name && updateItem(item.id, { name: name.trim(), key: ingredientKey(name) })}
      />

      <SectionTitle>Use-by date</SectionTitle>
      <Text style={styles.big}>{expiryLabel(item.expiresAt)}</Text>
      <Text style={styles.note}>
        {item.expiresAt ? new Date(item.expiresAt).toDateString() : 'No date'} ·{' '}
        {item.expirySource === 'predicted' ? 'estimated by the app' : 'set by you'}
      </Text>
      <View style={styles.wrapRow}>
        <Chip label="−1 day" onPress={() => shiftDays(-1)} />
        <Chip label="+1 day" onPress={() => shiftDays(1)} />
        <Chip label="+1 week" onPress={() => shiftDays(7)} />
        <Chip label="Expires today" onPress={() => updateItem(item.id, { expiresAt: new Date().toISOString(), expirySource: 'user' })} />
      </View>

      <SectionTitle>Kept in</SectionTitle>
      <View style={styles.wrapRow}>
        {SPOTS.map((s) => (
          <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} active={item.storage === s} onPress={() => moveTo(s)} />
        ))}
      </View>

      <SectionTitle>How much is left</SectionTitle>
      <Text style={styles.note}>
        {item.quantity} {item.unit}
        {item.price !== undefined ? ` · worth $${item.price.toFixed(2)}` : ''}
      </Text>
      <View style={styles.wrapRow}>
        {FILLS.map((f) => (
          <Chip key={f.key} label={f.label} active={item.fill === f.key} onPress={() => updateItem(item.id, { fill: f.key })} />
        ))}
      </View>
      {item.quantity > 1 && (
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(3), alignItems: 'center' }}>
          <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ width: 80 }} />
          <Button
            kind="secondary"
            title={`Log ${amount || 0} ${item.unit === 'each' ? '' : item.unit} as used`}
            onPress={() => {
              const n = parseFloat(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              useSome(item.id, n);
            }}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <View style={{ gap: space(2), marginTop: space(8) }}>
        <Button
          title="Used it all"
          onPress={() => {
            finishItem(item.id, 'used');
            router.back();
          }}
        />
        <Button
          kind="danger"
          title="Threw it out"
          onPress={() =>
            Alert.alert('Throw it out?', 'This counts toward money wasted this month.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Threw it out',
                style: 'destructive',
                onPress: () => {
                  finishItem(item.id, 'tossed');
                  router.back();
                },
              },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: '700', color: colors.text },
  note: { fontSize: 14, color: colors.muted, marginTop: space(1), marginBottom: space(2) },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2) },
});
