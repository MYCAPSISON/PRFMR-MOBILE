/**
 * FcModal — native version with ViewShot + expo-sharing + background image picker.
 * Metro picks this file over FcModal.tsx on iOS and Android.
 *
 * IMPORTANT: always render <Modal visible={!!data}> instead of returning null —
 * unmounting a visible Modal on iOS leaves an invisible touch-blocking layer.
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import { ShareCard } from "./ShareCard";

// Preload the logo asset as soon as this module is imported so it's in the
// native image cache before any ViewShot capture runs.
Asset.loadAsync(require("../assets/logo-main.png")).catch(() => {});

export interface FcModalData {
  title: string;
  body: string;
  emoji?: string;
  isUp?: boolean;
  shareable?: boolean;
  weightLostKg?: number;
  currentWeight?: number;
  targetWeight?: number;
  username?: string;
  daysLeft?: number;
  shareTitle?: string;
  weightHistory?: Array<{ date: string; weight: number }>;
  /** Fight camp weekly targets — used to build the projected chart in Type 1. */
  weeklyTargets?: Array<{ week: number; targetWeight: number }>;
  /** ISO fight date string — used for the projected chart in Type 1. */
  fightDate?: string;
  /**
   * The ISO start date of the weightHistory window (e.g. "2026-07-24").
   * Used as a fallback for camp-age detection when planCreatedAt is absent.
   */
  weightHistoryWindowStart?: string;
  /** ISO datetime when this fight camp plan was created — the authoritative camp-age signal. */
  planCreatedAt?: string;
}

interface Props {
  data: FcModalData | null;
  onDismiss: () => void;
}

/**
 * Determine which share card template to use.
 * Type 1 = camp < 7 days old → show projected weight cut chart.
 * Type 2 = camp ≥ 7 days old → show real trend.
 *
 * Priority order:
 * 1. planCreatedAt — exact camp creation date from the API (most reliable).
 * 2. weightHistoryWindowStart — heuristic: if any log falls on the window
 *    boundary the camp was active ≥ 7 days ago.
 * 3. weightHistory.length fallback.
 */
function resolveCardType(data: FcModalData): 1 | 2 {
  // 1. Use planCreatedAt if available
  if (data.planCreatedAt) {
    const createdMs = Date.parse(data.planCreatedAt);
    if (!isNaN(createdMs)) {
      const campAgeMs = Date.now() - createdMs;
      return campAgeMs >= 7 * 24 * 60 * 60 * 1000 ? 2 : 1;
    }
  }

  // 2. Heuristic: weight log on or before the window start → camp ≥ 7 days old
  const windowStart = data.weightHistoryWindowStart;
  const history = data.weightHistory ?? [];
  if (windowStart && history.length > 0) {
    const hasEntryAtOrBeforeWindowStart = history.some(
      w => w.date.slice(0, 10) <= windowStart
    );
    return hasEntryAtOrBeforeWindowStart ? 2 : 1;
  }

  // 3. Last resort: full 7-day window filled
  return history.length >= 7 ? 2 : 1;
}

export function FcModal({ data, onDismiss }: Props) {
  const shareCardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = React.useState(false);
  const [bgImageUri, setBgImageUri] = React.useState<string | null>(null);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!data) {
      setBgImageUri(null);
      return;
    }
    setSharing(false);
  }, [data]);

  async function handleShare() {
    if (!shareCardRef.current || !data) return;
    try {
      setSharing(true);
      // Pause so Image assets (and background photo) finish rendering before
      // ViewShot captures. Use a longer delay when a bg photo is set since
      // the ImageBackground source needs more time to paint from a file:// URI.
      await new Promise(resolve => setTimeout(resolve, bgImageUri ? 900 : 350));
      const uri = await (shareCardRef.current as any).capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/jpeg",
          dialogTitle: data.shareTitle ?? "Share your progress",
        });
      }
    } catch (e) {
      console.warn("[FcModal] share error", e);
    } finally {
      setSharing(false);
    }
  }

  async function handlePickBackground() {
    Alert.alert(
      "Background photo",
      "Choose a source for your share card background",
      [
        {
          text: "Camera",
          onPress: async () => {
            const cam = await ImagePicker.requestCameraPermissionsAsync();
            if (!cam.granted) {
              Alert.alert("Camera access needed", "Please enable camera access in Settings to take a background photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [9, 16],
              quality: 0.3,
              exif: false,
            });
            if (!result.canceled && result.assets[0]) {
              setBgImageUri(result.assets[0].uri);
            }
          },
        },
        {
          text: "Photo library",
          onPress: async () => {
            const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!lib.granted) {
              Alert.alert("Photo library access needed", "Please enable photo library access in Settings to choose a background.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [9, 16],
              quality: 0.3,
              exif: false,
            });
            if (!result.canceled && result.assets[0]) {
              setBgImageUri(result.assets[0].uri);
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
    );
  }

  const accent = data?.isUp ? "#f59e0b" : "#ff7a00";
  const hasShare = !!(
    data?.shareable &&
    data?.weightLostKg !== undefined &&
    data.weightLostKg >= 0
  );

  const cardType = data ? resolveCardType(data) : 2;

  // Always render <Modal> — never return null / unmount it.
  return (
    <Modal
      visible={!!data}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      testID="fight-camp-notice-overlay"
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={dismiss}>
        {data && (
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              style={[styles.card, { borderColor: accent }]}
              testID="fight-camp-notice-card"
            >
              {data.emoji ? (
                <Text style={styles.emoji}>{data.emoji}</Text>
              ) : null}
              <Text style={styles.title}>{data.title}</Text>
              <Text style={styles.body}>{data.body}</Text>

              {hasShare && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: accent, flex: 1 }]}
                    onPress={handleShare}
                    disabled={sharing}
                    testID="button-share-moment"
                  >
                    {sharing ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Feather name="share-2" size={14} color={accent} />
                    )}
                    <Text style={[styles.actionBtnText, { color: accent }]}>
                      {sharing ? "Preparing…" : "Share"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.bgBtn]}
                    onPress={handlePickBackground}
                    disabled={sharing}
                    testID="button-change-background"
                  >
                    <Feather
                      name={bgImageUri ? "image" : "camera"}
                      size={14}
                      color="#6b7280"
                    />
                    <Text style={styles.bgBtnText}>
                      {bgImageUri ? "Change bg" : "Add photo bg"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.hint}>Tap outside to dismiss</Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Hidden ShareCard — captured by ViewShot as JPG (360×640) */}
      {hasShare && data && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: "jpg", quality: 0.92, width: 360, height: 640 }}
          style={styles.hiddenCard}
        >
          <ShareCard
            weightLostKg={data.weightLostKg ?? 0}
            username={data.username}
            currentWeight={data.currentWeight}
            targetWeight={data.targetWeight}
            daysLeft={data.daysLeft}
            weightHistory={data.weightHistory ?? []}
            backgroundImageUri={bgImageUri ?? undefined}
            cardType={cardType}
            weeklyTargets={data.weeklyTargets ?? []}
            fightDate={data.fightDate}
          />
        </ViewShot>
      )}
    </Modal>
  );
}

const W = Dimensions.get("window").width;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: W - 56,
    backgroundColor: "#0f1117",
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 28,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  emoji: { fontSize: 42, marginBottom: 4 },
  title: {
    color: "#eceef2",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    width: "100%",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  bgBtn: {
    borderColor: "#2a2d38",
    backgroundColor: "#13161d",
  },
  bgBtnText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  hint: { color: "#4b5563", fontSize: 11, marginTop: 6 },
  hiddenCard: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: 360,
    height: 640,
    overflow: "hidden",
  },
});
