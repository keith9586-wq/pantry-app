import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { expiryLabel, predictExpiry } from '../lib/expiry';
import { CATEGORY_LABEL, defaultStorage, guessCategory, ingredientKey } from '../lib/normalize';
import type { StorageSpot } from '../lib/types';
import { LEFTOVER_DAYS } from '../lib/leftovers';
import { useStore } from '../store/useStore';

const SPOTS: StorageSpot[] = ['fridge', 'freezer', 'pantry'];
const UNITS = ['each', 'lb', 'oz', 'gal', 'pack'];

export default function AddItemScreen() {
  const addItems = useStore((s) => s.addItems);
  const addLeftover = useStore((s) => s.addLeftover);
  const [leftover, setLeftover] = useState(false);
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
    if (leftover) {
      addLeftover(name, Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
      router.back();
      return;
    }
    addItems([{ name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unit, storage }]);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4) }} keyboardShouldPersistTaps="handled">
      <SectionTitle>What is it?</SectionTitle>
      <Input value={name} onChangeText={setName} placeholder={leftover ? 'e.g. Chili' : 'e.g. Greek yogurt'} autoFocus />
      <View style={{ flexDirection: 'row', marginTop: space(2) }}>
        <Chip label="Bought food" active={!leftover} onPress={() => setLeftover(false)} />
        <Chip label="Leftovers I cooked" active={leftover} onPress={() => setLeftover(true)} />
      </View>
      {!leftover && name.trim() !== '' && <Text style={styles.note}>Category: {CATEGORY_LABEL[category]}</Text>}

      <SectionTitle>{leftover ? 'How many portions?' : 'How much?'}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Input value={qty} onChangeText={setQty} keyboardType="decimal-pad" style={{ width: 80 }} />
        {!leftover && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {UNITS.map((u) => (
              <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
            ))}
          </ScrollView>
        )}
      </View>

      {leftover ? (
        <Text style={[styles.note, { marginTop: space(4) }]}>
          Kept in the fridge, eat within {LEFTOVER_DAYS} days. It shows at the top of your kitchen until it's gone.
        </Text>
      ) : (
        <>
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
        </>
      )}

      <Button title="Add to kitchen" onPress={save} disabled={!name.trim()} style={{ marginTop: space(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 14, color: colors.muted, marginTop: space(2) },
});
