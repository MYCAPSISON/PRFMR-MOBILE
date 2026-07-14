import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type AccordionKey = "protein" | "fats" | "carbs" | null;

function GuideCard({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: accent ? colors.primary : colors.border,
          borderLeftWidth: accent ? 4 : 1.5,
        },
      ]}
    >
      {children}
    </View>
  );
}

function CardHeader({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.cardHeader}>
      <View style={[styles.iconBox, { backgroundColor: accent ? "rgba(255,122,0,0.10)" : colors.secondary }]}>
        {icon}
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

function MacroAccordionRow({
  id,
  title,
  children,
  open,
  setOpen,
}: {
  id: Exclude<AccordionKey, null>;
  title: string;
  children: string;
  open: AccordionKey;
  setOpen: (value: AccordionKey) => void;
}) {
  const colors = useColors();
  const expanded = open === id;
  return (
    <View style={[styles.accordionItem, { borderColor: colors.border }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen(expanded ? null : id)}
        style={styles.accordionTrigger}
      >
        <Text style={[styles.accordionTitle, { color: colors.foreground }]}>{title}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
      {expanded && <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{children}</Text>}
    </View>
  );
}

export default function PlaybookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [openMacro, setOpenMacro] = useState<AccordionKey>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.title, { color: colors.foreground }]}>The Playbook</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Core principles for sustainable fat loss and health. No fluff, just science.
        </Text>
      </View>

      <GuideCard accent>
        <CardHeader
          accent
          icon={<Feather name="target" size={24} color={colors.primary} />}
          title="Energy Balance is King"
        />
        <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
          Weight loss is fundamentally driven by a calorie deficit. PRFMR calculates your targets to support a sustainable deficit based on your body metrics, training load, and fight schedule.
        </Text>
      </GuideCard>

      <GuideCard>
        <CardHeader
          icon={<MaterialCommunityIcons name="silverware-fork-knife" size={24} color={colors.foreground} />}
          title="Macronutrients Matter"
        />
        <View style={{ marginTop: 10 }}>
          <MacroAccordionRow
            id="protein"
            title="Protein (The Builder)"
            open={openMacro}
            setOpen={setOpenMacro}
          >
            Protein helps retain muscle during fat loss and supports recovery. A useful range is 1.6-2.2 g/kg lean body mass.
          </MacroAccordionRow>
          <MacroAccordionRow
            id="fats"
            title="Fats (The Hormonal Regulator)"
            open={openMacro}
            setOpen={setOpenMacro}
          >
            Dietary fat supports hormone production and vitamin absorption. Avoid dropping too low; healthy sources include olive oil, nuts, and oily fish.
          </MacroAccordionRow>
          <MacroAccordionRow
            id="carbs"
            title="Carbohydrates (The Fuel)"
            open={openMacro}
            setOpen={setOpenMacro}
          >
            Carbs are the preferred fuel for hard training. Adjust them around activity level and session demands.
          </MacroAccordionRow>
        </View>
      </GuideCard>

      <GuideCard>
        <CardHeader
          icon={<MaterialCommunityIcons name="scale-balance" size={24} color={colors.foreground} />}
          title="Weight Fluctuations"
        />
        <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
          Daily scale weight changes because of water, sodium, sleep, and glycogen. The trend matters more than a single weigh-in.
        </Text>
        <View style={styles.bullets}>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>• Weigh daily under the same conditions.</Text>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>• Focus on the weekly average trend.</Text>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>• If the trend is flat for 2+ weeks, adjust calories slightly.</Text>
        </View>
      </GuideCard>

      <GuideCard>
        <CardHeader
          icon={<Feather name="zap" size={24} color={colors.foreground} />}
          title="Actionable Habits"
        />
        {[
          ["01", "Track Accurately", "Guesstimating often underestimates intake. Use a food scale where possible."],
          ["02", "Prioritize Sleep", "Poor sleep increases hunger and reduces recovery quality."],
          ["03", "Walk More", "NEAT can burn more than gym sessions for many people. Aim for 8-10k steps."],
        ].map(([num, habit, text]) => (
          <View key={num} style={styles.habitRow}>
            <Text style={[styles.habitNum, { color: colors.primary }]}>{num}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.habitTitle, { color: colors.foreground }]}>{habit}</Text>
              <Text style={[styles.habitText, { color: colors.mutedForeground }]}>{text}</Text>
            </View>
          </View>
        ))}
      </GuideCard>

      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        Disclaimer: This information is for educational purposes only and does not constitute medical advice. Consult a healthcare professional before starting any diet or exercise program.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 24 },
  pageHeader: { alignItems: "center", gap: 12, marginBottom: 8 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: "800", textAlign: "center", fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 18, lineHeight: 26, textAlign: "center", fontFamily: "Inter_400Regular" },
  card: { borderRadius: 12, borderWidth: 1.5, padding: 20, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "800", fontFamily: "SpaceGrotesk_700Bold" },
  bodyText: { fontSize: 15, lineHeight: 23, fontFamily: "Inter_400Regular" },
  accordionItem: { borderTopWidth: 1 },
  accordionTrigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accordionTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  bullets: { gap: 5, marginTop: 4 },
  habitRow: { flexDirection: "row", gap: 14, marginTop: 12 },
  habitNum: { fontSize: 22, fontWeight: "800", fontFamily: "JetBrainsMono_700Bold" },
  habitTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  habitText: { fontSize: 14, lineHeight: 21, marginTop: 2, fontFamily: "Inter_400Regular" },
  disclaimer: { fontSize: 12, lineHeight: 19, textAlign: "center", paddingVertical: 16, fontFamily: "Inter_400Regular" },
});
