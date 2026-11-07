import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { colors, space } from '../components/theme';
import { lookupBarcode, type ProductFacts } from '../lib/barcode';
import { productWarnings } from '../lib/diet';
import { CATEGORY_LABEL } from '../lib/normalize';
import type { ParsedLine } from '../lib/types';
import { useStore } from '../store/useStore';

export default function BarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const addParsed = useStore((s) => s.addParsed);
  const [found, setFound] = useState<ParsedLine | null>(null);
  const [facts, setFacts] = useState<ProductFacts | null>(null);
  const profile = useStore((s) => s.dietProfile);
  const [name, setName] = useState('');
  const [looking, setLooking] = useState(false);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>The camera is used to read barcodes on packages.</Text>
        <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: space(4) }} />
      </View>
    );
  }

  async function onScan(code: string) {
    if (handled.current) return;
    handled.current = true;
    setLooking(true);
    try {
      const p = await lookupBarcode(code);
      if (p) {
        setFound(p.line);
        setFacts(p.facts);
        setName(p.line.name);
      } else {
        setUnknownCode(code);
      }
    } catch {
      setUnknownCode(code);
    } finally {
      setLooking(false);
    }
  }

  function reset() {
    handled.current = false;
    setFound(null);
    setFacts(null);
    setUnknownCode(null);
    setName('');
  }

  function save() {
    const base: ParsedLine = found ?? { name, quantity: 1, unit: 'each', category: 'other' };
    addParsed([{ ...base, name: name.trim(), category: found ? base.category : 'other' }]);
    router.back();
  }

  const showForm = found || unknownCode;
  const warnings = found && facts ? productWarnings(found.name, facts, profile) : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!showForm && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={looking ? undefined : (r) => onScan(r.data)}
        />
      )}
      {looking && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: '#fff', marginTop: space(2) }}>Looking up product…</Text>
        </View>
      )}
      {showForm && (
        <View style={{ padding: space(4) }}>
          <Card>
            <Text style={styles.lead}>{found ? 'Found it' : "We don't know this product yet"}</Text>
            {found ? (
              <Text style={styles.body}>{CATEGORY_LABEL[found.category]}. Fix the name if it's off.</Text>
            ) : (
              <Text style={styles.body}>Type what it is and it'll be added with a predicted date.</Text>
            )}
            {warnings.map((w) => (
              <View key={w.text} style={[styles.warn, w.level === 'danger' && styles.danger]}>
                <Text style={[styles.warnText, w.level === 'danger' && { color: colors.danger }]}>
                  {w.level === 'danger' ? '⚠ ' : ''}
                  {w.text}
                </Text>
              </View>
            ))}
            {warnings.length > 0 && <Text style={styles.small}>From the product's label on Open Food Facts. Check the package to be sure.</Text>}
            <Input value={name} onChangeText={setName} placeholder="Product name" style={{ marginTop: space(3) }} />
            <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(4) }}>
              <Button kind="secondary" title="Scan another" onPress={reset} style={{ flex: 1 }} />
              <Button title="Add" onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  warn: { backgroundColor: colors.warnSoft, borderRadius: 10, padding: space(2.5), marginTop: space(2) },
  danger: { backgroundColor: colors.dangerSoft },
  warnText: { fontSize: 15, fontWeight: '600', color: colors.warn, textAlign: 'center' },
  small: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: space(2) },
  lead: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: space(1), textAlign: 'center' },
});
