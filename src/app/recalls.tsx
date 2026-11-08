import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Empty } from '../components/ui';
import { colors, space } from '../components/theme';
import { matchKey } from '../lib/recalls';
import { useRecallMatches, useStore } from '../store/useStore';

const SPOT = { fridge: 'fridge', freezer: 'freezer', pantry: 'pantry' } as const;

export default function RecallsScreen() {
  const matches = useRecallMatches();
  const dismiss = useStore((s) => s.dismissRecall);
  const finishItem = useStore((s) => s.finishItem);

  if (matches.length === 0) {
    return (
      <Empty
        title="No recalls for your food"
        body="We check FDA and USDA food recalls twice a day against what's in your kitchen and tell you if one matches."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      {matches.map((m) => (
        <View key={matchKey(m)} style={[styles.card, m.strength === 'brand' && styles.cardStrong]}>
          <Text style={styles.kicker}>
            {m.strength === 'brand' ? 'Your brand is recalled' : 'Check the label'} · {m.recall.source === 'fda' ? 'FDA' : 'USDA'}
            {m.recall.serious ? ' · serious' : ''} · {new Date(m.recall.date).toLocaleDateString()}
          </Text>
          <Text style={styles.title}>
            {m.item.name}
            {m.item.brand ? ` (${m.item.brand})` : ''} in your {SPOT[m.item.storage]}
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>Recalled: </Text>
            {m.recall.product}
          </Text>
          {m.recall.firm ? (
            <Text style={styles.body}>
              <Text style={styles.bold}>By: </Text>
              {m.recall.firm}
            </Text>
          ) : null}
          {m.recall.reason ? (
            <Text style={styles.body}>
              <Text style={styles.bold}>Why: </Text>
              {m.recall.reason}
            </Text>
          ) : null}
          <Text style={[styles.body, { marginTop: space(2) }]}>
            {m.strength === 'brand'
              ? "Don't eat it. Throw it out or take it back to the store for a refund."
              : "Compare the brand and lot code on your package with the notice. If they match, don't eat it."}
          </Text>
          <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(3) }}>
            <Button kind="secondary" title="Not mine" onPress={() => dismiss(matchKey(m))} style={{ flex: 1 }} />
            <Button
              kind="danger"
              title="Threw it out"
              onPress={() => {
                finishItem(m.item.id, 'tossed');
                dismiss(matchKey(m));
              }}
              style={{ flex: 1 }}
            />
          </View>
          <Text style={styles.link} onPress={() => Linking.openURL(m.recall.url)}>
            Read recall notices
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: space(4), marginBottom: space(3), borderWidth: 1, borderColor: colors.border },
  cardStrong: { borderColor: colors.danger },
  kicker: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginVertical: space(1) },
  body: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: space(1) },
  bold: { fontWeight: '600' },
  link: { fontSize: 14, color: colors.primary, marginTop: space(3) },
});
