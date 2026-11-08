import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { planBudgetWeek } from '../lib/budget';
import { fitsProfile } from '../lib/diet';
import { upcomingDays } from '../lib/planner';
import { useActiveProfile, useRecipes, useStore } from '../store/useStore';

const money = (n: number) => `$${n.toFixed(2)}`;

/** "Feed 4 people for $60 this week": dinners that use what's on hand first, then the cheapest extras. */
export default function BudgetWeekScreen() {
  const items = useStore((s) => s.items);
  const prices = useStore((s) => s.priceHistory);
  const addToPlan = useStore((s) => s.addToPlan);
  const addShopping = useStore((s) => s.addShopping);
  const profile = useActiveProfile();
  const all = useRecipes();
  const recipes = useMemo(() => all.filter((r) => fitsProfile(r, profile)), [all, profile]);
  const [people, setPeople] = useState('4');
  const [budget, setBudget] = useState('60');
  const [nights, setNights] = useState(7);

  const plan = useMemo(() => {
    const p = parseInt(people, 10);
    const b = parseFloat(budget.replace(/[$,]/g, ''));
    if (!Number.isFinite(p) || p < 1 || !Number.isFinite(b) || b <= 0) return null;
    return planBudgetWeek({ recipes, inventory: items, prices, people: p, budget: b, days: upcomingDays(new Date(), nights) });
  }, [people, budget, nights, recipes, items, prices]);

  function apply() {
    if (!plan) return;
    for (const d of plan.days) addToPlan(d.key, d.recipe.id);
    for (const s of plan.shopping) addShopping(s.name, 'recipe');
    Alert.alert('Week planned', `${plan.days.length} dinners added to your plan and ${plan.shopping.length} items to your list.`);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}>
          <SectionTitle>People</SectionTitle>
          <Input value={people} onChangeText={setPeople} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle>Budget for the week</SectionTitle>
          <Input value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
        </View>
      </View>
      <SectionTitle>Dinners</SectionTitle>
      <View style={{ flexDirection: 'row' }}>
        {[3, 5, 7].map((n) => (
          <Chip key={n} label={`${n} nights`} active={nights === n} onPress={() => setNights(n)} />
        ))}
      </View>

      {plan && plan.days.length > 0 ? (
        <>
          <View style={[styles.total, !plan.fits && { backgroundColor: colors.dangerSoft }]}>
            <Text style={styles.totalNum}>{money(plan.total)}</Text>
            <Text style={styles.totalText}>
              {plan.fits
                ? `to buy this week, ${money(plan.budget - plan.total)} under budget. The rest comes from your kitchen.`
                : `to buy, ${money(plan.total - plan.budget)} over budget. Try fewer nights or add what you have to your kitchen.`}
            </Text>
          </View>
          {plan.days.map((d) => (
            <View key={d.key} style={styles.day}>
              <Text style={styles.dayLabel}>{d.label}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {d.recipe.title}
                  {d.batches > 1 ? ` ×${d.batches}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {d.buy.length === 0 ? 'Nothing to buy' : `Buy ${d.buy.map((b) => b.name).join(', ')}`}
                  {d.rescues.length > 0 ? ` · uses up ${d.rescues.join(', ')}` : ''}
                </Text>
              </View>
              <Text style={styles.cost}>{d.cost > 0 ? money(d.cost) : '—'}</Text>
            </View>
          ))}
          {plan.estimated && (
            <Text style={styles.note}>
              Prices come from your receipts where we have them; the rest are typical store prices, so the total is a guide.
            </Text>
          )}
          <Button title="Use this plan" onPress={apply} style={{ marginTop: space(4) }} />
        </>
      ) : (
        <Text style={[styles.note, { marginTop: space(6) }]}>
          {recipes.length === 0 ? 'No recipes fit your diet settings yet. Add your own in Recipes.' : 'Enter how many people and a budget.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: space(4), marginTop: space(6), marginBottom: space(2) },
  totalNum: { fontSize: 28, fontWeight: '700', color: colors.text },
  totalText: { fontSize: 15, color: colors.text, marginTop: 2, lineHeight: 21 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(3),
    marginTop: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayLabel: { width: 72, fontSize: 13, fontWeight: '600', color: colors.muted },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cost: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: colors.muted, marginTop: space(3), lineHeight: 19 },
});
