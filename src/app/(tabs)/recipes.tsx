import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Empty } from '../../components/ui';
import { Locked } from '../../components/Locked';
import { usePlan } from '../../billing/billing';
import { can } from '../../lib/plans';
import { colors, space } from '../../components/theme';
import { RECIPES } from '../../data/recipes';
import { rankRecipes } from '../../lib/recipes';
import { useStore } from '../../store/useStore';

export default function RecipesScreen() {
  const items = useStore((s) => s.items);
  const matches = useMemo(() => rankRecipes(items, RECIPES), [items]);
  const plan = usePlan();

  if (!can(plan, 'recipes')) {
    return (
      <Locked
        title="Cook from what you have"
        body="See recipes ranked by what's already in your kitchen and what's about to expire, then deduct ingredients in one tap."
      />
    );
  }

  if (matches.length === 0) {
    return (
      <Empty
        title="No matches yet"
        body="Add groceries and recipes appear here, ranked by what you already have and what needs using up first."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
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
        </Pressable>
      ))}
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
  meta: { fontSize: 14, color: colors.muted, marginTop: space(2), lineHeight: 19 },
});
