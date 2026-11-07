import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { ALLERGEN_LABEL, DIET_LABEL, parseDislikes, type Allergen, type Diet } from '../lib/diet';
import { useStore } from '../store/useStore';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function DietScreen() {
  const profile = useStore((s) => s.dietProfile);
  const setProfile = useStore((s) => s.setDietProfile);
  const [dislikes, setDislikes] = useState(profile.dislikes.join(', '));

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <Text style={styles.body}>Recipes that don't fit are hidden, and optional ingredients that don't fit are marked to leave out.</Text>

      <SectionTitle>Diet</SectionTitle>
      <View style={styles.chips}>
        {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
          <Chip key={d} label={DIET_LABEL[d]} active={profile.diets.includes(d)} onPress={() => setProfile({ ...profile, diets: toggle(profile.diets, d) })} />
        ))}
      </View>

      <SectionTitle>Allergies</SectionTitle>
      <View style={styles.chips}>
        {(Object.keys(ALLERGEN_LABEL) as Allergen[]).map((a) => (
          <Chip
            key={a}
            label={ALLERGEN_LABEL[a]}
            active={profile.allergies.includes(a)}
            onPress={() => setProfile({ ...profile, allergies: toggle(profile.allergies, a) })}
          />
        ))}
      </View>

      <SectionTitle>Foods you don't eat</SectionTitle>
      <Input
        value={dislikes}
        onChangeText={setDislikes}
        onEndEditing={() => setProfile({ ...profile, dislikes: parseDislikes(dislikes) })}
        onBlur={() => setProfile({ ...profile, dislikes: parseDislikes(dislikes) })}
        placeholder="mushrooms, olives"
        autoCapitalize="none"
      />
      <Text style={styles.note}>
        Allergy matching uses ingredient names, so always check labels on packaged food. These settings stay on this phone.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2) },
  note: { fontSize: 13, color: colors.muted, marginTop: space(4), lineHeight: 19 },
});
