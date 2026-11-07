import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text } from 'react-native';
import { Button, Card, Empty, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { areaOf, goodUntil, goodUntilLabel, nearbyBlock, offerAmount, shareText } from '../lib/surplus';
import { supabase } from '../sync/client';
import { postOffer } from '../sync/surplus';
import { useStore } from '../store/useStore';

/** Give food away before it spoils: to friends through the share sheet, or to neighbors on the swap board. */
export default function GiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore((s) => s.items.find((i) => i.id === id));
  const swap = useStore((s) => s.swap);
  const setSwap = useStore((s) => s.setSwap);
  const linkOffer = useStore((s) => s.linkOffer);
  const [pickup, setPickup] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!item) return <Empty title="Item not found" body="It may already be gone." />;
  const block = nearbyBlock(item);
  const area = areaOf(swap.zip);
  const ready = !!area && swap.name.trim().length > 0 && swap.contact.trim().length >= 3;

  async function post() {
    if (!item || !area) return;
    setBusy(true);
    try {
      const offer = await postOffer(
        {
          zip3: area,
          giver: swap.name.trim().slice(0, 30),
          name: item.name.slice(0, 60),
          amount: offerAmount(item).slice(0, 30),
          category: item.category,
          good_until: goodUntil(item),
          pickup_area: pickup.trim().slice(0, 60),
          note: note.trim().slice(0, 200),
        },
        swap.contact.trim().slice(0, 120),
      );
      linkOffer(offer.id, item.id);
      Alert.alert('Posted', "Neighbors nearby can ask for it. You'll choose who gets it, and only they see how to reach you.");
      router.replace('/swap');
    } catch (e) {
      Alert.alert('Could not post it', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.body}>
        {[offerAmount(item), goodUntilLabel(goodUntil(item))].filter(Boolean).join(' · ')}
      </Text>

      <SectionTitle>To a friend</SectionTitle>
      <Button title="Send to a friend" onPress={() => Share.share({ message: shareText(item) })} />
      <Text style={styles.note}>Opens your phone's share sheet. Nothing goes through Pantry.</Text>

      {supabase && (
        <>
          <SectionTitle>To neighbors</SectionTitle>
          {block ? (
            <Text style={styles.body}>{block}</Text>
          ) : (
            <Card>
              <Input value={swap.name} onChangeText={(name) => setSwap({ ...swap, name })} placeholder="Your first name" maxLength={30} />
              <Input
                value={swap.zip}
                onChangeText={(zip) => setSwap({ ...swap, zip })}
                placeholder="Your ZIP code"
                keyboardType="number-pad"
                maxLength={5}
                style={{ marginTop: space(2) }}
              />
              <Input value={pickup} onChangeText={setPickup} placeholder="Rough pickup area, e.g. near Elm Park" maxLength={60} style={{ marginTop: space(2) }} />
              <Input
                value={swap.contact}
                onChangeText={(contact) => setSwap({ ...swap, contact })}
                placeholder="How to reach you (phone or email)"
                maxLength={120}
                style={{ marginTop: space(2) }}
              />
              <Input value={note} onChangeText={setNote} placeholder="Note (optional)" maxLength={200} style={{ marginTop: space(2) }} />
              <Text style={styles.note}>
                Neighbors in your area ({area ? `${area}xx` : 'first 3 ZIP digits'}) see your first name, the food and the pickup area. Only the person you
                accept sees how to reach you. Unopened or whole food only, please.
              </Text>
              <Button title="Post for neighbors" onPress={post} disabled={!ready || busy} style={{ marginTop: space(3) }} />
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: space(1) },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: space(2) },
});
