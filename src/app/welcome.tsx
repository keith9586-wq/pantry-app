import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { colors, space } from '../components/theme';
import { sampleInputs } from '../data/sample';
import { isEmptyProfile } from '../lib/diet';
import { enableReminders } from '../notify/reminders';
import { useStore } from '../store/useStore';

type Step = 'intro' | 'who' | 'setup' | 'start';
const ORDER: Step[] = ['intro', 'who', 'setup', 'start'];

function Dots({ step }: { step: Step }) {
  return (
    <View style={styles.dots}>
      {ORDER.map((s) => (
        <View key={s} style={[styles.dot, s === step && { backgroundColor: colors.primary, width: 18 }]} />
      ))}
    </View>
  );
}

function Point({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.point}>
      <Text style={styles.pointIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const [step, setStep] = useState<Step>('intro');
  const [shared, setShared] = useState(false);
  const remindersOn = useStore((s) => s.remindersOn);
  const diet = useStore((s) => s.dietProfile);
  const addItems = useStore((s) => s.addItems);
  const clearUndo = useStore((s) => s.clearUndo);
  const setOnboarded = useStore((s) => s.setOnboarded);

  const next = () => setStep(ORDER[ORDER.indexOf(step) + 1]);

  function finish(then: 'scan' | 'sample' | 'empty') {
    setOnboarded();
    if (then === 'sample') {
      addItems(sampleInputs(new Date()));
      clearUndo();
    }
    router.replace(then === 'scan' ? '/scan' : '/');
    if (shared) router.push('/household');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <Dots step={step} />
        {step !== 'start' && (
          <Pressable onPress={() => finish('empty')} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {step === 'intro' && (
          <>
            <Text style={styles.title}>Eat what you buy.</Text>
            <Text style={styles.lead}>Pantry keeps track of your fridge, freezer and cupboards so less food goes in the bin.</Text>
            <Point icon="🧾" title="Scan a receipt" body="Everything you bought lands in your kitchen with a use-by date." />
            <Point icon="⏰" title="Hear about it before it goes bad" body="A morning heads-up for what to use first." />
            <Point icon="🍳" title="Cook from what you have" body="Recipes ranked by what's on hand and what's about to expire." />
            <Point icon="💵" title="See the money you save" body="Track what you ate versus what you threw out." />
          </>
        )}

        {step === 'who' && (
          <>
            <Text style={styles.title}>Who shops and cooks?</Text>
            <Text style={styles.lead}>You can change this any time in Settings.</Text>
            <Pressable onPress={() => setShared(false)} style={[styles.option, !shared && styles.optionOn]}>
              <Text style={styles.optionTitle}>Just me</Text>
              <Text style={styles.optionBody}>Your kitchen stays on this phone.</Text>
            </Pressable>
            <Pressable onPress={() => setShared(true)} style={[styles.option, shared && styles.optionOn]}>
              <Text style={styles.optionTitle}>Me and others at home</Text>
              <Text style={styles.optionBody}>Share one kitchen and shopping list. You'll create a household or join one with a code at the end.</Text>
            </Pressable>
          </>
        )}

        {step === 'setup' && (
          <>
            <Text style={styles.title}>Two quick things</Text>
            <Text style={styles.lead}>Both are optional.</Text>
            <View style={styles.option}>
              <Text style={styles.optionTitle}>Morning reminders</Text>
              <Text style={styles.optionBody}>One notification the morning before food expires. Nothing else.</Text>
              <Button
                kind={remindersOn ? 'secondary' : 'primary'}
                title={remindersOn ? 'Reminders are on ✓' : 'Turn on reminders'}
                onPress={() => enableReminders()}
                disabled={remindersOn}
                style={{ marginTop: space(3) }}
              />
            </View>
            <View style={styles.option}>
              <Text style={styles.optionTitle}>Diet and allergies</Text>
              <Text style={styles.optionBody}>Hide recipes that don't fit and get warnings when you scan a barcode.</Text>
              <Button
                kind="secondary"
                title={isEmptyProfile(diet) ? 'Set diet and allergies' : 'Edit diet and allergies ✓'}
                onPress={() => router.push('/diet')}
                style={{ marginTop: space(3) }}
              />
            </View>
          </>
        )}

        {step === 'start' && (
          <>
            <Text style={styles.title}>Fill your kitchen</Text>
            <Text style={styles.lead}>The fastest way is your last grocery receipt. Paper or a photo of the screen both work.</Text>
            <Button title="Scan a receipt" onPress={() => finish('scan')} style={{ marginTop: space(4) }} />
            <Button kind="secondary" title="Try it with sample groceries" onPress={() => finish('sample')} style={{ marginTop: space(2) }} />
            <Button kind="secondary" title="Start with an empty kitchen" onPress={() => finish('empty')} style={{ marginTop: space(2) }} />
            <Text style={styles.note}>Sample groceries are normal items. Tick them off or throw them out whenever you like.</Text>
          </>
        )}
      </ScrollView>
      {step !== 'start' && (
        <View style={styles.footer}>
          <Button title="Continue" onPress={next} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(3) },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  skip: { fontSize: 16, color: colors.muted },
  body: { padding: space(5), paddingBottom: space(10) },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: space(4) },
  lead: { fontSize: 17, color: colors.muted, lineHeight: 24, marginTop: space(2), marginBottom: space(4) },
  point: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  pointIcon: { fontSize: 26, width: 36 },
  pointTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  pointBody: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: 2 },
  option: { backgroundColor: colors.card, borderRadius: 14, padding: space(4), borderWidth: 1.5, borderColor: colors.border, marginTop: space(3) },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  optionBody: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: space(1) },
  note: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space(4), lineHeight: 19 },
  footer: { padding: space(5), paddingTop: space(2) },
});
