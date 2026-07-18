/**
 * PRFMR Mobile — Design System Constants
 * 
 * Derived from the Web UI Replication Guide (Entire_Web_App_UI_*.pdf).
 * All measurements in pixels. Maps Tailwind web design to React Native mobile.
 * 
 * Reference sections:
 * - §3 Typography patterns
 * - §4 Border radius tokens
 * - §16 Spacing conventions
 * - §2 Semantic colour usage
 */

// ─────────────────────────────────────────
// Font Sizes (§3)
// ─────────────────────────────────────────
export const fontSize = {
  // Micro labels (§3 "Micro label / unit")
  micro: 10,      // text-[10px] — disclaimers, micro labels
  tiny: 11,       // text-[11px] — between micro and xs, used sparingly
  
  // Standard sizes
  xs: 12,         // text-xs — secondary description, small text
  sm: 14,         // text-sm — body copy, default UI text
  md: 16,         // text-base — section content
  lg: 20,         // text-lg — card section heading
  xl: 24,         // text-2xl — greeting, large stat
  "2xl": 28,      // text-3xl — page heading
  "3xl": 30,      // Large hero number (countdown, weight)
  "4xl": 36,      // text-4xl — weight/large chart number
  
  // Special values referenced in guide
  cardTitle: 16,  // Card header
  pageTitle: 28,  // Page hero heading (Space Grotesk)
  heroNum: 36,    // Large number display
  heroNumMed: 30, // Medium hero number (Fight Camp countdown)
} as const;

