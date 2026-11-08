import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { colors, space } from '../components/theme';
import { pickChecks } from '../lib/confidence';
import type { FillLevel, InventoryItem } from '../lib/types';
import { useStore } from '../store/useStore';

const DAY = 24 * 60 * 60 * 1000;
const SPOT = { fridge: 'fridge', freezer: 'freezer', pantry: 'pantry' } as const;
const SWIPE = 110;

function since(item: InventoryItem): string {
  const anchor = item.checkedAt ?? item.addedAt;
  const days = Math.floor((Date.now() - new Date(anchor).getTime()) / DAY);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `${item.checkedAt ? 'Last checked' : 'Added'} ${when} · in the ${SPOT[item.storage]}`;
}

/** The 10-second pantry check: a few cards, one per item the app is least sure about. */
export default function PantryCheckScreen() {
  const items = useStore((s) => s.items);
  const confirmItem = useStore((s) => s.confirmItem);
  const finishItem = useStore((s) => s.finishItem);
  const finishCheck = useStore((s) => s.finishCheck);
  // Picked once when the screen opens, so answering doesn't reshuffle the stack.
  const [queue] = useState(() => pickChecks(items));
  const [index, setIndex] = useState(0);
  const card = queue[index];
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (queue.length === 0) finishCheck();
  }, [queue, finishCheck]);

  function next() {
    x.setValue(0);
    if (index + 1 >= queue.length) finishCheck();
    setIndex((i) => i + 1);
  }

  function answer(kind: FillLevel | 'used' | 'tossed') {
    if (!card) return;
    if (kind === 'used' || kind === 'tossed') finishItem(card.id, kind);
    else confirmItem(card.id, kind);
    next();
  }

  const answerRef = useRef(answer);
  answerRef.current = answer;
  const fillRef = useRef<FillLevel>('full');
  fillRef.current = card?.fill ?? 'full';

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => x.setValue(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE) answerRef.current(fillRef.current);
          else if (g.dx < -SWIPE) answerRef.current('used');
          else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [x],
  );

  if (queue.length === 0 || !card) {
    return (
      <View style={styles.center}>
        <Text style={styles.big}>{queue.length === 0 ? 'Nothing to check' : 'All set'}</Text>
        <Text style={styles.body}>
          {queue.length === 0
            ? 'Everything in your kitchen was bought or checked recently.'
            : `Your kitchen is up to date. Checked ${queue.length} ${queue.length === 1 ? 'item' : 'items'}.`}
        </Text>
        <Button title="Done" onPress={() => router.back()} style={{ marginTop: space(6), alignSelf: 'stretch' }} />
      </View>
    );
  }

  const rotate = x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space(4) }}>
      <Text style={styles.progress}>
        {index + 1} of {queue.length}
      </Text>
      <Animated.View {...pan.panHandlers} style={[styles.card, { transform: [{ translateX: x }, { rotate }] }]}>
        <Text style={styles.question}>Still have</Text>
        <Text style={styles.big}>{card.name}?</Text>
        <Text style={styles.body}>{since(card)}</Text>
        <Text style={[styles.body, { marginTop: space(6), fontSize: 13 }]}>Swipe right if it's still there, left if it's gone.</Text>
      </Animated.View>

      <Text style={styles.label}>Still there, with</Text>
      <View style={styles.row}>
        {(['full', 'half', 'low'] as const).map((f) => (
          <Pressable key={f} onPress={() => answer(f)} style={[styles.choice, card.fill === f && styles.choiceOn]}>
            <Text style={styles.choiceText}>{f === 'full' ? 'Plenty' : f === 'half' ? 'About half' : 'A little'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Gone</Text>
      <View style={styles.row}>
        <Pressable onPress={() => answer('used')} style={styles.choice}>
          <Text style={styles.choiceText}>Used it up</Text>
        </Pressable>
        <Pressable onPress={() => answer('tossed')} style={styles.choice}>
          <Text style={[styles.choiceText, { color: colors.danger }]}>Threw it out</Text>
        </Pressable>
      </View>
      <Pressable onPress={next} style={{ alignSelf: 'center', marginTop: space(4) }} hitSlop={10}>
        <Text style={styles.body}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: space(6), justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  progress: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: space(3) },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: space(6),
    minHeight: 220,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  question: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  big: { fontSize: 28, fontWeight: '700', color: colors.text, marginVertical: space(1), textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, textAlign: 'center' },
  label: { fontSize: 13, color: colors.muted, marginTop: space(5), marginBottom: space(2) },
  row: { flexDirection: 'row', gap: space(2) },
  choice: {
    flex: 1,
    paddingVertical: space(3),
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  choiceOn: { borderColor: colors.primary },
  choiceText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
