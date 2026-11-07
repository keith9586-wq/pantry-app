import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { colors, space } from './theme';

/** Shown in place of a paid feature. */
export function Locked({ title, body, plan = 'Plus' }: { title: string; body: string; plan?: 'Plus' | 'Family' }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>{plan}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button title="See plans" onPress={() => router.push('/paywall')} style={{ marginTop: space(5), alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: space(8) },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: space(3),
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: space(2) },
});
