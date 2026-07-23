/**
 * FcModal — native version with ViewShot + expo-sharing.
 * Metro picks this file over FcModal.tsx on iOS and Android.
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { ShareCard } from "./ShareCard";

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
}

interface Props {
  data: FcModalData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4500;

export function FcModal({ data, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareCardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = React.useState(false);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!data) return;
    setSharing(false);
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data, dismiss]);

  async function handleShare() {
    if (!shareCardRef.current || !data) return;
    try {
      setSharing(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      const uri = await (shareCardRef.current as any).capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: data.shareTitle ?? "Share your progress",
        });
      }
    } catch (e) {
      console.warn("[FcModal] share error", e);
    } finally {
      setSharing(false);
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    }
  }

  if (!data) return null;

  const accent = data.isUp ? "#f59e0b" : "#ff7a00";
  const hasShare = data.shareable && data.weightLostKg !== undefined && data.weightLostKg >= 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}
      testID="fight-camp-notice-overlay">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={dismiss}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.card, { borderColor: accent }]} testID="fight-camp-notice-card">
            {data.emoji ? <Text style={styles.emoji}>{data.emoji}</Text> : null}
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.body}>{data.body}</Text>

            {hasShare && (
              <TouchableOpacity
                style={[styles.shareBtn, { borderColor: accent }]}
                onPress={handleShare}
                disabled={sharing}
                testID="button-share-moment"
              >
                {sharing
                  ? <ActivityIndicator size="small" color={accent} />
                  : <Feather name="share-2" size={15} color={accent} />}
                <Text style={[styles.shareBtnText, { color: accent }]}>
                  {sharing ? "Preparing…" : "Share moment"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.hint}>Tap outside to dismiss</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Hidden ShareCard — captured by ViewShot (off-screen, size 360×640) */}
      {hasShare && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: "png", quality: 1.0, width: 360, height: 640 }}
          style={styles.hiddenCard}
        >
          <ShareCard
            weightLostKg={data.weightLostKg ?? 0}
            username={data.username}
            currentWeight={data.currentWeight}
            targetWeight={data.targetWeight}
            daysLeft={data.daysLeft}
          />
        </ViewShot>
      )}
    </Modal>
  );
}

const W = Dimensions.get("window").width;

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 28,
  },
  card: {
    width: W - 56, backgroundColor: "#0f1117",
    borderRadius: 20, borderWidth: 1.5, padding: 28,
    alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  emoji: { fontSize: 42, marginBottom: 4 },
  title: { color: "#eceef2", fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  body: { color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 20 },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11,
    minWidth: 160, justifyContent: "center",
  },
  shareBtnText: { fontSize: 14, fontWeight: "700" },
  hint: { color: "#4b5563", fontSize: 11, marginTop: 6 },
  hiddenCard: {
    position: "absolute", left: -9999, top: 0,
    width: 360, height: 640, overflow: "hidden",
  },
});
