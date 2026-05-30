import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    icon: "target" as const,
    title: "Energy Balance is King",
    content: "Weight loss is fundamentally driven by a calorie deficit. If you consume fewer calories than you burn, you will lose weight. All diets (Keto, Paleo, IF) work via this mechanism. PRFMR calculates your targets to put you in a sustainable deficit based on your weight, training load, and fight schedule.",
  },
  {
    icon: "zap" as const,
    title: "Protein — The Builder",
    content: "Essential for muscle retention during fat loss and recovery from hard training. High satiety helps control hunger. Aim for 1.6–2.2g per kg of bodyweight. As a combat athlete in a deficit, push toward the higher end. PRFMR sets your protein target accordingly.",
  },
  {
    icon: "battery" as const,
    title: "Carbohydrates — The Fuel",
    content: "Your primary energy source for high-intensity sparring and conditioning. Carbs are not the enemy. Time them around training for peak performance. PRFMR adjusts your carb targets based on your training load (ACWR) and calorie budget.",
  },
  {
    icon: "shield" as const,
    title: "Fat — The Hormonal Regulator",
    content: "Critical for testosterone, recovery, and vitamin absorption. Do not drop below 0.6g/kg. Prioritise unsaturated sources: olive oil, nuts, avocado. Omega-3 fatty acids reduce inflammation — critical for athletes taking daily contact.",
  },
  {
    icon: "trending-down" as const,
    title: "Weight Cutting",
    content: "PRFMR tracks two distinct phases: fat loss (weeks out) and water cut (final 24–72hrs). The scale will fluctuate daily due to water, sodium, and glycogen. Focus on the weekly trend. Log your weight daily at the same time — morning, post-bathroom.",
  },
  {
    icon: "activity" as const,
    title: "Training Load & Recovery",
    content: "ACWR (Acute:Chronic Workload Ratio) measures your injury risk. Keep it between 0.8–1.3. Spike it above 1.5 and injury risk doubles. PRFMR tracks your session RPE across rolling 7 and 28-day windows to keep you in the green zone.",
  },
  {
    icon: "moon" as const,
    title: "Sleep is Non-Negotiable",
    content: "Poor sleep raises cortisol, tanks testosterone, impairs reaction time, and increases hunger hormones (ghrelin). Aim for 8–9 hours in fight camp. Your morning check-in tracks sleep quality and adjusts your readiness score.",
  },
  {
    icon: "package" as const,
    title: "Supplements — Evidence-Based Only",
    content: "PRFMR tracks your supplement stack against the Athlete Micronutrient Quality Score (AMQS). Focus on: Creatine (5g/day), Magnesium (glycinate for sleep), Vitamin D3 (especially in low-sun climates), Omega-3 (2–4g EPA/DHA), Electrolytes during cut.",
  },
  {
    icon: "alert-triangle" as const,
    title: "The Three Cardinal Rules",
    content: "1. Consistency beats perfection — log every day, even bad days. 2. Weigh yourself daily — use the weekly average, not single readings. 3. Trust the process — sustainable fat loss is 0.5–1% of bodyweight per week. Faster means muscle loss.",
  },
];

export default function PlaybookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
    >
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>The Playbook</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>
          Core principles for combat sports performance. No fluff, just science.
        </Text>
      </View>

      {SECTIONS.map((section, i) => {
        const isOpen = expanded === i;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => setExpanded(isOpen ? null : i)}
            activeOpacity={0.8}
            style={[styles.card, {
              backgroundColor: isOpen ? colors.card : colors.secondary,
              borderColor: isOpen ? colors.primary + "44" : colors.border,
            }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                <Feather name={section.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>{section.title}</Text>
              <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
            </View>
            {isOpen && (
              <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22, marginTop: 8 }}>
                {section.content}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
        This information is for educational purposes only and does not constitute medical advice. Consult a healthcare professional before making significant changes to your diet or exercise programme.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10 },
  title: { fontSize: 28, fontWeight: "800" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700" },
});
