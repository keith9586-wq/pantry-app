import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Empty, SectionTitle } from '../../components/ui';
import { WeekPlan } from '../../components/WeekPlan';
import { Locked } from '../../components/Locked';
import { usePlan } from '../../billing/billing';
import { can } from '../../lib/plans';
import { colors, space } from '../../components/theme';
import { rankRecipes } from '../../lib/recipes';
import { isEmptyProfile, recipeFit } from '../../lib/diet';
import { useActiveProfile, useOthersWithDiets, useRecipes, useStore } from '../../store/useStore';
import { isCustom } from '../../lib/customRecipe';

export default function RecipesScreen() {
  const items = useStore((s) => s.items);
  const profile = useActiveProfile();
  const others = useOthersWithDiets();
  const fitEveryone = useStore((s) => s.fitEveryone);
  const setFitEveryone = useStore((s) => s.setFitEveryone);
  const recipes = useRecipes();
  const { matches, hidden, mine } = useMemo(() => {
    const ranked = rankRecipes(items, recipes).map((m) => ({ ...m, fit: recipeFit(m.recipe, profile) }));
    const ok = ranked.filter((m) => m.fit.blocking.length === 0);
    // Your own recipes always show, even with nothing on hand for them.
    const shown = new Set(ok.map((m) => m.recipe.id));
    return { matches: ok, hidden: ranked.length - ok.length, mine: recipes.filter((r) => isCustom(r.id) && !shown.has(r.id)) };
  }, [items, recipes, profile]);
  const plan = usePlan();
  const [view, setView] = useState<'ideas' | 'week'>('ideas');

  if (!can(plan, 'recipes')) {
    return (
      <Locked
        title="Cook from what you have"
        body="See recipes ranked by what's already in your kitchen and what's about to expire, then deduct ingredients in one tap."
      />
    );
  }

  const tabs = (
    <View style={{ flexDirection: 'row', paddingHorizontal: space(4), paddingTop: space(3) }}>
      <Chip label="Ideas" active={view === 'ideas'} onPress={() => setView('ideas')} />
      <Chip label="This week" active={view === 'week'} onPress={() => setView('week')} />
      {view === 'ideas' && others.length > 0 && (
        <Chip
          label={fitEveryone ? `Fits all ${others.length + 1} of you` : 'Fits just me'}
          active={fitEveryone}
          onPress={() => setFitEveryone(!fitEveryone)}
        />
      )}
    </View>
  );

  if (view === 'week') {
    return (
      <View style={{ flex: 1 }}>
        {tabs}
        {can(plan, 'mealPlanner') ? (
          <WeekPlan />
        ) : (
          <Locked title="Plan the week" body="Put recipes on days and get one shopping list for everything you're missing." />
        )}
      </View>
    );
  }

  const hiddenNote =
    hidden > 0 ? (
      <Pressable onPress={() => router.push('/diet')}>
        <Text style={styles.hidden}>
          {hidden} {hidden === 1 ? 'recipe is' : 'recipes are'} hidden because {hidden === 1 ? "it doesn't" : "they don't"} fit {fitEveryone && others.length ? "everyone's diets" : 'your diet'}. Edit
        </Text>
      </Pressable>
    ) : null;

  const yours = (
    <>
      {mine.length > 0 && <SectionTitle>Your recipes</SectionTitle>}
      {mine.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.top}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.time}>{r.minutes} min</Text>
          </View>
        </Pressable>
      ))}
      <Button kind="secondary" title="Add your own recipe" onPress={() => router.push('/recipe-edit')} style={{ marginTop: space(2) }} />
    </>
  );

  if (matches.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {tabs}
        <Empty
          title="No matches yet"
          body={
            hidden > 0
              ? 'None of the recipes that use your groceries fit your diet yet. Add more groceries for more ideas.'
              : 'Add groceries and recipes appear here, ranked by what you already have and what needs using up first.'
          }
        />
        <View style={{ paddingHorizontal: space(4) }}>{yours}</View>
        {hiddenNote}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: 0, paddingBottom: space(16) }}>
      <View style={{ marginHorizontal: -space(4), marginBottom: space(3) }}>{tabs}</View>
      {matches.map((m) => (
        <Pressable
          key={m.recipe.id}
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: m.recipe.id } })}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.top}>
            <Text style={styles.title}>{m.recipe.title}</Text>
            <Text style={styles.time}>{m.recipe.minutes} min</Text>
          </View>
          {m.rescues.length > 0 && (
            <View style={styles.rescue}>
              <Text style={styles.rescueText}>Uses up: {m.rescues.map((r) => r.name).join(', ')}</Text>
            </View>
          )}
          <Text style={styles.meta}>
            {m.missing.length === 0
              ? `You have everything (${m.have.length} ingredients)`
              : `You have ${m.have.length} of ${m.have.length + m.missing.length} · need ${m.missing
                  .map((x) => x.name)
                  .join(', ')}`}
          </Text>
          {m.fit.skip.length > 0 && !isEmptyProfile(profile) && (
            <Text style={styles.skip}>Leave out: {m.fit.skip.map((c) => c.ingredient.name).join(', ')}</Text>
          )}
        </Pressable>
      ))}
      {yours}
      {hiddenNote}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: space(4),
    marginBottom: space(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: space(2) },
  time: { fontSize: 13, color: colors.muted },
  rescue: { alignSelf: 'flex-start', backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: space(1), marginTop: space(2) },
  rescueText: { fontSize: 12, fontWeight: '600', color: colors.warn },
  skip: { fontSize: 13, color: colors.warn, marginTop: space(1) },
  hidden: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(2), padding: space(4) },
  meta: { fontSize: 14, color: colors.muted, marginTop: space(2), lineHeight: 19 },
});
