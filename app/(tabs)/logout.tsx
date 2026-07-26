import { useEffect } from "react";
import { useRouter } from "expo-router";

// This screen is never actually navigated to — the tab button
// shows a logout confirmation alert instead of navigating here.
// If somehow reached, redirect back to the dashboard.
export default function LogoutScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(tabs)/");
  }, []);
  return null;
}
