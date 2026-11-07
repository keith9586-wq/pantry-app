import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { expiryLabel, predictExpiry } from '../lib/expiry';
import { CATEGORY_LABEL, defaultStorage, guessCategory, ingredientKey } from '../lib/normalize';
import type { StorageSpot } from '../lib/types';
import { useStore } from '../store/useStore';

const SPOTS: StorageSpot[] = ['fridge', 'freezer', 'pantry'];
const UNITS = ['each', 'lb', 'oz', 'gal', 'pack'];

export default function AddItemScreen() {
  const addItems = useStore((s) => s.addItems);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('each');
  const [spot, setSpot] = useState<StorageSpot | null>(null);

  const category = guessCategory(name);
  const storage = spot ?? defaultStorage(category, name);
  const predicted = useMemo(
    () => (name.trim() ? predictExpiry(ingredientKey(name), category, storage, new Date()).toISOString() : null),
    [name, category, storage],
  );

  function save() {
    const quantity = parseFloat(qty);
    addItems([{ name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unit, storage }]);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4) }} keyboardShouldPersistTaps="handled">
      <SectionTitle>What is it?</SectionTitle>
      <Input value={name} onChangeText={setName} placeholder="e.g. Greek yogurt" autoFocus />
      {name.trim() !== '' && <Text style={styles.note}>Category: {CATEGORY_LABEL[category]}</Text>}

      <SectionTitle>How much?</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Input value={qty} onChangeText={setQty} keyboardType="decimal-pad" style={{ width: 80 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {UNITS.map((u) => (
            <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
          ))}
        </ScrollView>
      </View>

      <SectionTitle>Where is it kept?</SectionTitle>
      <View style={{ flexDirection: 'row' }}>
        {SPOTS.map((s) => (
          <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} active={storage === s} onPress={() => setSpot(s)} />
        ))}
      </View>

      {predicted && (
        <Text style={[styles.note, { marginTop: space(4) }]}>
          Predicted: {expiryLabel(predicted)}. You can change the date later.
        </Text>
      )}

      <Button title="Add to kitchen" onPress={save} disabled={!name.trim()} style={{ marginTop: space(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 14, color: colors.muted, marginTop: space(2) },
});
