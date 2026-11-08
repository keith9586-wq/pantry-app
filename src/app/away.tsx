import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlan } from '../billing/billing';
import { Button, Chip, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { dinnersToUse, freezePatch, makeTrip, planAway, type AwayTrip } from '../lib/away';
import { fitsProfile } from '../lib/diet';
import { expiryLabel } from '../lib/expiry';
import { upcomingDays } from '../lib/planner';
import { can } from '../lib/plans';
import type { InventoryItem } from '../lib/types';
import { useActiveProfile, useRecipes, useStore } from '../store/useStore';

const LEAVE = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 2, label: 'In 2 days' },
  { days: 3, label: 'In 3 days' },
];
const NIGHTS = [2, 3, 5, 7, 10, 14];

const dayName = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

/** Away mode: use up or freeze what would spoil, and pause fresh restocking until you're back. */
export default function AwayScreen() {
  const items = useStore((s) => s.items);
  const away = useStore((s) => s.away);
  const setAway = useStore((s) => s.setAway);
  const updateItem = useStore((s) => s.updateItem);
  const addToPlan = useStore((s) => s.addToPlan);
  const plan = usePlan();
  const profile = useActiveProfile();
  const recipes = useRecipes();
  const [leave, setLeave] = useState(1);
  const [nights, setNights] = useState(5);

  const trip: AwayTrip = away ?? makeTrip(leave, nights);
  const prep = useMemo(() => planAway(items, trip), [items, trip]);

  // Dinners before leaving that use the food that would spoil.
  const dinners = useMemo(() => {
    if (!can(plan, 'mealPlanner') || prep.nightsBefore === 0 || prep.eatFirst.length === 0) return [];
    const fit = recipes.filter((r) => fitsProfile(r, profile));
    return dinnersToUse(items, prep.eatFirst, fit, prep.nightsBefore);
  }, [plan, prep, recipes, items, profile]);

  function freeze(list: InventoryItem[]) {
    for (const it of list) updateItem(it.id, freezePatch(it));
  }

  function start() {
    setAway(trip);
    if (dinners.length > 0) {
      const days = upcomingDays(new Date(), dinners.length);
      dinners.forEach((r, i) => addToPlan(days[i].key, r.id));
    }
    Alert.alert(
      'Trip saved',
      `Fresh food stays off your list and use-by reminders pause until ${dayName(trip.until)}.${dinners.length ? ` ${dinners.length} dinners added to your plan.` : ''}`,
    );
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      {away ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Away {dayName(away.from)} to {dayName(away.until)}</Text>
          <Text style={styles.body}>Fresh food won't be added to your list and use-by reminders are paused.</Text>
          <Button kind="secondary" title="Cancel trip" onPress={() => setAway(null)} style={{ marginTop: space(3) }} />
        </View>
      ) : (
        <>
          <SectionTitle>Leaving</SectionTitle>
          <View style={styles.chips}>
            {LEAVE.map((l) => (
              <Chip key={l.days} label={l.label} active={leave === l.days} onPress={() => setLeave(l.days)} />
            ))}
          </View>
          <SectionTitle>Away for</SectionTitle>
          <View style={styles.chips}>
            {NIGHTS.map((n) => (
              <Chip key={n} label={`${n} nights`} active={nights === n} onPress={() => setNights(n)} />
            ))}
          </View>
          <Text style={[styles.body, { marginTop: space(2) }]}>Back {dayName(trip.until)}.</Text>
        </>
      )}

      {prep.freeze.length > 0 && (
        <>
          <SectionTitle>Freeze these</SectionTitle>
          {prep.freeze.map((it) => (
            <View key={it.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{it.name}</Text>
                <Text style={styles.meta}>{expiryLabel(it.expiresAt)}</Text>
              </View>
              <Pressable onPress={() => freeze([it])} hitSlop={8}>
                <Text style={styles.action}>Freeze</Text>
              </Pressable>
            </View>
          ))}
          {prep.freeze.length > 1 && (
            <Button kind="secondary" title={`Freeze all ${prep.freeze.length}`} onPress={() => freeze(prep.freeze)} style={{ marginTop: space(2) }} />
          )}
        </>
      )}

      {prep.eatFirst.length > 0 && (
        <>
          <SectionTitle>{prep.nightsBefore > 0 ? 'Eat before you go, or give away' : 'Give away or take with you'}</SectionTitle>
          {prep.eatFirst.map((it) => (
            <View key={it.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{it.name}</Text>
                <Text style={styles.meta}>{expiryLabel(it.expiresAt)}</Text>
              </View>
            </View>
          ))}
          {dinners.length > 0 && (
            <Text style={[styles.body, { marginTop: space(2) }]}>
              Dinners to use them up: {dinners.map((r) => r.title).join(', ')}. They go on your plan when you save the trip.
            </Text>
          )}
        </>
      )}

      {prep.freeze.length === 0 && prep.eatFirst.length === 0 && (
        <Text style={[styles.body, { marginTop: space(6) }]}>Nothing in your kitchen will spoil while you're away.</Text>
      )}

      {!away && <Button title="Save trip" onPress={start} style={{ marginTop: space(6) }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  banner: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: space(4) },
  bannerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space(1) },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(3),
    marginTop: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  action: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
