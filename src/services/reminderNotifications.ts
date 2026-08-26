import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { Reminder } from './remindersApi';

const CHANNEL_ID = 'donna-reminders';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Reminders',
    importance: AndroidImportance.HIGH,
  });
}

export async function ensureReminderPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

export async function scheduleReminderNotification(
  reminder: Reminder,
): Promise<void> {
  const dueMs = Date.parse(reminder.due_at);
  if (!Number.isFinite(dueMs)) {
    return;
  }
  const permitted = await ensureReminderPermission();
  if (!permitted) {
    return;
  }
  await ensureAndroidChannel();

  if (dueMs <= Date.now() + 1500) {
    await notifee.displayNotification({
      id: reminder.id,
      title: 'Donna reminder',
      body: reminder.title,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
    return;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: dueMs,
    alarmManager: {
      allowWhileIdle: true,
    },
  };
  await notifee.createTriggerNotification(
    {
      id: reminder.id,
      title: 'Donna reminder',
      body: reminder.title,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    },
    trigger,
  );
}

export async function cancelReminderNotification(id: string): Promise<void> {
  try {
    await notifee.cancelNotification(id);
    await notifee.cancelTriggerNotification(id);
  } catch {
    // already gone
  }
}

export async function syncReminderNotifications(
  reminders: Reminder[],
): Promise<void> {
  const permitted = await ensureReminderPermission();
  if (!permitted) {
    return;
  }
  const scheduled = reminders.filter(r => r.status === 'scheduled');
  const ids = new Set(scheduled.map(r => r.id));
  try {
    const existing = await notifee.getTriggerNotificationIds();
    for (const id of existing) {
      if (!ids.has(id)) {
        await cancelReminderNotification(id);
      }
    }
  } catch {
    // ignore
  }
  for (const rem of scheduled) {
    await scheduleReminderNotification(rem);
  }
}
