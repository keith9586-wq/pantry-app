import { Text } from 'react-native';
import { changeLabel } from '../lib/prices';
import { colors } from './theme';

/** "12% more than usual" under a price, red when up and green when down. */
export function PriceTag({ change }: { change: number | null }) {
  const label = changeLabel(change);
  if (!label || change === null) return null;
  const color = label === 'usual price' ? colors.muted : change > 0 ? colors.danger : colors.primary;
  return <Text style={{ fontSize: 12, color, marginTop: 2 }}>{label}</Text>;
}
