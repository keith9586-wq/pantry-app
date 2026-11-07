import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, SectionTitle } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { CATEGORY_LABEL } from '../../lib/normalize';
import { parseReceiptImage, parseReceiptText } from '../../lib/receipt';
import type { ParsedLine } from '../../lib/types';
import { usePlan } from '../../billing/billing';
import { scansLeft } from '../../lib/plans';
import { useStore } from '../../store/useStore';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../sync/client';
import { listPending, markHandled, type PendingReceipt } from '../../sync/pending';

// Set these in .env (see README). Without them the app falls back to pasted text.
const API_URL =
  process.env.EXPO_PUBLIC_RECEIPT_API_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/parse-receipt` : undefined);
const API_KEY = process.env.EXPO_PUBLIC_RECEIPT_API_KEY || SUPABASE_ANON_KEY;

type Row = ParsedLine & { keep: boolean };

const SAMPLE = `GV WHL MLK 1G        3.48
BNNAS 2.1 LB         1.22
ORG SPNCH            3.99
LG EGGS 18CT         4.12
BNLS CHKN BRST 1.5 LB 7.48
TOMS                 2.50
SHRD CHDR CHS        2.97
TOTAL               25.76`;

export default function ScanScreen() {
  const addParsed = useStore((s) => s.addParsed);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [showPaste, setShowPaste] = useState(!API_URL);
  const householdId = useStore((s) => s.householdId);
  const plan = usePlan();
  const scanLog = useStore((s) => s.scanLog);
  const recordScan = useStore((s) => s.recordScan);
  const left = scansLeft(plan, scanLog);
  const [pending, setPending] = useState<PendingReceipt[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!householdId) return setPending([]);
      listPending(householdId).then(setPending).catch(() => {});
    }, [householdId]),
  );

  function openPending(p: PendingReceipt) {
    setPendingId(p.id);
    setRows(p.items.map((l) => ({ ...l, keep: true })));
  }

  async function dismissPending(id: string) {
    setPending((ps) => ps.filter((p) => p.id !== id));
    await markHandled(id).catch(() => {});
  }

  async function fromImage(source: 'camera' | 'library') {
    if (!API_URL) {
      Alert.alert('Photo scanning is not set up', 'Add EXPO_PUBLIC_RECEIPT_API_URL to your .env. You can paste receipt text for now.');
      setShowPaste(true);
      return;
    }
    if (left <= 0) {
      Alert.alert('Monthly scans used up', 'The free plan includes 5 receipt photo scans a month. Plus makes them unlimited.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'See plans', onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access so the app can read your receipt.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]?.base64) return;
    setBusy(true);
    try {
      const lines = await parseReceiptImage(result.assets[0].base64, API_URL, API_KEY);
      if (lines.length > 0) recordScan();
      if (lines.length === 0) Alert.alert('No items found', 'Try a flatter, well-lit photo of the full receipt.');
      setRows(lines.map((l) => ({ ...l, keep: true })));
    } catch (e) {
      Alert.alert('Could not read the receipt', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function fromText(t: string) {
    const lines = parseReceiptText(t);
    if (lines.length === 0) {
      Alert.alert('No items found', 'Each item line should end with its price, like "MILK 1G  3.48".');
      return;
    }
    setRows(lines.map((l) => ({ ...l, keep: true })));
  }

  function confirm() {
    const kept = rows.filter((r) => r.keep);
    addParsed(kept);
    if (pendingId) {
      dismissPending(pendingId);
      setPendingId(null);
    }
    setRows([]);
    setText('');
    Alert.alert('Added to your kitchen', `${kept.length} items now have predicted use-by dates.`);
    router.navigate('/');
  }

  const keptCount = rows.filter((r) => r.keep).length;

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
      {rows.length === 0 ? (
        <>
          {pending.length > 0 && (
            <>
              <SectionTitle>Emailed receipts to check</SectionTitle>
              {pending.map((p) => (
                <Pressable key={p.id} onPress={() => openPending(p)} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.subject || 'Forwarded receipt'}
                    </Text>
                    <Text style={styles.meta}>
                      {p.items.length} items · {new Date(p.receivedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => dismissPending(p.id)} hitSlop={10}>
                    <Text style={styles.meta}>Dismiss</Text>
                  </Pressable>
                </Pressable>
              ))}
              <View style={{ height: space(4) }} />
            </>
          )}
          <Card>
            <Text style={styles.lead}>Snap your receipt and the app fills your kitchen for you.</Text>
            <Text style={styles.body}>
              Store abbreviations like "GV WHL MLK" become "Whole Milk", and each item gets a predicted use-by date.
            </Text>
            <View style={{ gap: space(2), marginTop: space(4) }}>
              <Button title="Take a photo" onPress={() => fromImage('camera')} />
              <Button kind="secondary" title="Choose from photos" onPress={() => fromImage('library')} />
            </View>
            {Number.isFinite(left) && (
              <Text style={[styles.body, { marginTop: space(3), fontSize: 13 }]}>
                {left} free photo {left === 1 ? 'scan' : 'scans'} left this month
              </Text>
            )}
          </Card>
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.body}>Reading your receipt…</Text>
            </View>
          )}

          <Pressable onPress={() => setShowPaste((v) => !v)}>
            <SectionTitle>{showPaste ? 'Paste receipt text' : 'Or paste receipt text ›'}</SectionTitle>
          </Pressable>
          {showPaste && (
            <>
              <Input
                multiline
                value={text}
                onChangeText={setText}
                placeholder="Paste the text of an e-receipt"
                style={{ minHeight: 140, textAlignVertical: 'top', fontFamily: 'Courier' }}
              />
              <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
                <Button title="Read text" onPress={() => fromText(text)} disabled={!text.trim()} style={{ flex: 1 }} />
                <Button kind="secondary" title="Try a sample" onPress={() => fromText(SAMPLE)} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={styles.lead}>Check what we found</Text>
          <Text style={styles.body}>Untick anything that isn't food or that you don't want to track.</Text>
          {rows.map((r, idx) => (
            <Pressable
              key={idx}
              onPress={() => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, keep: !x.keep } : x)))}
              style={[styles.row, !r.keep && { opacity: 0.45 }]}
            >
              <Text style={styles.check}>{r.keep ? '☑' : '☐'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.meta}>
                  {r.quantity} {r.unit} · {CATEGORY_LABEL[r.category]}
                </Text>
              </View>
              {r.price !== undefined && <Text style={styles.price}>${r.price.toFixed(2)}</Text>}
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
            <Button
              kind="secondary"
              title={pendingId ? 'Back' : 'Start over'}
              onPress={() => {
                setRows([]);
                setPendingId(null);
              }}
              style={{ flex: 1 }}
            />
            <Button title={`Add ${keptCount} items`} onPress={confirm} disabled={keptCount === 0} style={{ flex: 2 }} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space(1) },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space(3),
    marginTop: space(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  check: { fontSize: 20, color: colors.primary, marginRight: space(3) },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  price: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
