import { Tabs } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function ClassicTabLayout() {
  const colors = useColors();
  const safeAreaInsets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarItemStyle: {
          borderRadius: 0,
          marginHorizontal: 0,
          marginVertical: 0,
          paddingTop: 6,
        },
        tabBarActiveBackgroundColor: "transparent",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#090c12",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          elevation: 0,
          shadowOpacity: 0,
          paddingHorizontal: 0,
          paddingBottom: safeAreaInsets.bottom,
          paddingTop: 4,
          height: 62 + safeAreaInsets.bottom,
          ...(isWeb ? { height: 70 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: "700",
          fontFamily: colors.fonts.sansBd,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            <MaterialCommunityIcons name="pulse" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Training",
          tabBarIcon: ({ color }) =>
            <MaterialCommunityIcons name="dumbbell" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="supplements"
        options={{
          title: "Supps",
          tabBarIcon: ({ color }) =>
            <MaterialCommunityIcons name="pill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="playbook"
        options={{
          title: "Playbook",
          tabBarIcon: ({ color }) =>
            <Feather name="book-open" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            <Feather name="user" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: "Feedback",
          tabBarIcon: ({ color }) =>
            <Feather name="message-square" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="weightcut" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
