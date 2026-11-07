import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { useStore } from '../store/useStore';
import { supabase } from '../sync/client';
import { createHousehold, getHousehold, inboxAddress, joinHousehold, leaveHousehold, type Household } from '../sync/household';
import { useSyncStatus } from '../sync/useHouseholdSync';

const STATUS_LABEL = { idle: 'Not syncing', syncing: 'Syncing…', live: 'Up to date', offline: 'Offline, will retry' } as const;

export default function HouseholdScreen() {
  const householdId = useStore((s) => s.householdId);
  const setHousehold = useStore((s) => s.setHousehold);
  const status = useSyncStatus((s) => s.status);
  const [info, setInfo] = useState<{ household: Household; members: number } | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!householdId || !supabase) return;
    getHousehold(householdId).then(setInfo).catch(() => setInfo(null));
  }, [householdId, status]);

  async function run(fn: () => Promise<Household>) {
    setBusy(true);
    try {
      const h = await fn();
      setHousehold(h.id);
    } catch (e) {
      Alert.alert('That did not work', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return (
      <View style={{ padding: space(4) }}>
        <Card>
          <Text style={styles.lead}>Sharing isn't set up yet</Text>
          <Text style={styles.body}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env to share one kitchen with everyone at home.
          </Text>
        </Card>
      </View>
    );
  }

  if (!householdId) {
    return (
      <ScrollView contentContainerStyle={{ padding: space(4) }} keyboardShouldPersistTaps="handled">
        <Text style={styles.body}>
          Share one kitchen and one shopping list with everyone you live with. Changes show up on every phone right away.
        </Text>
        <SectionTitle>Start a household</SectionTitle>
        <Input value={name} onChangeText={setName} placeholder="Name, e.g. The Smiths" />
        <Button title="Create household" onPress={() => run(() => createHousehold(name))} disabled={busy} style={{ marginTop: space(2) }} />
        <SectionTitle>Or join one</SectionTitle>
        <Input value={code} onChangeText={setCode} placeholder="Invite code" autoCapitalize="none" autoCorrect={false} />
        <Button
          kind="secondary"
          title="Join"
          onPress={() => run(() => joinHousehold(code))}
          disabled={busy || code.trim().length < 6}
          style={{ marginTop: space(2) }}
        />
        {busy && <ActivityIndicator color={colors.primary} style={{ marginTop: space(4) }} />}
        <Text style={[styles.note, { marginTop: space(6) }]}>What's already on this phone is added to the household when you join.</Text>
      </ScrollView>
    );
  }

  const email = info ? inboxAddress(info.household.inbox_code) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: space(4) }}>
      <Card>
        <Text style={styles.lead}>{info?.household.name ?? 'Your household'}</Text>
        <Text style={styles.body}>
          {info ? `${info.members} ${info.members === 1 ? 'person' : 'people'}` : 'Loading…'} · {STATUS_LABEL[status]}
        </Text>
      </Card>

      {info && (
        <>
          <SectionTitle>Invite someone</SectionTitle>
          <Text style={styles.code}>{info.household.invite_code}</Text>
          <Button
            kind="secondary"
            title="Share invite code"
            onPress={() =>
              Share.share({ message: `Join our kitchen in Pantry with invite code ${info.household.invite_code}` })
            }
          />

          <SectionTitle>Forward e-receipts</SectionTitle>
          {email ? (
            <>
              <Text style={styles.code} selectable>
                {email}
              </Text>
              <Text style={styles.note}>
                Forward order confirmations and emailed receipts here. They show up in the Scan tab for a quick check before they're added.
              </Text>
            </>
          ) : (
            <Text style={styles.note}>Email forwarding needs EXPO_PUBLIC_RECEIPT_EMAIL_DOMAIN set (see README).</Text>
          )}
        </>
      )}

      <Button
        kind="danger"
        title="Leave household"
        style={{ marginTop: space(10) }}
        onPress={() =>
          Alert.alert('Leave this household?', 'Your phone keeps a copy of the kitchen but stops syncing.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                try {
                  await leaveHousehold(householdId);
                } catch {
                  // Leaving locally still stops sync; the membership can be cleaned up later.
                }
                setHousehold(null);
                setInfo(null);
              },
            },
          ])
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: space(1) },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: space(2) },
  code: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: 1, marginBottom: space(2) },
});
