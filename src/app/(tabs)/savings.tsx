import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, SectionTitle } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { moneyStats, useStore } from '../../store/useStore';
import { Locked } from '../../components/Locked';
import { usePlan } from '../../billing/billing';
import { can } from '../../lib/plans';
import { priceChanges, priceInsight } from '../../lib/prices';
import { PriceTag } from '../../components/PriceTag';
import { adviceText, buySizeAdvice } from '../../lib/buysize';

const money = (n: number) => `$${n.toFixed(2)}`;

export default function SavingsScreen() {
  const log = useStore((s) => s.log);
  const stats = moneyStats(log);
  const sizes = buySizeAdvice(log).slice(0, 4);
  const sizeSavings = sizes.reduce((s, a) => s + a.wastedPerMonth, 0);
  const month = new Date().toLocaleString(undefined, { month: 'long' });
  const plan = usePlan();
  const priceHistory = useStore((s) => s.priceHistory);

  if (!can(plan, 'savings')) {
    const teaser = stats.tossedCount > 0 ? `You've thrown out ${stats.tossedCount} items this month. ` : '';
    return (
      <Locked
        title="See where your grocery money goes"
        body={`${teaser}Track dollars eaten vs. thrown out, the foods you waste most, and when prices go up.`}
      />
    );
  }

  const changes = priceChanges(priceHistory).slice(0, 5);
  const usual = Object.entries(priceHistory)
    .map(([k, e]) => priceInsight(k, e))
    .filter((i) => i !== null && i.purchases >= 2)
    .sort((a, b) => b!.purchases - a!.purchases)
    .slice(0, 8);

  if (log.length === 0 && Object.keys(priceHistory).length === 0) {
    return (
      <Empty
        title="Nothing tracked yet"
        body="When you use up or throw out food, this page shows how much of your grocery money you actually ate. Scanned receipts also track what you pay."
      />
    );
  }

  const total = stats.usedValue + stats.tossedValue;
  const eatenShare = total > 0 ? stats.usedValue / total : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
      {log.length > 0 && (
        <Card>
          <Text style={styles.kicker}>{month}</Text>
          <Text style={styles.headline}>
            You ate {money(stats.usedValue)} of food and threw out {money(stats.tossedValue)}.
          </Text>
          {total > 0 && (
            <>
              <View style={styles.bar}>
                <View style={[styles.barUsed, { flex: eatenShare }]} />
                <View style={[styles.barTossed, { flex: 1 - eatenShare }]} />
              </View>
              <Text style={styles.note}>
                {Math.round(stats.wasteRate * 100)}% of tracked groceries went to waste this month.
              </Text>
            </>
          )}
          <Text style={styles.note}>
            {stats.usedCount} items used, {stats.tossedCount} thrown out. Items without a price from a receipt count as $0.
          </Text>
        </Card>
      )}

      {stats.mostTossed.length > 0 && (
        <>
          <SectionTitle>Most often thrown out</SectionTitle>
          {stats.mostTossed.map((m) => (
            <View key={m.name} style={styles.row}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.meta}>
                {m.times}× · {money(m.value)}
              </Text>
            </View>
          ))}
          <Text style={styles.tip}>
            Tip: buy {stats.mostTossed[0].name.toLowerCase()} in smaller amounts, or freeze it the day you buy it.
          </Text>
        </>
      )}

      {sizes.length > 0 && (
        <>
          <SectionTitle>Buy the right size</SectionTitle>
          {sizes.map((a) => (
            <View key={a.key} style={styles.row}>
              <Text style={[styles.name, { flex: 1 }]}>{adviceText(a)}</Text>
            </View>
          ))}
          {sizeSavings >= 1 && (
            <Text style={styles.tip}>Buying these in the size you actually finish could save about {money(sizeSavings)} a month.</Text>
          )}
        </>
      )}

      {changes.length > 0 && (
        <>
          <SectionTitle>Price changes</SectionTitle>
          {changes.map((c) => (
            <View key={c.key} style={styles.row}>
              <Text style={styles.name}>{c.name}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.meta}>
                  {money(c.last)}/{c.unit} · usually {money(c.usual!)}
                </Text>
                <PriceTag change={c.change} />
              </View>
            </View>
          ))}
        </>
      )}

      {usual.length > 0 && (
        <>
          <SectionTitle>What you usually pay</SectionTitle>
          {usual.map((u) => (
            <View key={u!.key} style={styles.row}>
              <Text style={styles.name}>{u!.name}</Text>
              <Text style={styles.meta}>
                {money(u!.usual ?? u!.last)}/{u!.unit} · lowest {money(u!.lowest)}
              </Text>
            </View>
          ))}
          <Text style={styles.tip}>Prices come from scanned receipts. Scan every trip to see when something gets pricier.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: space(2), lineHeight: 29 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: space(4), backgroundColor: colors.border },
  barUsed: { backgroundColor: colors.primary },
  barTossed: { backgroundColor: colors.danger },
  note: { fontSize: 14, color: colors.muted, marginTop: space(2), lineHeight: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(3),
    marginBottom: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
  tip: { fontSize: 14, color: colors.muted, marginTop: space(2), lineHeight: 20 },
});
