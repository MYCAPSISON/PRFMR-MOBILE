export type UnitSize = "small" | "medium" | "large";

export interface CoreFoodUnit {
  supportsCount: true;
  supportsSize: boolean;
  defaultCount: number;
  defaultSize?: UnitSize;
  gramsBySize?: { small: number; medium: number; large: number };
  gramsPerUnit?: number;
  unitLabel: string;
}

export const CORE_FOOD_UNITS: Record<string, CoreFoodUnit> = {
  // ── Eggs ──────────────────────────────────────────────────────────────────
  "Eggs, Whole (Raw)": { supportsCount: true, supportsSize: true, defaultCount: 2, defaultSize: "medium", unitLabel: "egg", gramsBySize: { small: 38, medium: 44, large: 50 } },

  // ── Fruit — size selector ─────────────────────────────────────────────────
  "Banana (Peeled)":        { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "banana",     gramsBySize: { small: 101, medium: 118, large: 136 } },
  "Apple":                  { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "apple",      gramsBySize: { small: 149, medium: 182, large: 223 } },
  "Orange (Flesh Only)":    { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "orange",     gramsBySize: { small: 96,  medium: 131, large: 184 } },
  "Pear (Flesh Only, No Core)": { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "pear",   gramsBySize: { small: 120, medium: 166, large: 209 } },
  "Peach":                  { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "peach",      gramsBySize: { small: 130, medium: 147, large: 175 } },
  "Nectarine":              { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "nectarine",  gramsBySize: { small: 115, medium: 142, large: 170 } },
  "Mango (Flesh Only)":     { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "mango",      gramsBySize: { small: 120, medium: 165, large: 220 } },
  "Avocado (Flesh Only)":   { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "avocado",    gramsBySize: { small: 80,  medium: 100, large: 150 } },
  "Grapefruit":             { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "grapefruit", gramsBySize: { small: 150, medium: 200, large: 250 } },
  "Lemon":                  { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "lemon",      gramsBySize: { small: 50,  medium: 65,  large: 80  } },
  "Pineapple (Flesh Only)": { supportsCount: true, supportsSize: true, defaultCount: 2, defaultSize: "medium", unitLabel: "ring",       gramsBySize: { small: 50,  medium: 84,  large: 112 } },
  "Watermelon (Flesh Only)":{ supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "slice",      gramsBySize: { small: 152, medium: 280, large: 400 } },

  // ── Fruit — fixed grams per unit ─────────────────────────────────────────
  "Plum":             { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "plum",          gramsPerUnit: 66 },
  "Apricot":          { supportsCount: true, supportsSize: false, defaultCount: 2, unitLabel: "apricot",       gramsPerUnit: 35 },
  "Kiwi (Peeled)":    { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "kiwi",          gramsPerUnit: 69 },
  "Lime":             { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "lime",           gramsPerUnit: 44 },
  "Figs (Fresh)":     { supportsCount: true, supportsSize: false, defaultCount: 2, unitLabel: "fig",           gramsPerUnit: 50 },
  "Dates (Dried)":    { supportsCount: true, supportsSize: false, defaultCount: 3, unitLabel: "date",          gramsPerUnit: 8  },
  "Prunes":           { supportsCount: true, supportsSize: false, defaultCount: 3, unitLabel: "prune",         gramsPerUnit: 9  },
  "Dried Apricots":   { supportsCount: true, supportsSize: false, defaultCount: 4, unitLabel: "apricot half",  gramsPerUnit: 8  },
  "Cherries":         { supportsCount: true, supportsSize: false, defaultCount: 10, unitLabel: "cherry",       gramsPerUnit: 8  },
  "Pomegranate":      { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "½ pomegranate", gramsPerUnit: 87 },

  // ── Vegetables — size selector ────────────────────────────────────────────
  "Tomato":                    { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "tomato",       gramsBySize: { small: 91,  medium: 123, large: 182 } },
  "Bell Pepper (Red)":         { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "pepper",        gramsBySize: { small: 75,  medium: 119, large: 164 } },
  "Bell Pepper (Green)":       { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "pepper",        gramsBySize: { small: 75,  medium: 119, large: 164 } },
  "Bell Pepper (Yellow)":      { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "pepper",        gramsBySize: { small: 75,  medium: 119, large: 164 } },
  "Onion":                     { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "onion",         gramsBySize: { small: 90,  medium: 148, large: 210 } },
  "Red Onion":                 { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "onion",         gramsBySize: { small: 90,  medium: 148, large: 210 } },
  "Carrots (Raw)":             { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "carrot",        gramsBySize: { small: 50,  medium: 61,  large: 82  } },
  "Sweet Potato (Raw)":        { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "sweet potato",  gramsBySize: { small: 100, medium: 150, large: 200 } },
  "Sweet Potato (Baked)":      { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "sweet potato",  gramsBySize: { small: 90,  medium: 130, large: 180 } },
  "Potato (Baked, with Skin)": { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "potato",        gramsBySize: { small: 138, medium: 173, large: 250 } },
  "Potato (Raw)":              { supportsCount: true, supportsSize: true, defaultCount: 1, defaultSize: "medium", unitLabel: "potato",        gramsBySize: { small: 100, medium: 150, large: 213 } },

  // ── Vegetables — fixed grams per unit ────────────────────────────────────
  "Cherry Tomatoes":          { supportsCount: true, supportsSize: false, defaultCount: 8,  unitLabel: "tomato",   gramsPerUnit: 17 },
  "Spring Onion (Scallion)":  { supportsCount: true, supportsSize: false, defaultCount: 3,  unitLabel: "stalk",    gramsPerUnit: 15 },
  "Mushrooms (White)":        { supportsCount: true, supportsSize: false, defaultCount: 4,  unitLabel: "mushroom", gramsPerUnit: 18 },
  "Celery":                   { supportsCount: true, supportsSize: false, defaultCount: 2,  unitLabel: "stalk",    gramsPerUnit: 40 },

  // ── Bread & Wraps — fixed grams per unit ─────────────────────────────────
  "Bread (White Sliced)":    { supportsCount: true, supportsSize: false, defaultCount: 2, unitLabel: "slice",     gramsPerUnit: 30 },
  "Bread (Wholemeal)":       { supportsCount: true, supportsSize: false, defaultCount: 2, unitLabel: "slice",     gramsPerUnit: 35 },
  "Bread (Sourdough)":       { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "slice",     gramsPerUnit: 35 },
  "Pitta Bread":             { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "pitta",     gramsPerUnit: 70 },
  "Bagel (Plain)":           { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "bagel",     gramsPerUnit: 105 },
  "Tortilla Wrap (Wheat)":   { supportsCount: true, supportsSize: false, defaultCount: 1, unitLabel: "wrap",      gramsPerUnit: 45 },
  "Rice Cakes":              { supportsCount: true, supportsSize: false, defaultCount: 3, unitLabel: "rice cake", gramsPerUnit: 9  },
};

export function getCoreFoodUnit(foodName: string): CoreFoodUnit | null {
  return CORE_FOOD_UNITS[foodName] ?? null;
}

export function computeUnitGrams(unit: CoreFoodUnit, count: number, size: UnitSize): number {
  if (unit.supportsSize && unit.gramsBySize) {
    return Math.round(unit.gramsBySize[size] * count);
  }
  return Math.round((unit.gramsPerUnit ?? 100) * count);
}
