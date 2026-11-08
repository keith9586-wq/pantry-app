import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { planReminders } from '../lib/reminders';
import { dueWithin, forecastRunOuts, nudgeTime, usualShopDay } from '../lib/runout';
import { bestPlan, can } from '../lib/plans';
import { usePlanState } from '../billing/billing';

const currentPlan = () => {
  const s = usePlanState.getState();
  return bestPlan(s.ownPlan, s.householdPlan);
};
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
  const { items, remindersOn, away, purchaseCounts, priceHistory, shopping } = useStore.getState();
  if (!remindersOn) return;
  // Nobody can cook while away; the trip plan handles that food before leaving.
  const awayFrom = away ? new Date(away.from).getTime() : Infinity;
  const awayUntil = away ? new Date(away.until).getTime() : -Infinity;
  // The evening before the usual shop day: staples that will run out by then.
  const shopDay = can(currentPlan(), 'autoList') ? usualShopDay(purchaseCounts, priceHistory) : null;
  if (shopDay !== null) {
    const at = nudgeTime(shopDay);
    const daysAhead = Math.ceil((at.getTime() - Date.now()) / 86_400_000) + 1;
    const onList = new Set(shopping.filter((s) => !s.checked).map((s) => s.key));
    const due = dueWithin(forecastRunOuts(purchaseCounts, priceHistory, items), daysAhead);
    if (due.length > 0 && !(at.getTime() >= awayFrom && at.getTime() < awayUntil)) {
      const names = due.slice(0, 3).map((d) => d.name).join(', ') + (due.length > 3 ? ` and ${due.length - 3} more` : '');
      const missing = due.filter((d) => !onList.has(d.key)).length;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Shopping tomorrow?',
          body: `You usually run out of ${names} about now.${missing ? ' Tap to add them to your list.' : ''}`,
          data: { screen: '/shopping' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  }
  for (const r of planReminders(items, new Date())) {
    if (r.at.getTime() >= awayFrom && r.at.getTime() < awayUntil) continue;
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
      if (s.items !== prev.items || s.away !== prev.away || s.purchaseCounts !== prev.purchaseCounts) run();
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
