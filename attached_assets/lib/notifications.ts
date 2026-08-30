/**
 * lib/notifications.ts
 * Supplement reminder push-notification helpers (expo-notifications).
 * All calls are guarded with Platform.OS !== "web" — expo-notifications
 * has only partial web support and the app's reminder workflow is mobile-only.
 */
import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<NotificationsModule> | null = null;
let notificationHandlerConfigured = false;

function loadNotifications(): Promise<NotificationsModule> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }
  return notificationsModulePromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Native startup setup
// ─────────────────────────────────────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await loadNotifications();

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("supplement-reminders", {
    name: "Supplement Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#ff7a00",
    sound: "default",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function getNotificationPermissionStatus(): Promise<"granted" | "denied" | "undetermined" | "unavailable"> {
  if (Platform.OS === "web") return "unavailable";
  const Notifications = await loadNotifications();
  const perm = await Notifications.getPermissionsAsync() as {
    granted: boolean;
    canAskAgain: boolean;
  };
  if (perm.granted) return "granted";
  if (!perm.canAskAgain) return "denied";
  return "undetermined";
}

/**
 * Requests permission if not already granted.
 * Returns true if permission is (or becomes) granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await setupNotificationChannel();
  const Notifications = await loadNotifications();
  const existing = await Notifications.getPermissionsAsync() as { granted: boolean };
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync() as { granted: boolean };
  return result.granted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule / cancel individual supplement reminders
// ─────────────────────────────────────────────────────────────────────────────
const notifId = (supplementId: number) => `supp-reminder-${supplementId}`;

export async function scheduleSupplementReminder(supplement: {
  id: number;
  name: string;
  reminderTime: string; // "HH:MM"
  doseAmount?: number | null;
  doseUnit?: string | null;
}): Promise<void> {
  if (Platform.OS === "web") return;
  await setupNotificationChannel();
  const Notifications = await loadNotifications();

  const [hourStr, minuteStr] = supplement.reminderTime.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  // Always cancel the existing one first so we never double-schedule
  await cancelSupplementReminder(supplement.id);

  const doseLabel =
    supplement.doseAmount != null && supplement.doseUnit
      ? `  ·  ${supplement.doseAmount} ${supplement.doseUnit}`
      : "";

  await Notifications.scheduleNotificationAsync({
    identifier: notifId(supplement.id),
    content: {
      title: supplement.name + doseLabel,
      body: "Time to take your supplement",
      // iOS: subtitle appears below the title — keeps PRFMR branding visible
      // regardless of which app icon the OS shows (e.g. Expo Go in dev)
      subtitle: "PRFMR",
      sound: true,
      data: { supplementId: supplement.id, type: "supplement-reminder" },
      // Android channel
      ...(Platform.OS === "android"
        ? { channelId: "supplement-reminders" }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelSupplementReminder(supplementId: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.cancelScheduledNotificationAsync(notifId(supplementId));
  } catch {
    // Notification may not exist — that's fine
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk reschedule — call once after supplements are fetched
// ─────────────────────────────────────────────────────────────────────────────
export async function rescheduleAllSupplementReminders(
  supplements: Array<{
    id: number;
    name: string;
    reminderEnabled: boolean;
    reminderTime: string | null;
    doseAmount?: number | null;
    doseUnit?: string | null;
  }>
): Promise<void> {
  if (Platform.OS === "web") return;
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") return;

  for (const supp of supplements) {
    if (supp.reminderEnabled && supp.reminderTime) {
      await scheduleSupplementReminder({
        id: supp.id,
        name: supp.name,
        reminderTime: supp.reminderTime,
        doseAmount: supp.doseAmount,
        doseUnit: supp.doseUnit,
      });
    } else {
      await cancelSupplementReminder(supp.id);
    }
  }
}
