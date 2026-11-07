import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { buildRecipe, parseIngredients, toDraft, type RecipeDraft } from '../lib/customRecipe';
import { uuid } from '../lib/id';
import { importRecipe, normalizeUrl } from '../lib/recipeImport';
import { useStore } from '../store/useStore';

const BLANK: RecipeDraft = { title: '', minutes: '', servings: '', ingredients: '', steps: '' };

export default function RecipeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.customRecipes.find((r) => r.id === id));
  const saveRecipe = useStore((s) => s.saveRecipe);
  const [draft, setDraft] = useState<RecipeDraft>(existing ? toDraft(existing) : BLANK);
  const set = (k: keyof RecipeDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const preview = parseIngredients(draft.ingredients);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  async function fromLink() {
    const url = normalizeUrl(link);
    if (!url) return Alert.alert('Check the link', 'Paste the full address of a recipe page.');
    setLoading(true);
    try {
      setDraft(await importRecipe(url));
      setImported(true);
    } catch (e) {
      Alert.alert('No recipe found', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

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
      {!existing && (
        <Card style={{ marginBottom: space(4) }}>
          <Text style={styles.cardTitle}>Import from a link</Text>
          <Text style={styles.cardBody}>Paste a recipe page from almost any recipe site and we'll fill this in.</Text>
          <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(3), alignItems: 'center' }}>
            <Input
              value={link}
              onChangeText={setLink}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={fromLink}
              style={{ flex: 1 }}
            />
            {loading ? <ActivityIndicator color={colors.primary} /> : <Button title="Get" onPress={fromLink} disabled={!link.trim()} />}
          </View>
          {imported && <Text style={styles.cardBody}>Imported. Check it over below, then save.</Text>}
        </Card>
      )}
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 14, color: colors.muted, marginTop: space(1), lineHeight: 20 },
  area: { minHeight: 120, textAlignVertical: 'top' },
  preview: { fontSize: 13, color: colors.muted, marginTop: space(2), lineHeight: 19 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(3) },
});
