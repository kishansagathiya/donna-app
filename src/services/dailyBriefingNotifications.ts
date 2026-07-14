import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { DailyBriefing } from './notesApi';

export const DAILY_BRIEFING_NOTIFICATIONS_KEY =
  'donna.daily_briefing_notifications.v1';

const CHANNEL_ID = 'donna-daily';
const NOTIFICATION_ID = 'donna-daily-briefing';

export async function getDailyBriefingNotificationsEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(DAILY_BRIEFING_NOTIFICATIONS_KEY);
  return stored === '1';
}

export async function setDailyBriefingNotificationsEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    DAILY_BRIEFING_NOTIFICATIONS_KEY,
    enabled ? '1' : '0',
  );
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Daily briefing',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

function formatDailyBriefingNotificationBody(
  briefing: DailyBriefing,
): string | null {
  const taskLines = briefing.tasks
    .slice(0, 5)
    .map((task, i) => `${i + 1}. ${task.title}`);
  if (taskLines.length > 0) {
    const extra =
      briefing.tasks.length > 5
        ? `\n+${briefing.tasks.length - 5} more…`
        : '';
    return taskLines.join('\n') + extra;
  }
  const summary = briefing.summary?.trim();
  return summary ? summary : null;
}

/** @internal exported for unit tests */
export function formatDailyBriefingNotificationBodyForTest(
  briefing: DailyBriefing,
): string | null {
  return formatDailyBriefingNotificationBody(briefing);
}

export async function showDailyBriefingNotification(
  briefing: DailyBriefing,
): Promise<void> {
  const enabled = await getDailyBriefingNotificationsEnabled();
  if (!enabled) {
    return;
  }

  const body = formatDailyBriefingNotificationBody(briefing);
  if (!body) {
    return;
  }

  const permitted = await ensureNotificationPermission();
  if (!permitted) {
    return;
  }

  await ensureAndroidChannel();

  await notifee.displayNotification({
    id: `${NOTIFICATION_ID}-${briefing.date}`,
    title: "Donna — Today's focus",
    body,
    android: {
      channelId: CHANNEL_ID,
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
}

export async function enableDailyBriefingNotifications(): Promise<boolean> {
  const permitted = await ensureNotificationPermission();
  if (!permitted) {
    await setDailyBriefingNotificationsEnabled(false);
    return false;
  }
  await setDailyBriefingNotificationsEnabled(true);
  return true;
}

export async function disableDailyBriefingNotifications(): Promise<void> {
  await setDailyBriefingNotificationsEnabled(false);
}
