import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, Input, SectionTitle } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { CATEGORY_LABEL } from '../../lib/normalize';
import { groupByAisle } from '../../lib/shopping';
import { useStore } from '../../store/useStore';
import { estimateList } from '../../lib/prices';
import { usePlan } from '../../billing/billing';
import { can } from '../../lib/plans';

const SOURCE_LABEL = { auto: 'running low', recipe: 'for a recipe', manual: '' } as const;

export default function ShoppingScreen() {
  const shopping = useStore((s) => s.shopping);
  const addShopping = useStore((s) => s.addShopping);
  const toggle = useStore((s) => s.toggleShopping);
  const remove = useStore((s) => s.removeShopping);
  const refresh = useStore((s) => s.refreshSuggestions);
  const stockChecked = useStore((s) => s.stockChecked);
  const [draft, setDraft] = useState('');
  const autoList = can(usePlan(), 'autoList');
  const priceHistory = useStore((s) => s.priceHistory);
  const estimate = estimateList(priceHistory, shopping);

  // Staples you buy often are added automatically whenever the list is opened.
  useFocusEffect(
    useCallback(() => {
      if (autoList) refresh();
    }, [refresh, autoList]),
  );

  const groups = groupByAisle(shopping);
  const checkedCount = shopping.filter((s) => s.checked).length;

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an item"
          returnKeyType="done"
          onSubmitEditing={() => {
            addShopping(draft);
            setDraft('');
          }}
          style={{ flex: 1 }}
        />
        <Button
          title="Add"
          onPress={() => {
            addShopping(draft);
            setDraft('');
          }}
          disabled={!draft.trim()}
        />
      </View>

      {groups.length === 0 ? (
        <Empty
          title="Nothing to buy"
          body={
            autoList
              ? 'Things you buy regularly show up here on their own when they run low.'
              : 'Add items above. With Plus, things you buy regularly add themselves when they run low.'
          }
        />
      ) : (
        groups.map((g) => (
          <View key={g.category}>
            <SectionTitle>{CATEGORY_LABEL[g.category]}</SectionTitle>
            {g.items.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => toggle(s.id)}
                onLongPress={() => remove(s.id)}
                style={[styles.row, s.checked && { opacity: 0.45 }]}
              >
                <Text style={styles.check}>{s.checked ? '☑' : '☐'}</Text>
                <Text style={[styles.name, s.checked && { textDecorationLine: 'line-through' }]}>{s.name}</Text>
                {SOURCE_LABEL[s.source] ? <Text style={styles.tag}>{SOURCE_LABEL[s.source]}</Text> : null}
              </Pressable>
            ))}
          </View>
        ))
      )}

      {estimate.priced > 0 && (
        <Text style={styles.estimate}>
          About ${estimate.total.toFixed(2)} for {estimate.priced} of {shopping.filter((s) => !s.checked).length} items, based on what you last paid.
        </Text>
      )}

      {checkedCount > 0 && (
        <Button
          title={`Put ${checkedCount} checked items away`}
          onPress={() => {
            const n = stockChecked();
            Alert.alert('Kitchen updated', `${n} items added with predicted use-by dates. Scanning the receipt adds prices too.`);
          }}
          style={{ marginTop: space(6) }}
        />
      )}
      {groups.length > 0 && <Text style={styles.hint}>Long-press an item to remove it.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(3),
    marginBottom: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  check: { fontSize: 20, color: colors.primary, marginRight: space(3) },
  name: { fontSize: 16, color: colors.text, flex: 1 },
  tag: { fontSize: 12, color: colors.muted },
  estimate: { fontSize: 14, color: colors.muted, marginTop: space(4), textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(3) },
});
