import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Empty, SectionTitle } from '../../components/ui';
import { usePlan } from '../../billing/billing';
import { can } from '../../lib/plans';
import { upcomingDays } from '../../lib/planner';
import { colors, space } from '../../components/theme';
import { findItem } from '../../lib/recipes';
import { recipeFit } from '../../lib/diet';
import { useActiveProfile, useRecipes, useStore } from '../../store/useStore';
import { isCustom } from '../../lib/customRecipe';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipes().find((r) => r.id === id);
  const deleteRecipe = useStore((s) => s.deleteRecipe);
  const items = useStore((s) => s.items);
  const cook = useStore((s) => s.cook);
  const addShopping = useStore((s) => s.addShopping);
  const addToPlan = useStore((s) => s.addToPlan);
  const canPlan = can(usePlan(), 'mealPlanner');
  const profile = useActiveProfile();
  const [picking, setPicking] = useState(false);

  const rows = useMemo(
    () => (recipe ? recipe.ingredients.map((ing) => ({ ing, item: findItem(items, ing) })) : []),
    [recipe, items],
  );

  if (!recipe) return <Empty title="Recipe not found" body="It may have been removed." />;

  const missing = rows.filter((r) => !r.item && !r.ing.optional);
  const fit = recipeFit(recipe, profile);
  const conflicts = [...fit.blocking, ...fit.skip];
  const reasonFor = (name: string) => conflicts.find((c) => c.ingredient.name === name)?.reason;

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      <Stack.Screen options={{ title: recipe.title }} />
      <Text style={styles.meta}>
        {recipe.minutes} minutes · serves {recipe.servings}
      </Text>

      {fit.blocking.length > 0 && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Doesn't fit your diet: {fit.blocking.map((c) => `${c.ingredient.name} (${c.reason.toLowerCase()})`).join(', ')}.
          </Text>
        </View>
      )}

      <SectionTitle>Ingredients</SectionTitle>
      {rows.map(({ ing, item }) => (
        <View key={ing.name} style={styles.ingRow}>
          <Text style={[styles.dot, { color: item ? colors.primary : colors.muted }]}>{item ? '●' : '○'}</Text>
          <Text style={styles.ing}>
            {ing.quantity} {ing.unit} {ing.name}
            {ing.optional ? ' (optional)' : ''}
          </Text>
          {reasonFor(ing.name) && <Text style={styles.conflict}>{ing.optional ? 'leave out' : reasonFor(ing.name)}</Text>}
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
        {picking ? (
          <View>
            <Text style={styles.meta}>Which day?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2), marginTop: space(2) }}>
              {upcomingDays(new Date(), 7).map((d) => (
                <Chip
                  key={d.key}
                  label={d.label}
                  onPress={() => {
                    addToPlan(d.key, recipe.id);
                    setPicking(false);
                    Alert.alert('Added to your plan', `${recipe.title} on ${d.label.toLowerCase()}.`);
                  }}
                />
              ))}
            </View>
          </View>
        ) : (
          <Button
            kind="secondary"
            title={canPlan ? 'Add to plan' : 'Add to plan (Plus)'}
            onPress={() => (canPlan ? setPicking(true) : router.push('/paywall'))}
          />
        )}
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
        {isCustom(recipe.id) && (
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Button
              kind="secondary"
              title="Edit"
              onPress={() => router.push({ pathname: '/recipe-edit', params: { id: recipe.id } })}
              style={{ flex: 1 }}
            />
            <Button
              kind="secondary"
              title="Delete"
              onPress={() =>
                Alert.alert('Delete this recipe?', recipe.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      router.back();
                      deleteRecipe(recipe.id);
                    },
                  },
                ])
              }
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 15, color: colors.muted },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5) },
  dot: { fontSize: 14, width: 22 },
  ing: { fontSize: 16, color: colors.text, flex: 1 },
  warn: { backgroundColor: colors.warnSoft, borderRadius: 12, padding: space(3), marginTop: space(3) },
  warnText: { fontSize: 14, color: colors.warn, lineHeight: 20 },
  conflict: { fontSize: 12, fontWeight: '600', color: colors.warn, marginLeft: space(2) },
  have: { fontSize: 12, fontWeight: '600', color: colors.primary },
  step: { fontSize: 16, color: colors.text, lineHeight: 23, marginBottom: space(2) },
});
