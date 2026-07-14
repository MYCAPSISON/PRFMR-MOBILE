// PRFMR Web UI replication tokens.
// Derived from the guide's HSL values and kept dark-only.
const palette = {
  background:           "#0d1017",
  foreground:           "#eceef2",
  card:                 "#151921",
  cardForeground:       "#eceef2",
  secondary:            "#181e27",
  secondaryForeground:  "#e8eaf0",
  muted:                "#1c2230",
  mutedForeground:      "#737d8c",
  border:               "#181d28",
  input:                "#181e27",
  primary:              "#ff7a00",
  primaryForeground:    "#ffffff",
  accent:               "#ff7a00",
  accentForeground:     "#ffffff",
  destructive:          "#cc2929",
  destructiveForeground:"#f8f8f8",
  ring:                 "#ff7a00",
  sidebarBackground:    "#0b0e14",
  text:                 "#eceef2",
  tint:                 "#ff7a00",
  success:              "#4ade80",
  emerald:              "#10b981",
  warning:              "#facc15",
  amber:                "#f59e0b",
  orange:               "#fb923c",
  info:                 "#93c5fd",
  blue:                 "#3b82f6",
  yellow:               "#eab308",
  red:                  "#ef4444",
};

const colors = {
  dark:  palette,
  light: palette,
  radius: 12,

  // Font family strings for use in style objects
  fonts: {
    sans:    "Inter_400Regular",
    sansMd:  "Inter_500Medium",
    sansSb:  "Inter_600SemiBold",
    sansBd:  "Inter_700Bold",
    display: "SpaceGrotesk_700Bold",
    displaySb: "SpaceGrotesk_600SemiBold",
    mono:    "JetBrainsMono_400Regular",
    monoMd:  "JetBrainsMono_500Medium",
    monoBd:  "JetBrainsMono_700Bold",
  },
  
  semantic: {
    fightCampBg: "rgba(255, 122, 0, 0.08)",
    fightCampBorder: "rgba(255, 122, 0, 0.20)",
    warningBg: "rgba(245, 158, 11, 0.10)",
    warningBorder: "rgba(245, 158, 11, 0.20)",
    successBg: "rgba(74, 222, 128, 0.10)",
    successBorder: "rgba(74, 222, 128, 0.30)",
    successText: "#4ade80",
    destructiveBg: "rgba(239, 68, 68, 0.10)",
    destructiveBorder: "rgba(239, 68, 68, 0.30)",
    provisionalBg: "rgba(147, 197, 253, 0.10)",
    provisionalBorder: "rgba(147, 197, 253, 0.30)",
  },
};

export default colors;
