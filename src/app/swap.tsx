import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Empty, Input } from '../components/ui';
import { colors, space } from '../components/theme';
import { areaOf, goodUntilLabel, sortOffers, type Claim, type Offer } from '../lib/surplus';
import { acceptClaim, askFor, giverContact, listClaims, listOffers, reportOffer, setOfferStatus } from '../sync/surplus';
import { useStore } from '../store/useStore';

type View_ = 'nearby' | 'mine';

/** The neighbor food swap: open offers in your area, and the ones you posted or asked for. */
export default function SwapScreen() {
  const swap = useStore((s) => s.swap);
  const setSwap = useStore((s) => s.setSwap);
  const offerItems = useStore((s) => s.offerItems);
  const finishItem = useStore((s) => s.finishItem);
  const area = areaOf(swap.zip);
  const [tab, setTab] = useState<View_>('nearby');
  const [me, setMe] = useState('');
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!area) return;
    try {
      const [{ me: id, offers: list }, cl] = await Promise.all([listOffers(area), listClaims()]);
      setMe(id);
      setOffers(sortOffers(list));
      setClaims(cl);
      // Unlock contacts for requests that were accepted.
      const accepted = cl.filter((c) => c.claimer === id && c.accepted);
      const found: Record<string, string> = {};
      for (const c of accepted) {
        const contact = await giverContact(c.offer_id);
        if (contact) found[c.offer_id] = contact;
      }
      setContacts(found);
    } catch (e) {
      setOffers([]);
      Alert.alert('Could not load the swap', e instanceof Error ? e.message : String(e));
    }
  }, [area]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!area) {
    return (
      <View style={{ padding: space(4) }}>
        <Text style={styles.body}>Enter your ZIP code to see food neighbors are giving away. Only the first 3 digits are used.</Text>
        <Input value={swap.zip} onChangeText={(zip) => setSwap({ ...swap, zip })} placeholder="ZIP code" keyboardType="number-pad" maxLength={5} style={{ marginTop: space(3) }} />
      </View>
    );
  }
  if (!offers) return <ActivityIndicator style={{ marginTop: space(10) }} color={colors.primary} />;

  const nearby = offers.filter((o) => o.owner !== me && o.status === 'open' && !claims.some((c) => c.offer_id === o.id && c.claimer === me));
  const mine = offers.filter((o) => o.owner === me && o.status !== 'withdrawn' && o.status !== 'gone');
  const asked = offers.filter((o) => claims.some((c) => c.offer_id === o.id && c.claimer === me));

  async function ask(o: Offer) {
    if (!swap.name.trim()) return Alert.alert('Add your first name', 'The giver sees it with your request.');
    try {
      await askFor(o.id, swap.name.trim().slice(0, 30), message.trim().slice(0, 200));
      setAsking(null);
      setMessage('');
      Alert.alert('Asked', `${o.giver} will see your request. If they pick you, their contact shows up under Mine.`);
      load();
    } catch (e) {
      Alert.alert('Could not ask', e instanceof Error ? e.message : String(e));
    }
  }

  async function handedOver(o: Offer) {
    await setOfferStatus(o.id, 'gone').catch(() => {});
    const itemId = offerItems[o.id];
    // Given away isn't wasted: it leaves the kitchen as used.
    if (itemId) finishItem(itemId, 'used');
    load();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', marginBottom: space(3) }}>
        <Chip label={`Nearby (${nearby.length})`} active={tab === 'nearby'} onPress={() => setTab('nearby')} />
        <Chip label={`Mine (${mine.length + asked.length})`} active={tab === 'mine'} onPress={() => setTab('mine')} />
      </View>

      {tab === 'nearby' ? (
        nearby.length === 0 ? (
          <Empty
            title="Nothing offered near you right now"
            body="When neighbors post food they won't get to, it shows up here. Post your own from any item: tap it in your kitchen, then Give it away."
          />
        ) : (
          nearby.map((o) => (
            <View key={o.id} style={styles.card}>
              <Text style={styles.name}>
                {o.name}
                {o.amount ? ` · ${o.amount}` : ''}
              </Text>
              <Text style={styles.meta}>
                From {o.giver} · {goodUntilLabel(o.good_until)}
                {o.pickup_area ? ` · ${o.pickup_area}` : ''}
              </Text>
              {o.note ? <Text style={styles.body}>{o.note}</Text> : null}
              {asking === o.id ? (
                <>
                  <Input
                    value={swap.name}
                    onChangeText={(name) => setSwap({ ...swap, name })}
                    placeholder="Your first name"
                    maxLength={30}
                    style={{ marginTop: space(2) }}
                  />
                  <Input value={message} onChangeText={setMessage} placeholder="Message, e.g. when you could pick up" maxLength={200} style={{ marginTop: space(2) }} />
                  <Button title="Send request" onPress={() => ask(o)} style={{ marginTop: space(2) }} />
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2) }}>
                  <Button title="Ask for it" onPress={() => setAsking(o.id)} style={{ flex: 1 }} />
                  <Pressable
                    onPress={() =>
                      Alert.alert('Report this offer?', 'Offers reported by two people are hidden.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Report', style: 'destructive', onPress: () => reportOffer(o.id).then(load, () => {}) },
                      ])
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.meta}>Report</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )
      ) : (
        <>
          {mine.length === 0 && asked.length === 0 && <Empty title="Nothing yet" body="Food you post or ask for shows up here." />}
          {mine.map((o) => {
            const requests = claims.filter((c) => c.offer_id === o.id);
            const promised = requests.find((c) => c.accepted);
            return (
              <View key={o.id} style={styles.card}>
                <Text style={styles.name}>Your {o.name.toLowerCase()}</Text>
                <Text style={styles.meta}>
                  {promised ? `Promised to ${promised.claimer_name}` : requests.length ? `${requests.length} asked` : 'No requests yet'} · {goodUntilLabel(o.good_until)}
                </Text>
                {!promised &&
                  requests.map((c) => (
                    <View key={c.id} style={styles.request}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.body}>{c.claimer_name}</Text>
                        {c.message ? <Text style={styles.meta}>{c.message}</Text> : null}
                      </View>
                      <Pressable onPress={() => acceptClaim(c.id).then(load, (e) => Alert.alert('Could not accept', String(e)))} hitSlop={8}>
                        <Text style={styles.action}>Give to {c.claimer_name}</Text>
                      </Pressable>
                    </View>
                  ))}
                {promised && (
                  <Text style={styles.body}>They can now see how to reach you. When it's picked up, mark it handed over.</Text>
                )}
                <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
                  {promised && <Button title="Handed over" onPress={() => handedOver(o)} style={{ flex: 1 }} />}
                  <Button kind="secondary" title="Take it down" onPress={() => setOfferStatus(o.id, 'withdrawn').then(load, () => {})} style={{ flex: 1 }} />
                </View>
              </View>
            );
          })}
          {asked.map((o) => {
            const mineClaim = claims.find((c) => c.offer_id === o.id && c.claimer === me);
            const contact = contacts[o.id];
            return (
              <View key={o.id} style={styles.card}>
                <Text style={styles.name}>
                  {o.name} from {o.giver}
                </Text>
                <Text style={styles.meta}>
                  {mineClaim?.accepted ? "It's yours" : o.status === 'open' ? 'Waiting for an answer' : 'Went to someone else'} · {goodUntilLabel(o.good_until)}
                </Text>
                {contact && (
                  <Text style={styles.body}>
                    Reach {o.giver} at <Text style={{ fontWeight: '700' }}>{contact}</Text>
                    {o.pickup_area ? `, pickup ${o.pickup_area}` : ''}.
                  </Text>
                )}
              </View>
            );
          })}
        </>
      )}
      <Text style={styles.note}>
        Be kind and stay safe: meet somewhere public if you like, and only share food that's unopened or whole. Raw meat, fish and home-cooked food
        can't be posted here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: space(4), marginBottom: space(3), borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21, marginTop: space(1) },
  request: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2), paddingTop: space(2), borderTopWidth: 1, borderColor: colors.border },
  action: { fontSize: 15, fontWeight: '600', color: colors.primary },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: space(4) },
});
