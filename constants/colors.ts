// Exact production token values derived from spec §23.1
// hsl(220,20%,7%) → #0d1017  hsl(220,16%,11%) → #151921  hsl(220,15%,13%) → #181e27
// hsl(215,10%,50%) → #737d8c  hsl(24,100%,50%) → #ff7a00  hsl(0,62%,50%) → #cc2929
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
  // Semantic semantic helpers (not design tokens, just conveniences)
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
  radius: 9,

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
  },
};

export default colors;
