import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { buildRecipe, parseIngredients, toDraft, type RecipeDraft } from '../lib/customRecipe';
import { uuid } from '../lib/id';
import { useStore } from '../store/useStore';

const BLANK: RecipeDraft = { title: '', minutes: '', servings: '', ingredients: '', steps: '' };

export default function RecipeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.customRecipes.find((r) => r.id === id));
  const saveRecipe = useStore((s) => s.saveRecipe);
  const [draft, setDraft] = useState<RecipeDraft>(existing ? toDraft(existing) : BLANK);
  const set = (k: keyof RecipeDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const preview = parseIngredients(draft.ingredients);

  function save() {
    const r = buildRecipe(draft, existing?.id ?? uuid());
    if ('error' in r) return Alert.alert('Almost there', r.error);
    saveRecipe(r);
    if (existing) router.back();
    else router.replace({ pathname: '/recipe/[id]', params: { id: r.id } });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit recipe' : 'New recipe' }} />
      <Input value={draft.title} onChangeText={set('title')} placeholder="Recipe name" />
      <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
        <Input value={draft.minutes} onChangeText={set('minutes')} placeholder="Minutes" keyboardType="number-pad" style={{ flex: 1 }} />
        <Input value={draft.servings} onChangeText={set('servings')} placeholder="Serves" keyboardType="number-pad" style={{ flex: 1 }} />
      </View>

      <SectionTitle>Ingredients</SectionTitle>
      <Input
        value={draft.ingredients}
        onChangeText={set('ingredients')}
        placeholder={'One per line, like:\n2 cups flour\n3 eggs\n1 onion, chopped'}
        multiline
        style={styles.area}
      />
      {preview.length > 0 && (
        <Text style={styles.preview}>
          Reads as: {preview.map((i) => `${i.quantity}${i.unit === 'each' ? '' : ` ${i.unit}`} ${i.name}${i.optional ? ' (optional)' : ''}`).join(' · ')}
        </Text>
      )}

      <SectionTitle>Steps</SectionTitle>
      <Input value={draft.steps} onChangeText={set('steps')} placeholder="One step per line" multiline style={styles.area} />

      <Button title={existing ? 'Save changes' : 'Save recipe'} onPress={save} style={{ marginTop: space(6) }} />
      <Text style={styles.hint}>Tip: paste a recipe from a website or a note straight into these boxes.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  area: { minHeight: 120, textAlignVertical: 'top' },
  preview: { fontSize: 13, color: colors.muted, marginTop: space(2), lineHeight: 19 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(3) },
});
