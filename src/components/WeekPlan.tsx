import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { missingForPlan, upcomingDays } from '../lib/planner';
import { useRecipes, useStore } from '../store/useStore';
import { colors, space } from './theme';
import { Button, SectionTitle } from './ui';

/** The next 7 days of planned meals, plus what to buy for them. */
export function WeekPlan() {
  const plan = useStore((s) => s.mealPlan);
  const items = useStore((s) => s.items);
  const remove = useStore((s) => s.removeFromPlan);
  const addShopping = useStore((s) => s.addShopping);
  const now = new Date();
  const days = upcomingDays(now, 7);
  const recipes = useRecipes();
  const need = useMemo(() => missingForPlan(items, recipes, plan, new Date()), [items, recipes, plan]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const planned = days.some((d) => (plan[d.key] ?? []).length > 0);

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      {!planned && (
        <Text style={styles.empty}>
          Nothing planned yet. Open a recipe in Ideas and tap "Add to plan". Recipes that use food about to expire are at the top.
        </Text>
      )}
      {days.map((d) => {
        const ids = plan[d.key] ?? [];
        return (
          <View key={d.key} style={styles.day}>
            <Text style={styles.dayLabel}>{d.label}</Text>
            <View style={{ flex: 1 }}>
              {ids.length === 0 ? (
                <Text style={styles.none}>—</Text>
              ) : (
                ids.map((id) => {
                  const r = byId.get(id);
                  if (!r) return null;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id } })}
                      onLongPress={() => remove(d.key, id)}
                      style={styles.meal}
                    >
                      <Text style={styles.mealText}>{r.title}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        );
      })}
      {planned && <Text style={styles.hint}>Long-press a meal to take it off the plan.</Text>}

      {need.length > 0 && (
        <>
          <SectionTitle>Still need for this week</SectionTitle>
          {need.map((n) => (
            <Text key={n.key} style={styles.need}>
              {n.name}
              <Text style={styles.needFor}> · {n.forRecipes.join(', ')}</Text>
            </Text>
          ))}
          <Button
            title={`Add ${need.length} to shopping list`}
            onPress={() => {
              need.forEach((n) => addShopping(n.name, 'recipe'));
              Alert.alert('Added to your shopping list', `${need.length} items for this week's meals.`);
            }}
            style={{ marginTop: space(3) }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: space(4) },
  day: { flexDirection: 'row', paddingVertical: space(2.5), borderBottomWidth: 1, borderBottomColor: colors.border },
  dayLabel: { width: 90, fontSize: 15, fontWeight: '600', color: colors.text, paddingTop: space(1.5) },
  none: { fontSize: 15, color: colors.muted, paddingTop: space(1.5) },
  meal: { backgroundColor: colors.card, borderRadius: 10, padding: space(2.5), marginBottom: space(1.5), borderWidth: 1, borderColor: colors.border },
  mealText: { fontSize: 15, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(3) },
  need: { fontSize: 16, color: colors.text, paddingVertical: space(1) },
  needFor: { fontSize: 13, color: colors.muted },
});
