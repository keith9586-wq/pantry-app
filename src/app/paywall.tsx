import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components/ui';
import { colors, space } from '../components/theme';
import { purchase, restore, trialLabel, usePlan, usePlanState } from '../billing/billing';
import { FREE_SCANS_PER_MONTH, PLAN_COPY, type Plan } from '../lib/plans';

export default function PaywallScreen() {
  const plan = usePlan();
  const configured = usePlanState((s) => s.configured);
  const packages = usePlanState((s) => s.packages);
  const [busy, setBusy] = useState(false);

  async function buy(kind: 'plus' | 'family') {
    setBusy(true);
    try {
      if (await purchase(kind)) {
        Alert.alert('Thanks for subscribing', `${PLAN_COPY[kind].title} is now active.`);
        router.back();
      }
    } catch (e) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const card = (kind: 'plus' | 'family', current: Plan) => {
    const copy = PLAN_COPY[kind];
    const price = packages[kind]?.product.priceString ? `${packages[kind]!.product.priceString}/month` : copy.fallbackPrice;
    const trial = trialLabel(kind);
    const active = current === kind || (kind === 'plus' && current === 'family');
    return (
      <Card style={kind === 'family' ? { ...styles.card, borderColor: colors.primary, borderWidth: 2 } : styles.card}>
        <View style={styles.top}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        {copy.perks.map((p) => (
          <Text key={p} style={styles.perk}>
            ✓ {p}
          </Text>
        ))}
        <Button
          title={active ? 'Your plan' : trial ? `Start ${trial}` : `Get ${copy.title}`}
          onPress={() => buy(kind)}
          disabled={busy || active || !configured || !packages[kind]}
          kind={kind === 'family' ? 'primary' : 'secondary'}
          style={{ marginTop: space(4) }}
        />
      </Card>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      <Text style={styles.lead}>Stop paying for food you throw away</Text>
      <Text style={styles.body}>
        The free plan includes {FREE_SCANS_PER_MONTH} receipt scans a month, barcode scanning and use-by alerts. Upgrade for the rest.
      </Text>
      {card('plus', plan)}
      {card('family', plan)}
      {!configured && (
        <Text style={styles.note}>
          Subscriptions aren't connected in this build, so every feature is unlocked. Add the RevenueCat keys to .env to sell plans.
        </Text>
      )}
      <Button
        kind="secondary"
        title="Restore purchases"
        disabled={!configured || busy}
        onPress={async () => {
          try {
            const p = await restore();
            Alert.alert('Purchases restored', p === 'free' ? 'No active subscription was found.' : `${PLAN_COPY[p].title} is active.`);
          } catch (e) {
            Alert.alert('Could not restore', e instanceof Error ? e.message : String(e));
          }
        }}
        style={{ marginTop: space(6) }}
      />
      <Text style={styles.note}>Subscriptions renew automatically until cancelled in your app store account settings.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: space(2), marginBottom: space(2) },
  card: { marginTop: space(4) },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  price: { fontSize: 16, color: colors.text },
  perk: { fontSize: 15, color: colors.text, marginTop: space(1.5) },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(4), lineHeight: 19 },
});
