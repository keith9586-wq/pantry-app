import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, space } from './theme';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.dangerSoft : colors.card;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: space(3), paddingHorizontal: space(4), borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: {
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: space(2),
  },
  chipText: { fontSize: 14, color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    fontSize: 16,
    color: colors.text,
  },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: space(4), borderWidth: 1, borderColor: colors.border },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space(5), marginBottom: space(2) },
  empty: { alignItems: 'center', padding: space(10) },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: space(2) },
  emptyBody: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
});
