import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { planReminders } from '../lib/reminders';
import { useStore } from '../store/useStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'expiry';

/** Asks for permission; returns whether reminders can be shown. */
export async function enableReminders(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Use-by reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  useStore.getState().setRemindersOn(granted);
  return granted;
}

async function reschedule() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { items, remindersOn } = useStore.getState();
  if (!remindersOn) return;
  for (const r of planReminders(items, new Date())) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { screen: '/recipes' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

/** Mount once at the root: keeps scheduled reminders matching the kitchen. */
export function useExpiryReminders() {
  const remindersOn = useStore((s) => s.remindersOn);

  useEffect(() => {
    if (!remindersOn) {
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reschedule().catch(() => {}), 1500);
    };
    run();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.items !== prev.items) run();
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [remindersOn]);

  useEffect(() => {
    // Each notification names the screen it's about; expiry reminders open recipes.
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const screen = r.notification.request.content.data?.screen;
      router.navigate((typeof screen === 'string' ? screen : '/recipes') as '/recipes');
    });
    return () => sub.remove();
  }, []);
}
