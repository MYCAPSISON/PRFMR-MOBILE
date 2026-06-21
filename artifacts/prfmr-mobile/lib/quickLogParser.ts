export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type TimeOfDay = "morning" | "afternoon" | "evening";
export type Confidence = "high" | "medium" | "low";

export interface FoodItem {
  rawText: string;
  normalizedName: string;
  count?: number;
  gramsHint?: number;
}

export interface ParsedFood {
  intent: "log_food";
  meal: MealType;
  items: FoodItem[];
  confidence: Confidence;
  rawInput: string;
}

export interface ParsedWeight {
  intent: "log_weight";
  weightKg: number;
  confidence: Confidence;
  rawInput: string;
}

export interface ParsedTraining {
  intent: "log_training_session";
  activityName: string;
  durationMinutes: number;
  timeOfDay: TimeOfDay;
  metValue: number;
  rawInput: string;
}

export interface ParsedSupplements {
  intent: "log_supplements";
  items: string[];
  confidence: Confidence;
  rawInput: string;
}

export interface ParsedUnknown {
  intent: "unknown";
  clarificationHint: string;
  rawInput: string;
}

export type ParseResult =
  | ParsedFood
  | ParsedWeight
  | ParsedTraining
  | ParsedSupplements
  | ParsedUnknown;

const MEAL_KEYWORDS: Record<MealType, string[]> = {
  breakfast: ["breakfast", "brekkie", "brunch", "morning meal"],
  lunch: ["lunch", "midday", "noon"],
  dinner: ["dinner", "supper", "tea", "evening meal"],
  snack: ["snack", "snacks"],
};

const FOOD_TRIGGERS = ["had", "ate", "eaten", "having", "eating", "logged", "log", "consumed"];

const WEIGHT_TRIGGERS = [
  "weight", "weigh", "bw", "bodyweight", "body weight",
  "morning weight", "scale", "lbs", "lb", "pounds",
];

export interface TrainingMatch {
  keyword: string;
  canonical: string;
  met: number;
}

const TRAINING_MAP: TrainingMatch[] = [
  { keyword: "pads", canonical: "Muay Thai", met: 9 },
  { keyword: "muay thai", canonical: "Muay Thai", met: 9 },
  { keyword: "boxing", canonical: "Boxing", met: 9 },
  { keyword: "bjj", canonical: "Judo/Jiu-Jitsu", met: 10 },
  { keyword: "jiu jitsu", canonical: "Judo/Jiu-Jitsu", met: 10 },
  { keyword: "grappling", canonical: "Judo/Jiu-Jitsu", met: 10 },
  { keyword: "sparring", canonical: "Sparring", met: 10 },
  { keyword: "bag work", canonical: "Boxing (heavy bag)", met: 8 },
  { keyword: "heavy bag", canonical: "Boxing (heavy bag)", met: 8 },
  { keyword: "running", canonical: "Running (moderate)", met: 8 },
  { keyword: "jogging", canonical: "Running (moderate)", met: 8 },
  { keyword: "jog", canonical: "Running (moderate)", met: 7 },
  { keyword: "run", canonical: "Running (moderate)", met: 8 },
  { keyword: "swimming", canonical: "Swimming (moderate)", met: 7 },
  { keyword: "swim", canonical: "Swimming (moderate)", met: 7 },
  { keyword: "cycling", canonical: "Cycling (moderate)", met: 7 },
  { keyword: "bike", canonical: "Cycling (moderate)", met: 7 },
  { keyword: "hiit", canonical: "HIIT", met: 10 },
  { keyword: "lifting", canonical: "Strength Training", met: 6 },
  { keyword: "weights", canonical: "Strength Training", met: 6 },
  { keyword: "strength", canonical: "Strength Training", met: 6 },
  { keyword: "gym", canonical: "Strength Training", met: 6 },
  { keyword: "wrestling", canonical: "Wrestling", met: 10 },
  { keyword: "crossfit", canonical: "CrossFit", met: 9 },
  { keyword: "cardio", canonical: "General Cardio", met: 7 },
  { keyword: "yoga", canonical: "Yoga", met: 3 },
  { keyword: "walk", canonical: "Walking (moderate)", met: 3.5 },
  { keyword: "walking", canonical: "Walking (moderate)", met: 3.5 },
  { keyword: "training", canonical: "General Training", met: 6 },
  { keyword: "workout", canonical: "General Training", met: 6 },
  { keyword: "session", canonical: "General Training", met: 6 },
];

const SUPPLEMENT_KEYWORDS = [
  "creatine", "vitamin", "magnesium", "zinc", "protein shake", "pre-workout",
  "preworkout", "fish oil", "omega", "collagen", "caffeine", "ashwagandha",
  "d3", "b12", "iron", "calcium", "potassium", "selenium", "probiotics",
  "turmeric", "bcaa", "glutamine", "melatonin", "glycinate",
];

const SUPPLEMENT_VERBS = ["took", "taken", "had my", "done my", "took my", "taken my"];

function extractWeightKg(text: string): number | null {
  const lbsM = text.match(/(\d+\.?\d*)\s*(?:lbs?|pounds?)/i);
  if (lbsM) return Math.round(parseFloat(lbsM[1]) * 0.453592 * 10) / 10;

  const kgM = text.match(/(\d+\.?\d*)\s*kg/i);
  if (kgM) {
    const v = parseFloat(kgM[1]);
    if (v >= 30 && v <= 250) return v;
  }

  const numM = text.match(/\b(\d{2,3}\.?\d*)\b/g);
  if (numM) {
    for (const m of numM) {
      const v = parseFloat(m);
      if (v >= 30 && v <= 250) return v;
    }
  }
  return null;
}

