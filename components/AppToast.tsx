import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastVariant = "default" | "destructive";

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastState = ToastOptions & { id: number };

type ToastContextValue = {
  showToast: (toast: ToastOptions) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [clearTimer, opacity, translateY]);

  const showToast = useCallback((nextToast: ToastOptions) => {
    clearTimer();
    const id = idRef.current + 1;
    idRef.current = id;
    opacity.setValue(0);
    translateY.setValue(-20);
    setToast({ ...nextToast, id });

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      dismissToast();
    }, nextToast.duration ?? DEFAULT_DURATION_MS);
  }, [clearTimer, dismissToast, opacity, translateY]);

  const isDestructive = toast?.variant === "destructive";

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {toast && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastWrap,
              {
                top: Math.max(insets.top + 8, 16),
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View
              pointerEvents="auto"
              style={[
                styles.toast,
                isDestructive ? styles.toastDestructive : styles.toastDefault,
              ]}
            >
              <View style={styles.copy}>
                <Text style={styles.title}>{toast.title}</Text>
                {!!toast.description && <Text style={styles.description}>{toast.description}</Text>}
                {!!toast.actionLabel && (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => {
                      toast.onAction?.();
                      dismissToast();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionText}>{toast.actionLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={dismissToast} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.close}>×</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
  },
  toast: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  toastDefault: {
    backgroundColor: "#0b0f16",
    borderColor: "#242a36",
  },
  toastDestructive: {
    backgroundColor: "#7f1d1d",
    borderColor: "#fecaca",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: "#eceef2",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    color: "rgba(236,238,242,0.9)",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  action: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(236,238,242,0.45)",
    paddingHorizontal: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  actionText: {
    color: "#eceef2",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  close: {
    color: "rgba(236,238,242,0.75)",
    fontSize: 24,
    lineHeight: 24,
  },
});
