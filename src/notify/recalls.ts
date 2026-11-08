import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { fetchRecalls, matchKey, matchRecalls } from '../lib/recalls';
import { useStore } from '../store/useStore';

const REFRESH_MS = 12 * 60 * 60 * 1000;

async function refresh() {
  const { recallsFetchedAt, setRecalls } = useStore.getState();
  if (recallsFetchedAt && Date.now() - new Date(recallsFetchedAt).getTime() < REFRESH_MS) return;
  const recalls = await fetchRecalls();
  if (recalls.length === 0) return; // offline or both feeds down: keep what we had
  setRecalls(recalls);
  const s = useStore.getState();
  const notified = new Set(s.recallsNotified);
  const fresh = matchRecalls(s.recalls, s.items, s.recallsDismissed).filter((m) => !notified.has(matchKey(m)));
  if (fresh.length === 0) return;
  s.markRecallsNotified(fresh.map(matchKey));
  if (!s.remindersOn) return;
  const top = fresh[0];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: top.strength === 'brand' ? `Recall: your ${top.item.name}` : `Possible recall: ${top.item.name}`,
      body:
        top.strength === 'brand'
          ? `${top.recall.firm} recalled this product. Tap to see why and what to do.`
          : `A ${top.item.name.toLowerCase()} product was recalled. Tap to check if it's the one on your shelf.`,
      data: { screen: '/recalls' },
    },
    trigger: null,
  });
}

/** Mount once at the root: checks recall feeds on launch and when the app comes back, at most twice a day. */
export function useRecallWatch() {
  useEffect(() => {
    refresh().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, []);
}
