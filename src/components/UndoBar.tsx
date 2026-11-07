import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { colors, space } from './theme';

/** A short-lived bar after every change, so a wrong tap never costs accuracy. */
export function UndoBar() {
  const lastAction = useStore((s) => s.lastAction);
  const undo = useStore((s) => s.undo);
  const clear = useStore((s) => s.clearUndo);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(clear, 6000);
    return () => clearTimeout(t);
  }, [lastAction, clear]);

  if (!lastAction) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 64 }]}>
      <View style={styles.bar}>
        <Text style={styles.text} numberOfLines={1}>
          {lastAction.label}
        </Text>
        <Pressable onPress={undo} hitSlop={12} accessibilityRole="button">
          <Text style={styles.undo}>Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space(4), right: space(4) },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  text: { color: '#fff', fontSize: 15, flex: 1, marginRight: space(3) },
  undo: { color: '#9BE0B5', fontSize: 15, fontWeight: '700' },
});
