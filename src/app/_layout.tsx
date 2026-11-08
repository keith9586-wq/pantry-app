import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../components/theme';
import { UndoBar } from '../components/UndoBar';
import { useHouseholdSync } from '../sync/useHouseholdSync';
import { useExpiryReminders } from '../notify/reminders';

export default function RootLayout() {
  useHouseholdSync();
  useExpiryReminders();
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
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add item' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="recipe-edit" options={{ presentation: 'modal', title: 'New recipe' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="check" options={{ presentation: 'modal', title: 'Quick check' }} />
        <Stack.Screen name="shelf-scan" options={{ presentation: 'modal', title: 'Sweep your shelves' }} />
        <Stack.Screen name="barcode" options={{ presentation: 'modal', title: 'Scan a barcode' }} />
        <Stack.Screen name="household" options={{ title: 'Household' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="diet" options={{ title: 'Diet and allergies' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Plans' }} />
      </Stack>
      <UndoBar />
    </>
  );
}
