import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlan } from '../billing/billing';
import { Button } from '../components/ui';
import { colors, space } from '../components/theme';
import { CATEGORY_LABEL } from '../lib/normalize';
import { SWEEPS_PER_MONTH, sweepsLeft } from '../lib/plans';
import { FRAME_INTERVAL_MS, FRAME_WIDTH, MAX_FRAMES, pickFrames, scanShelves, type ShelfLine } from '../lib/shelfScan';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../sync/client';
import { useStore } from '../store/useStore';

const API_URL =
  process.env.EXPO_PUBLIC_SHELF_API_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/scan-shelves` : undefined);
const API_KEY = process.env.EXPO_PUBLIC_RECEIPT_API_KEY || SUPABASE_ANON_KEY;

/** Frames grabbed before the sweep stops by itself; the best spread of MAX_FRAMES is sent. */
const MAX_GRABS = 20;
const SPOT_LABEL = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' } as const;
const FILL_LABEL = { full: '', half: ' · about half left', low: ' · running low' } as const;

type Phase = 'ready' | 'sweeping' | 'reading' | 'review';
type Row = ShelfLine & { keep: boolean };

export default function ShelfScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const grabs = useRef<string[]>([]);
  const grabbing = useRef(false);
  const finishing = useRef(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const plan = usePlan();
  const sweepLog = useStore((s) => s.sweepLog);
  const recordSweep = useStore((s) => s.recordSweep);
  const addItems = useStore((s) => s.addItems);
  const left = sweepsLeft(plan, sweepLog);

  useEffect(() => {
    if (phase !== 'sweeping') return;
    const timer = setInterval(async () => {
      if (grabbing.current || !camera.current) return;
      grabbing.current = true;
      try {
        const pic = await camera.current.takePictureAsync({ quality: 0.5, shutterSound: false });
        if (pic?.uri) {
          grabs.current.push(pic.uri);
          setCount(grabs.current.length);
          if (grabs.current.length >= MAX_GRABS) finish();
        }
      } catch {
        // A dropped frame is fine; the next tick tries again.
      } finally {
        grabbing.current = false;
      }
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
    // finish is stable enough for this effect: it only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>The camera is used to see what is on your shelves. Photos are not kept.</Text>
        <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: space(4) }} />
      </View>
    );
  }

  function start() {
    if (!API_URL) {
      Alert.alert('Shelf scanning is not set up', 'Add EXPO_PUBLIC_SUPABASE_URL to your .env and deploy the scan-shelves function.');
      return;
    }
    if (left <= 0) {
      if (plan === 'free') {
        Alert.alert(
          'Shelf sweeps used up',
          `The free plan includes ${SWEEPS_PER_MONTH.free} sweeps a month. Plus includes ${SWEEPS_PER_MONTH.plus}.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'See plans', onPress: () => router.push('/paywall') },
          ],
        );
      } else {
        Alert.alert('Shelf sweeps used up', 'You have used this month\'s sweeps. Receipts and barcodes still work as usual.');
      }
      return;
    }
    grabs.current = [];
    finishing.current = false;
    setCount(0);
    setPhase('sweeping');
  }

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setPhase('reading');
    const chosen = pickFrames(grabs.current, MAX_FRAMES);
    if (chosen.length < 2) {
      setPhase('ready');
      Alert.alert('Too short', 'Pan slowly for a few seconds so the camera can see every shelf.');
      return;
    }
    try {
      const frames: string[] = [];
      for (const uri of chosen) {
        const img = await ImageManipulator.manipulate(uri).resize({ width: FRAME_WIDTH }).renderAsync();
        const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
        if (out.base64) frames.push(out.base64);
      }
      const lines = await scanShelves(frames, API_URL!, API_KEY);
      if (lines.length === 0) {
        setPhase('ready');
        Alert.alert('Nothing found', 'Try again with the light on, a little closer, panning slowly.');
        return;
      }
      recordSweep();
      setRows(lines.map((l) => ({ ...l, keep: true })));
      setPhase('review');
    } catch (e) {
      setPhase('ready');
      Alert.alert('Could not read the shelves', e instanceof Error ? e.message : String(e));
    }
  }

  function bump(idx: number, by: number) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, quantity: Math.max(1, Math.round(r.quantity + by)) } : r)));
  }

  function confirm() {
    const kept = rows.filter((r) => r.keep);
    addItems(
      kept.map((r) => ({ name: r.name, quantity: r.quantity, unit: r.unit, category: r.category, storage: r.storage, fill: r.fill })),
      new Date(),
      { stockTake: true },
    );
    Alert.alert('Added to your kitchen', `${kept.length} items added. Use-by dates are guesses from today, so tap any older item to fix it.`);
    router.replace('/');
  }

  if (phase === 'review') {
    const kept = rows.filter((r) => r.keep).length;
    return (
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }}>
        <Text style={styles.lead}>Check what we saw</Text>
        <Text style={styles.body}>Untick anything that's wrong and fix the counts. You can sweep another shelf after.</Text>
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
                {SPOT_LABEL[r.storage]} · {CATEGORY_LABEL[r.category]}
                {FILL_LABEL[r.fill]}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => bump(idx, -1)} hitSlop={8}>
                <Text style={styles.step}>−</Text>
              </Pressable>
              <Text style={styles.qty}>
                {r.quantity} {r.unit === 'each' ? '' : r.unit}
              </Text>
              <Pressable onPress={() => bump(idx, 1)} hitSlop={8}>
                <Text style={styles.step}>+</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
          <Button kind="secondary" title="Sweep again" onPress={() => { setRows([]); setPhase('ready'); }} style={{ flex: 1 }} />
          <Button title={`Add ${kept} items`} onPress={confirm} disabled={kept === 0} style={{ flex: 2 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" animateShutter={false} />
      <View style={styles.overlayTop}>
        <Text style={styles.overlayText}>
          {phase === 'sweeping'
            ? 'Pan slowly across each shelf, top to bottom. Open the door wide.'
            : phase === 'reading'
              ? 'Looking at your shelves…'
              : 'Open the fridge or cupboard, point at the top shelf, then press Start.'}
        </Text>
      </View>
      <View style={styles.overlayBottom}>
        {phase === 'reading' ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : phase === 'sweeping' ? (
          <>
            <View style={styles.dots}>
              {Array.from({ length: MAX_GRABS }, (_, i) => (
                <View key={i} style={[styles.dot, i < count && styles.dotOn]} />
              ))}
            </View>
            <Button title="Done" onPress={finish} />
          </>
        ) : (
          <>
            <Button title="Start sweep" onPress={start} />
            {Number.isFinite(left) && (
              <Text style={[styles.overlayText, { fontSize: 13, marginTop: space(2) }]}>
                {left} {left === 1 ? 'sweep' : 'sweeps'} left this month
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: space(6), justifyContent: 'center', backgroundColor: colors.bg },
  lead: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space(1) },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  overlayTop: { position: 'absolute', top: space(4), left: space(4), right: space(4), backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: space(3) },
  overlayBottom: { position: 'absolute', bottom: space(10), left: space(6), right: space(6), alignItems: 'stretch' },
  overlayText: { color: '#fff', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: space(3) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { backgroundColor: '#fff' },
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  step: { fontSize: 22, color: colors.primary, paddingHorizontal: space(1) },
  qty: { fontSize: 15, color: colors.text, minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