// ─────────────────────────────────────────
// Font Weights (Inter, Space Grotesk, JetBrains Mono)
// ─────────────────────────────────────────
export const fontWeight = {
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

// ─────────────────────────────────────────
// Font Families
// ─────────────────────────────────────────
export const fontFamily = {
  // Body / UI text (Inter)
  sans: "Inter_400Regular",
  sansMd: "Inter_500Medium",
  sansSb: "Inter_600SemiBold",
  sansBd: "Inter_700Bold",
  
  // Headings & display (Inter)
  display: "Inter_700Bold",
  displaySb: "Inter_600SemiBold",
  
  // Monospace numbers (JetBrains Mono)
  mono: "JetBrainsMono_400Regular",
  monoMd: "JetBrainsMono_500Medium",
  monoBd: "JetBrainsMono_700Bold",
} as const;

// ─────────────────────────────────────────
// Border Radius (§4)
// ─────────────────────────────────────────
export const borderRadius = {
  sm: 3,    // rounded-sm
  md: 6,    // rounded-md  — buttons
  lg: 9,    // rounded-lg  — sections
  xl: 12,   // rounded-xl  — cards (DEFAULT)
  "2xl": 16, // rounded-2xl — modals
  full: 99, // rounded-full — pills
} as const;

// ─────────────────────────────────────────
// Spacing / Gaps (§16)
// ─────────────────────────────────────────
export const spacing = {
  // Micro gaps
  xs: 2,    // micro separator
  sm: 4,    // mb-1, minimal gap
  
  // Standard gaps
  md: 6,    // gap-1.5 — icon-text pairs
  lg: 8,    // gap-2 — standard inner gap
  xl: 12,   // gap-3 — cell/row gap
  "2xl": 16, // gap-4 — section gap
  "3xl": 20, // space-y-5 — larger section gap
  "4xl": 24, // gap-6 — modal padding
  
  // Special values
  pageSecGap: 32, // space-y-8 — page section separator
  
  // Padding sizes
  p: {
    sm: 8,    // Small padding (compact)
    md: 12,   // Standard cell/row padding
    lg: 16,   // Card padding (default)
    xl: 20,   // Card padding (generous)
    "2xl": 24, // Modal padding
    "3xl": 28, // Fight Camp card padding
  },
} as const;

// ─────────────────────────────────────────
// Semantic Colors with Opacity (§2, §11)
// ─────────────────────────────────────────

/** Fight Camp / Orange-tinted callout (§2, §18.1.3c) */
export const colorFightCamp = {
  bg: "rgba(255, 122, 0, 0.08)",      // bg-orange-500/8 — very subtle wash
  border: "rgba(255, 122, 0, 0.20)",  // border-orange-500/20
  text: "#fb923c",                     // text-orange-400
  badge: {
    bg: "rgba(255, 122, 0, 0.20)",
    border: "rgba(255, 122, 0, 0.30)",
    text: "#fb923c",
  },
} as const;

/** Warning / Amber-tinted callout (§2, §17.9) */
export const colorWarning = {
  bg: "rgba(250, 184, 84, 0.10)",    // bg-amber-500/10
  border: "rgba(250, 184, 84, 0.20)", // border-amber-500/20
  text: "#FACC15",                     // text-amber-500 (Tailwind amber-500)
  bgDark: "rgba(217, 119, 6, 0.10)",  // darker variant
  borderDark: "rgba(217, 119, 6, 0.20)",
} as const;

/** Success / Green state (§2, §17.11) */
export const colorSuccess = {
  bg: "rgba(76, 175, 80, 0.10)",     // bg-emerald-500/10
  border: "rgba(76, 175, 80, 0.30)", // border-emerald-500/30
  text: "#66BB6A",                    // text-emerald-400 (Tailwind emerald-400)
  fill: "#66BB6A",                    // bg-emerald-500 (button fill)
  fillHover: "#43A047",               // hover:bg-emerald-600
} as const;

/** Low energy / Red alert (§2, §17.5) */
export const colorDestructive = {
  bg: "rgba(255, 59, 48, 0.10)",     // bg-red-500/10
  border: "rgba(255, 59, 48, 0.30)", // border-red-500/30
  text: "#EF5350",                    // text-red-400 (Tailwind red-400)
} as const;

/** Blue — Provisional/Estimated data (§17.3, §17.4.1) */
export const colorProvisional = {
  bg: "rgba(33, 150, 243, 0.10)",    // bg-blue-300/10
  border: "rgba(33, 150, 243, 0.30)", // border-blue-300/30
  text: "#4FC3F7",                     // text-blue-300 (Tailwind blue-300)
} as const;

/** Yellow — Low carb warning (§17.5) */
export const colorLowCarb = {
  bg: "rgba(255, 193, 7, 0.10)",     // bg-yellow-500/10
  border: "rgba(255, 193, 7, 0.20)", // border-yellow-500/20
  text: "#FFC107",                    // text-yellow-400
} as const;

// ─────────────────────────────────────────
// Macro Border Accent Colors (§2, §17.8)
// By convention in the web app, stat cards have left-border-4 accent
// ─────────────────────────────────────────
export const macroAccentColors = {
  calories: "#ff7a00",     // border-l-primary (orange)
  protein: "#2196F3",      // border-l-blue-500
  carbs: "#FFC107",        // border-l-amber-500
  fat: "#FFEB3B",          // border-l-yellow-500
  fibre: "#4CAF50",        // border-l-emerald-500
} as const;

// ─────────────────────────────────────────
// Readiness Status Colors (§17.3, Table)
// ─────────────────────────────────────────
export const readinessColors = {
  High: { text: "#66BB6A", border: "rgba(76, 175, 80, 0.30)", bg: "rgba(76, 175, 80, 0.10)" },      // green-400
  Moderate: { text: "#FFC107", border: "rgba(255, 193, 7, 0.30)", bg: "rgba(255, 193, 7, 0.10)" },  // yellow-400
  Low: { text: "#FFA726", border: "rgba(255, 152, 0, 0.30)", bg: "rgba(255, 152, 0, 0.10)" },       // orange-400
  Poor: { text: "#EF5350", border: "rgba(244, 67, 54, 0.30)", bg: "rgba(244, 67, 54, 0.10)" },     // red-400
  Provisional: { text: "#4FC3F7", border: "rgba(33, 150, 243, 0.30)", bg: "rgba(33, 150, 243, 0.10)" }, // blue-300
} as const;

// ─────────────────────────────────────────
// Weight Cut Status Colors (§18.1.3a)
// ─────────────────────────────────────────
export const weightCutStatusColors = {
  on_track: { text: "#66BB6A", border: "rgba(76, 175, 80, 0.30)", bg: "rgba(76, 175, 80, 0.10)" },
  aggressive: { text: "#FFC107", border: "rgba(255, 193, 7, 0.30)", bg: "rgba(255, 193, 7, 0.10)" },
  very_aggressive: { text: "#FFA726", border: "rgba(255, 152, 0, 0.30)", bg: "rgba(255, 152, 0, 0.10)" },
  unrealistic: { text: "#EF5350", border: "rgba(244, 67, 54, 0.30)", bg: "rgba(244, 67, 54, 0.10)" },
  complete: { text: "#66BB6A", border: "rgba(76, 175, 80, 0.30)", bg: "rgba(76, 175, 80, 0.10)" },
  past_date: { text: "#999999", border: "rgba(255, 255, 255, 0.1)", bg: "rgba(58, 58, 58, 0.2)" },
} as const;

// ─────────────────────────────────────────
// Common Component Sizes
// ─────────────────────────────────────────
export const componentSize = {
  // Icon sizes
  iconSm: 14,      // h-3.5 w-3.5 / h-4 w-4 small icons
  iconMd: 20,      // h-5 w-5 standard icons
  iconLg: 24,      // h-6 w-6 larger icons
  iconXl: 32,      // h-8 w-8 hero icons
  
  // Button sizes
  buttonSmPadding: { vertical: 8, horizontal: 12 },
  buttonMdPadding: { vertical: 12, horizontal: 16 },
  buttonLgPadding: { vertical: 14, horizontal: 24 },
  
  // Badge sizes
  badgePadding: { vertical: 4, horizontal: 8 },
  badgePillPadding: { vertical: 4, horizontal: 12 },
  
  // Progress bar
  progressBarHeight: 4,
  progressBarHeightLg: 8,
} as const;

// ─────────────────────────────────────────
// Line Height & Letter Spacing
// ─────────────────────────────────────────
export const typography = {
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },
  letterSpacing: {
    normal: 0,
    wide: 0.8,
    wider: 1.2,
    widest: 1.6,
  },
} as const;

// ─────────────────────────────────────────
// Export combined/convenient shortcuts
// ─────────────────────────────────────────
export const design = {
  fontSize,
  fontWeight,
  fontFamily,
  borderRadius,
  spacing,
  macroAccentColors,
  readinessColors,
  weightCutStatusColors,
  colorFightCamp,
  colorWarning,
  colorSuccess,
  colorDestructive,
  colorProvisional,
  colorLowCarb,
  componentSize,
  typography,
} as const;

export default design;
