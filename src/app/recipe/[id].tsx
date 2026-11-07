import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, SectionTitle } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { RECIPES } from '../../data/recipes';
import { findItem } from '../../lib/recipes';
import { useStore } from '../../store/useStore';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = RECIPES.find((r) => r.id === id);
  const items = useStore((s) => s.items);
  const cook = useStore((s) => s.cook);
  const addShopping = useStore((s) => s.addShopping);

  const rows = useMemo(
    () => (recipe ? recipe.ingredients.map((ing) => ({ ing, item: findItem(items, ing) })) : []),
    [recipe, items],
  );

  if (!recipe) return <Empty title="Recipe not found" body="It may have been removed." />;

  const missing = rows.filter((r) => !r.item && !r.ing.optional);

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      <Stack.Screen options={{ title: recipe.title }} />
      <Text style={styles.meta}>
        {recipe.minutes} minutes · serves {recipe.servings}
      </Text>

      <SectionTitle>Ingredients</SectionTitle>
      {rows.map(({ ing, item }) => (
        <View key={ing.name} style={styles.ingRow}>
          <Text style={[styles.dot, { color: item ? colors.primary : colors.muted }]}>{item ? '●' : '○'}</Text>
          <Text style={styles.ing}>
            {ing.quantity} {ing.unit} {ing.name}
            {ing.optional ? ' (optional)' : ''}
          </Text>
          {item && <Text style={styles.have}>have</Text>}
        </View>
      ))}

      <SectionTitle>Steps</SectionTitle>
      {recipe.steps.map((s, i) => (
        <Text key={i} style={styles.step}>
          {i + 1}. {s}
        </Text>
      ))}

      <View style={{ gap: space(2), marginTop: space(6) }}>
        {missing.length > 0 && (
          <Button
            kind="secondary"
            title={`Add ${missing.length} missing to list`}
            onPress={() => {
              missing.forEach((m) => addShopping(m.ing.name, 'recipe'));
              Alert.alert('Added to your shopping list', missing.map((m) => m.ing.name).join(', '));
            }}
          />
        )}
        <Button
          title="I made this"
          onPress={() => {
            const usedUp = cook(recipe);
            Alert.alert(
              'Kitchen updated',
              usedUp.length ? `Used up: ${usedUp.join(', ')}. Everything else was reduced.` : 'Ingredients were deducted from your kitchen.',
            );
            router.back();
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 15, color: colors.muted },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5) },
  dot: { fontSize: 14, width: 22 },
  ing: { fontSize: 16, color: colors.text, flex: 1 },
  have: { fontSize: 12, fontWeight: '600', color: colors.primary },
  step: { fontSize: 16, color: colors.text, lineHeight: 23, marginBottom: space(2) },
});
