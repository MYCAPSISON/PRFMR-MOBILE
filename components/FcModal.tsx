/**
 * FcModal — web/fallback version (no native capture)
 * Native builds use FcModal.native.tsx which has ViewShot + expo-sharing.
 */
import React, { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";

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

  useEffect(() => {
    if (!data) return;
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data, onDismiss]);

  if (!data) return null;

  const accent = data.isUp ? "#f59e0b" : "#ff7a00";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}
      testID="fight-camp-notice-overlay">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.card, { borderColor: accent }]} testID="fight-camp-notice-card">
            {data.emoji ? <Text style={styles.emoji}>{data.emoji}</Text> : null}
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.body}>{data.body}</Text>
            {data.shareable && (
              <View style={[styles.shareBtn, { borderColor: accent }]}>
                <Feather name="share-2" size={15} color={accent} />
                <Text style={[styles.shareBtnText, { color: accent }]}>Share moment</Text>
              </View>
            )}
            <Text style={styles.hint}>Tap outside to dismiss</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
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
});
