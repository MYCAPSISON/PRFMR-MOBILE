import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function AppLogoHeader() {
  const colors = useColors();

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <Image
        source={require("@/assets/logo-main.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: "#d7dbe4",
  },
  logo: {
    height: 36,
    width: 132,
  },
});
