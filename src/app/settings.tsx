import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Input, SectionTitle } from '../components/ui';
import { colors, space } from '../components/theme';
import { initBilling, usePlan } from '../billing/billing';
import { PLAN_COPY } from '../lib/plans';
import { isEmptyProfile } from '../lib/diet';
import { enableReminders } from '../notify/reminders';
import { useStore } from '../store/useStore';
import { confirmSaveEmail, confirmSignIn, getAccount, startSaveEmail, startSignIn } from '../sync/account';
import { supabase } from '../sync/client';

type Flow = { mode: 'save' | 'signin'; email: string; codeSent: boolean } | null;

function Row({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value} ›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const plan = usePlan();
  const householdId = useStore((s) => s.householdId);
  const setHousehold = useStore((s) => s.setHousehold);
  const remindersOn = useStore((s) => s.remindersOn);
  const dietProfile = useStore((s) => s.dietProfile);
  const setRemindersOn = useStore((s) => s.setRemindersOn);
  const [account, setAccount] = useState<{ email: string | null; anonymous: boolean } | null>(null);
  const [flow, setFlow] = useState<Flow>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabase) getAccount().then(setAccount).catch(() => {});
  }, []);

  async function step(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('That did not work', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    step(async () => {
      if (!flow) return;
      await (flow.mode === 'save' ? startSaveEmail(flow.email) : startSignIn(flow.email));
      setFlow({ ...flow, codeSent: true });
    });

  const verify = () =>
    step(async () => {
      if (!flow) return;
      if (flow.mode === 'save') {
        await confirmSaveEmail(flow.email, code);
        Alert.alert('Account saved', `Sign in with ${flow.email} on any phone to get your kitchen back.`);
      } else {
        const { userId, householdId: hid } = await confirmSignIn(flow.email, code);
        await initBilling(userId);
        if (hid) setHousehold(hid);
        Alert.alert('Signed in', hid ? 'Your household is syncing to this phone.' : 'You are signed in.');
      }
      setFlow(null);
      setCode('');
      setAccount(await getAccount());
    });

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      <SectionTitle>Plan</SectionTitle>
      <Row label={plan === 'free' ? 'Free' : PLAN_COPY[plan].title} value={plan === 'family' ? 'Manage' : 'Upgrade'} onPress={() => router.push('/paywall')} />

      <SectionTitle>Household</SectionTitle>
      <Row label={householdId ? 'Shared kitchen' : 'Just me'} value={householdId ? 'Manage' : 'Set up'} onPress={() => router.push('/household')} />

      <SectionTitle>Diet and allergies</SectionTitle>
      <Row
        label={isEmptyProfile(dietProfile) ? 'No restrictions' : `${dietProfile.diets.length + dietProfile.allergies.length + dietProfile.dislikes.length} set`}
        value={isEmptyProfile(dietProfile) ? 'Set up' : 'Edit'}
        onPress={() => router.push('/diet')}
      />

      {supabase && (
        <>
          <SectionTitle>Neighbors</SectionTitle>
          <Row label="Food swap nearby" value="Open" onPress={() => router.push('/swap')} />
        </>
      )}

      <SectionTitle>Reminders</SectionTitle>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { flex: 1 }]}>Morning heads-up before food expires</Text>
        <Switch
          value={remindersOn}
          onValueChange={async (on) => {
            if (!on) return setRemindersOn(false);
            const ok = await enableReminders();
            if (!ok) Alert.alert('Notifications are off', 'Turn on notifications for Pantry in your phone settings.');
          }}
          trackColor={{ true: colors.primary }}
        />
      </View>

      {supabase && (
        <>
          <SectionTitle>Account</SectionTitle>
          {account && !account.anonymous && !flow && (
            <Card>
              <Text style={styles.body}>Signed in as {account.email}</Text>
            </Card>
          )}
          {account?.anonymous && !flow && (
            <Card>
              <Text style={styles.body}>
                Your kitchen is tied to this phone. Add your email so you can get it back on a new phone.
              </Text>
              <Button title="Save with email" onPress={() => setFlow({ mode: 'save', email: '', codeSent: false })} style={{ marginTop: space(3) }} />
              <Button
                kind="secondary"
                title="I already have an account"
                onPress={() => setFlow({ mode: 'signin', email: '', codeSent: false })}
                style={{ marginTop: space(2) }}
              />
            </Card>
          )}
          {flow && (
            <Card>
              <Text style={styles.body}>
                {flow.codeSent ? `Enter the 6-digit code sent to ${flow.email}.` : 'We will email you a 6-digit code.'}
              </Text>
              {!flow.codeSent ? (
                <>
                  <Input
                    value={flow.email}
                    onChangeText={(email) => setFlow({ ...flow, email })}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ marginTop: space(3) }}
                  />
                  <Button title="Send code" onPress={sendCode} disabled={busy || !flow.email.includes('@')} style={{ marginTop: space(3) }} />
                </>
              ) : (
                <>
                  <Input value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" style={{ marginTop: space(3) }} />
                  <Button title="Confirm" onPress={verify} disabled={busy || code.trim().length < 6} style={{ marginTop: space(3) }} />
                </>
              )}
              <Button kind="secondary" title="Cancel" onPress={() => setFlow(null)} style={{ marginTop: space(2) }} />
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(4),
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { fontSize: 16, color: colors.text },
  rowValue: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
});
