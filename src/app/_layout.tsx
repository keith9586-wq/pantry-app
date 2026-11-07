import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../components/theme';
import { UndoBar } from '../components/UndoBar';
import { useHouseholdSync } from '../sync/useHouseholdSync';

export default function RootLayout() {
  useHouseholdSync();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add item' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="barcode" options={{ presentation: 'modal', title: 'Scan a barcode' }} />
        <Stack.Screen name="household" options={{ title: 'Household' }} />
      </Stack>
      <UndoBar />
    </>
  );
}