function extractDuration(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:min(?:utes?)?|mins?)/i);
  return m ? parseInt(m[1]) : null;
}

function extractTimeOfDay(text: string): TimeOfDay {
  const hrM = text.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
  if (hrM) {
    const hr = parseInt(hrM[1]);
    const isPm = hrM[3].toLowerCase() === "pm";
    const hr24 = isPm && hr !== 12 ? hr + 12 : !isPm && hr === 12 ? 0 : hr;
    if (hr24 < 12) return "morning";
    if (hr24 < 17) return "afternoon";
    return "evening";
  }
  if (/\bmorning\b/i.test(text)) return "morning";
  if (/\bafternoon\b/i.test(text)) return "afternoon";
  if (/\bevening\b|\bnight\b/i.test(text)) return "evening";
  return "afternoon";
}

function detectMeal(text: string): MealType {
  const lower = text.toLowerCase();
  for (const [meal, kws] of Object.entries(MEAL_KEYWORDS) as [MealType, string[]][]) {
    if (kws.some(k => lower.includes(k))) return meal;
  }
  const tod = extractTimeOfDay(text);
  if (tod === "morning") return "breakfast";
  if (tod === "afternoon") return "lunch";
  return "dinner";
}

function extractFoodItems(text: string): FoodItem[] {
  let cleaned = text.toLowerCase();

  // Strip meal / food trigger words
  for (const kws of Object.values(MEAL_KEYWORDS)) {
    for (const kw of kws) cleaned = cleaned.replace(new RegExp(`\\b(for )?${kw}\\b`, "g"), "");
  }
  for (const t of FOOD_TRIGGERS) {
    cleaned = cleaned.replace(new RegExp(`\\b${t}\\b`, "g"), "");
  }

  const parts = cleaned
    .split(/\s+and\s+|,\s*|\s*\+\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 1);

  return parts.map(part => {
    const gramsM = part.match(/^(\d+)\s*g(?:rams?)?\s+(?:of\s+)?(.+)$/i);
    const countM = part.match(/^(\d+)\s+(.+)$/);
    let count: number | undefined;
    let gramsHint: number | undefined;
    let normalizedName = part;

    if (gramsM) {
      gramsHint = parseInt(gramsM[1]);
      normalizedName = gramsM[2].trim();
    } else if (countM) {
      count = parseInt(countM[1]);
      normalizedName = countM[2].trim();
    }

    normalizedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
    return { rawText: part, normalizedName, count, gramsHint };
  }).filter(i => i.normalizedName.length > 1);
}

export function parseQuickLog(input: string): ParseResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  const scores = { weight: 0, training: 0, supplements: 0, food: 0 };

  // Weight scoring
  if (WEIGHT_TRIGGERS.some(t => lower.includes(t))) scores.weight += 3;
  const wKg = extractWeightKg(text);
  if (wKg) scores.weight += 4;

  // Training scoring
  const trainingHit = TRAINING_MAP.find(t => lower.includes(t.keyword));
  if (trainingHit) scores.training += 3;
  if (extractDuration(text)) scores.training += 2;
  if (/\d+\s*(am|pm)\b|\bmorning\b|\bafternoon\b|\bevening\b/i.test(text)) scores.training += 1;

  // Supplement scoring
  const suppHits = SUPPLEMENT_KEYWORDS.filter(k => lower.includes(k));
  scores.supplements += suppHits.length * 2;
  if (SUPPLEMENT_VERBS.some(v => lower.includes(v))) scores.supplements += 2;

  // Food scoring
  if (FOOD_TRIGGERS.some(t => lower.includes(t))) scores.food += 2;
  const allMealKws = Object.values(MEAL_KEYWORDS).flat();
  if (allMealKws.some(k => lower.includes(k))) scores.food += 2;
  const parts = lower.split(/\s+and\s+|,|\+/).filter(p => p.trim().length > 1);
  scores.food += Math.min(parts.length, 3) * 2;

  const max = Math.max(scores.weight, scores.training, scores.supplements, scores.food);

  if (max < 2) {
    return {
      intent: "unknown",
      clarificationHint:
        "Try describing food (e.g. '2 eggs for breakfast'), weight (e.g. 'weight 71.8'), training (e.g. 'pads 60 min at 7pm'), or supplements taken.",
      rawInput: text,
    };
  }

  if (scores.weight >= max) {
    return {
      intent: "log_weight",
      weightKg: wKg ?? 0,
      confidence: scores.weight >= 7 ? "high" : scores.weight >= 4 ? "medium" : "low",
      rawInput: text,
    };
  }

  if (scores.training >= max) {
    return {
      intent: "log_training_session",
      activityName: trainingHit?.canonical ?? "General Training",
      durationMinutes: extractDuration(text) ?? 60,
      timeOfDay: extractTimeOfDay(text),
      metValue: trainingHit?.met ?? 6,
      rawInput: text,
    };
  }

  if (scores.supplements >= max) {
    return {
      intent: "log_supplements",
      items: suppHits.map(k => k.charAt(0).toUpperCase() + k.slice(1)),
      confidence: scores.supplements >= 6 ? "high" : scores.supplements >= 3 ? "medium" : "low",
      rawInput: text,
    };
  }

  const meal = detectMeal(text);
  const items = extractFoodItems(text);
  return {
    intent: "log_food",
    meal,
    items: items.length > 0 ? items : [{ rawText: text, normalizedName: text }],
    confidence: scores.food >= 6 ? "high" : scores.food >= 3 ? "medium" : "low",
    rawInput: text,
  };
}
