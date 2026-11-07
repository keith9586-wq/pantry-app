import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '../../components/theme';

// Simple text glyphs keep the app dependency-free; swap for an icon set later.
const glyph = (g: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{g}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Kitchen', tabBarIcon: glyph('▤') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan receipt', tabBarLabel: 'Scan', tabBarIcon: glyph('⌗') }} />
      <Tabs.Screen name="recipes" options={{ title: 'Cook from what you have', tabBarLabel: 'Recipes', tabBarIcon: glyph('◉') }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping list', tabBarLabel: 'List', tabBarIcon: glyph('☑') }} />
      <Tabs.Screen name="savings" options={{ title: 'Money saved and wasted', tabBarLabel: 'Savings', tabBarIcon: glyph('$') }} />
    </Tabs>
  );
}
