# PRFMR — Mobile Replication Guide

Complete specification for replicating PRFMR in a new Replit project.  
Target: a React Native / Expo mobile app (or a second PWA) that is **functionally identical** to the existing web app.

---

## Table of Contents

1. [App Overview & Vision](#1-app-overview--vision)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema (all tables)](#3-database-schema-all-tables)
4. [Backend Architecture](#4-backend-architecture)
5. [Calculation Engine](#5-calculation-engine)
6. [AMQS — Athlete Micronutrient Quality Score](#6-amqs--athlete-micronutrient-quality-score)
7. [Session Readiness Score](#7-session-readiness-score)
8. [Fuel Availability & Glycogen Risk](#8-fuel-availability--glycogen-risk)
9. [Weight-Cut Engine](#9-weight-cut-engine)
10. [Training Log & Load System](#10-training-log--load-system)
11. [Food Logging System](#11-food-logging-system)
12. [Core Foods Quick-Add List](#12-core-foods-quick-add-list)
13. [Composite Food Micronutrient Map](#13-composite-food-micronutrient-map)
14. [Supplement Tracker](#14-supplement-tracker)
15. [Authentication System](#15-authentication-system)
16. [Full API Endpoint Reference](#16-full-api-endpoint-reference)
17. [Frontend Pages & Components](#17-frontend-pages--components)
18. [Onboarding Flow](#18-onboarding-flow)
19. [Push Notifications & Web Push](#19-push-notifications--web-push)
20. [Fight Camp Mode (WeightCutHero)](#20-fight-camp-mode-weightcuthero)
21. [Training Block Planner](#21-training-block-planner)
22. [Share Moment / Social Card](#22-share-moment--social-card)
23. [Design System & Theming](#23-design-system--theming)
24. [Key Environment Variables](#24-key-environment-variables)
25. [External Services](#25-external-services)

---

## 1. App Overview & Vision

PRFMR is a **mobile-first nutrition and training tracker** built for combat athletes (MMA, boxing, wrestling, BJJ) and other high-performance athletes. It sits in the gap between generic calorie counters (MyFitnessPal) and coach-led software — giving a solo athlete the data-driven tools a sports nutritionist would use.

**Core user jobs-to-be-done:**
- Know exactly how many calories and macros to eat today (adjusted for training)
- Log food fast without manual lookup (barcode, quick-add, natural language)
- Understand micronutrient quality, not just macros
- Plan and execute a fight-camp weight cut with daily guidance
- Track training load and avoid overtraining

**Design philosophy:**
- Conservative framing — never over-promise
- Transparent calculations — show the maths
- Dark theme throughout
- Mobile-first layout (max-width ~430px cards, bottom-nav style)
- Space Grotesk for headings, Inter for body text

---

## 2. Technology Stack

### Frontend
| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | Wouter |
| Server state | TanStack React Query v5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Animation | Framer Motion |
| Charts | Recharts |
| Forms | react-hook-form + zodResolver |
| Icons | lucide-react + react-icons/si |
| Barcode scanner | html5-qrcode |

### Backend
| Concern | Choice |
|---|---|
| Runtime | Node.js + Express (TypeScript, ESM) |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Sessions | connect-pg-simple + express-session |
| Auth | Passport.js (local + Google OAuth 2.0) |
| Password hashing | Argon2 |
| Email | Resend |
| File storage | Replit Object Storage |
| Push | web-push (VAPID) |

### Shared
- `shared/schema.ts` — single source of truth for all Drizzle table definitions, Zod insert schemas, and TypeScript types
- `shared/routes.ts` — typed route constants (API path + method, shared between client and server)
- `shared/weight-cut.ts` — pure weight-cut calculation engine (no DB, no Express)
- `shared/utils.ts` — `getMicronutrientValue()` and other helpers

---

## 3. Database Schema (all tables)

All tables are defined with Drizzle ORM in `shared/schema.ts`.  
Column types: `serial`, `integer`, `real`, `text`, `boolean`, `timestamp`, `jsonb`.

### 3.1 `users_auth` — Authentication records
```
id            serial PK
username      text UNIQUE NOT NULL
email         text UNIQUE
passwordHash  text
googleId      text UNIQUE
displayName   text
emailVerified boolean default false
isAdmin       boolean default false
createdAt     timestamp
```

### 3.2 `users` — Profile + calculated targets
```
id                  serial PK (same id as users_auth)
username            text FK
gender              text  ('male'|'female')
age                 integer
height              integer  (cm)
weight              real     (kg)
activityLevel       text     ('sedentary'|'light'|'moderate'|'active'|'very_active')
goal                text     ('fat_loss'|'maintenance'|'weight_gain')
experienceLevel     text     ('beginner'|'intermediate'|'advanced')
bodyFatPct          real
targetCalories      integer
targetProtein       integer
targetCarbs         integer
targetFat           integer
profilePhotoUrl     text
fightCampActive     boolean  default false
fightDate           text     (YYYY-MM-DD)
weighInTiming       text     ('same_day'|'day_before')
onboardingComplete  boolean  default false
-- Onboarding survey fields (all text unless noted):
surveyCutExperience
surveyCutOutcome
surveyCalorieKnowledge
surveyUnderfueling
surveyTrainingLoadTracking
surveyMicroKnowledge
surveyEnergyScore
surveyPerformance
surveyMainProblems  text[]
surveyCommitment
surveyStarRating
```

### 3.3 `weight_logs`
```
id        serial PK
userId    integer FK
date      text   (YYYY-MM-DD)
weight    real   (kg)
```

### 3.4 `macro_logs` — Daily macro totals snapshot
```
id        serial PK
userId    integer FK
date      text
calories  integer
protein   integer
carbs     integer
fat       integer
```

### 3.5 `food_entries` — Individual food log items
```
id               serial PK
userId           integer FK
date             text
meal             text ('breakfast'|'lunch'|'dinner'|'snack')
snackIndex       integer   (for snack 1/2/3…)
name             text
grams            integer
calories         integer
protein          integer
carbs            integer
fat              integer
fibre            integer default 0
sourceType       text ('manual'|'off'|'ingredient')
ingredientIndex  integer   (index into ingredients.json for micros)
offBarcode       text
macroSource      text ('off'|'ingredient'|'mixed')
microSource      text ('ingredient'|'none')
enteredBasis     text ('raw'|'cooked') default 'cooked'
isRawWeight      boolean default false
```

### 3.6 `supplement_catalog` — Pre-built supplement library
```
id            serial PK
name          text UNIQUE
defaultUnit   text (mg|mcg|IU|g)
microsPerUnit jsonb  {nutrient_key: amount_per_unit}
notes         text
```

### 3.7 `supplements` — User's supplement shelf
```
id               serial PK
userId           integer FK
name             text
brand            text
form             text (pill|capsule|powder|liquid)
notes            text
catalogId        integer (FK supplement_catalog, null=custom)
doseAmount       real
doseUnit         text
reminderEnabled  boolean default false
reminderTime     text (HH:MM)
```

### 3.8 `supplement_intakes` — Daily take/skip tracking
```
id            serial PK
userId        integer FK
supplementId  integer FK
stackId       integer (null for standalone)
reminderId    integer (null for standalone)
date          text (YYYY-MM-DD)
taken         boolean default true
takenAt       text (ISO timestamp)
```

### 3.9 `supplement_stacks`
```
id          serial PK
userId      integer FK
name        text
description text
```

### 3.10 `stack_supplements` — Junction: stack ↔ supplement
```
id           serial PK
stackId      integer FK
supplementId integer FK
```

### 3.11 `stack_reminders`
```
id         serial PK
stackId    integer FK
time       text (HH:MM)
daysOfWeek text  (JSON array of day names)
enabled    boolean default true
```

### 3.12 `supplement_logs`
```
id           serial PK
userId       integer FK
supplementId integer FK
stackId      integer
date         text
time         text (HH:MM)
taken        boolean default true
```

### 3.13 `user_disclaimer_acceptance`
```
id              serial PK
userId          integer FK
disclaimerType  text ('supplement_reminders')
acceptedAt      text (ISO timestamp)
```

### 3.14 `meal_templates` — Saved meals
```
id          serial PK
userId      integer FK
name        text
defaultMeal text (breakfast|lunch|dinner|snack)
createdAt   text
```

### 3.15 `meal_template_items`
```
id               serial PK
templateId       integer FK
name             text
grams            integer default 100
calories         integer
protein          integer
carbs            integer
fat              integer
fibre            integer default 0
sourceType       text
ingredientIndex  integer
offBarcode       text
macroSource      text
microSource      text
sortOrder        integer default 0
```

### 3.16 Training tables

**`exercise_catalog`** — predefined lifts
```
id            serial PK
name          text UNIQUE
category      text (push|pull|legs|core|full_body|cardio)
equipment     text (barbell|dumbbell|machine|bodyweight|cable|kettlebell|bands|other)
primaryMuscle text
isCommon      boolean default true
```

**`workout_sessions`** — container
```
id               serial PK
userId           integer FK
date             text (YYYY-MM-DD)
timeOfDay        text (morning|afternoon|evening)
title            text
notes            text
durationMinutes  integer
intensity        text (light|moderate|vigorous)
estimatedMet     real
estimatedKcal    real default 0
isPlanned        boolean default false
trainingBlockId  integer
```

**`workout_exercises`** — strength items inside a session
```
id                serial PK
sessionId         integer FK
exerciseCatalogId integer (null=custom)
name              text
orderIndex        integer default 0
intensity         text default 'moderate'
durationMinutes   integer
estimatedKcal     real default 0
```

**`workout_sets`** — individual sets
```
id                serial PK
workoutExerciseId integer FK
setIndex          integer
reps              integer
weightKg          real
rpe               real (1–10)
restSeconds       integer
tempo             text (e.g. '3-1-2-0')
durationSeconds   integer
```

**`activity_catalog`** — sports/cardio with MET values
```
id        serial PK
name      text UNIQUE
intensity text (light|moderate|vigorous)
metValue  real
```

**`session_activities`** — cardio/lifting activity items
```
id                  serial PK
sessionId           integer FK
activityCatalogId   integer (null=custom)
name                text
durationMinutes     integer
intensity           text
metValue            real
estimatedKcal       real default 0
activityType        text ('cardio'|'lifting')
sessionRpe          real
bodyRegion          text ('upper'|'lower'|'full')
trainingLoadScore   real
rpe                 real (1–10)
```

### 3.17 Open Food Facts integration

**`off_product_mappings`** — barcode → ingredient mapping
```
id               serial PK
barcode          text UNIQUE
offName          text
offBrand         text
offCategories    text
ingredientIndex  integer (index into data/ingredients.json)
ingredientName   text
matchConfidence  text ('high'|'medium'|'low')
matchMethod      text ('exact'|'synonym'|'fuzzy'|'user_selected')
verifiedByUser   boolean default false
updatedAt        timestamp
```

### 3.18 `custom_foods` — User's personal food database
```
id             serial PK
userId         integer FK
name           text
brand          text
servingSizeG   integer
kcalPer100g    integer
proteinPer100g real
carbsPer100g   real
fatPer100g     real
fibrePer100g   real
saltPer100g    real
sugarPer100g   real
barcode        text
createdAt      timestamp
updatedAt      timestamp
```

### 3.19 Invite / Beta tables
```
invite_requests: id, email, status, source, ip, userAgent, createdAt
invites:         id, email, tokenHash, createdAt, expiresAt, usedAt, usedByUserId, maxUses, uses
beta_waitlist:   id, email, source, createdAt
```

### 3.20 `feedback` & `feedback_attachments`
```
feedback:             id, userId FK, category, message, route, userAgent, viewport, appVersion, status, createdAt
feedback_attachments: id, feedbackId FK, url, filename, mimeType, size, createdAt
```

### 3.21 Daily tracking tables

**`sleep_logs`** — unique per (userId, date)
```
id           serial PK
userId       integer FK
date         text (YYYY-MM-DD)
hoursSlept   real
sleepQuality integer (1–5)
createdAt    timestamp
updatedAt    timestamp
```

**`weight_cut_plans`** — one active per user
```
id                     serial PK
userId                 integer FK
currentWeight          real (kg)
targetWeight           real (kg)
fightDate              text (YYYY-MM-DD)
weighInTiming          text ('same_day'|'day_before')
manualTempReductionKg  real
createdAt              timestamp
updatedAt              timestamp
```

**`provisional_checkins`** — unique per (userId, date)
```
id                         serial PK
userId                     integer FK
date                       text
feelToday                  text ('fresh'|'okay'|'tired')
fueledToday                text ('yes'|'somewhat'|'no')
plannedIntensity           text ('light'|'moderate'|'hard')
trainedYesterday           boolean
yesterdayTrainingIntensity text ('light'|'moderate'|'hard')
```

**`rest_day_logs`** — unique per (userId, date)
```
id        serial PK
userId    integer FK
date      text
createdAt timestamp
```

**`training_load_overrides`** — unique per (userId, date)
```
id                      serial PK
userId                  integer FK
date                    text
overrideClassification  text
```

**`username_changes`** — rate limiting for username edits
```
id          serial PK
userId      integer FK
oldUsername text
newUsername text
createdAt   timestamp
```

### 3.22 Training Block Planner

**`training_blocks`**
```
id        serial PK
userId    integer FK
name      text
startDate text (YYYY-MM-DD)
weekCount integer
status    text default 'active' ('active'|'archived')
createdAt timestamp
```

**`training_block_days`**
```
id          serial PK
blockId     integer FK → training_blocks (cascade delete)
dayOfWeek   integer (0=Mon … 6=Sun)
plannedLoad text default 'rest'
activities  jsonb  (array of BlockActivityTemplate)
notes       text
```

`BlockActivityTemplate` JSON shape:
```json
{
  "activityType": "cardio"|"lifting",
  "name": "string",
  "durationMinutes": 60,
  "rpe": 7,
  "intensity": "moderate",
  "metValue": 8.0,
  "bodyRegion": "lower",
  "activityCatalogId": 12,
  "slot": "morning"|"afternoon"|"evening"|"night"
}
```

---

## 4. Backend Architecture

```
server/
  index.ts            Express app entry — session, passport, routes
  routes.ts           All API handlers (~4263 lines)
  storage.ts          IStorage interface + DrizzleStorage implementation
  auth-routes.ts      Login, register, logout, verify-email, forgot-password
  invite-routes.ts    Admin invite management
  feedback-routes.ts  Feedback submission + attachment handling
  lib/
    amqs.ts           AMQS scoring engine
    micros.ts         Micronutrient extraction + composite food map
    energy.ts         Calorie burn helpers, RPE adjustment
    readiness.ts      Session Readiness Score composite
    fuel-availability.ts  Fuel / glycogen status
    training-load.ts  ACWR, load classification, lifting calorie estimates
  replit_integrations/
    object_storage.ts Replit Object Storage routes for file upload

shared/
  schema.ts           All Drizzle tables, Zod schemas, TypeScript types
  routes.ts           Typed API route constants
  weight-cut.ts       Pure weight-cut calculation functions
  utils.ts            getMicronutrientValue() and helpers
  username-validation.ts  validateUsername(), normalizeUsername(), RESERVED_USERNAMES

data/
  ingredients.json    Full micronutrient database (~700+ ingredients)
                      Each entry: { name, micros: { vitaminC: x, iron: x, … } }
```

### Storage interface pattern
All database operations flow through `IStorage` (in `server/storage.ts`).  
Routes call `storage.someMethod(args)` — never raw Drizzle in routes.  
`DrizzleStorage` implements the interface against PostgreSQL via Drizzle ORM.

---

## 5. Calculation Engine

All core maths lives in `server/routes.ts` `calculateTargets()` and `shared/weight-cut.ts`.

### 5.1 BMR — Mifflin-St Jeor
```
BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age)
      + 5   (male)
      − 161 (female)
```

### 5.2 TDEE
```
Multipliers:
  sedentary   × 1.2
  light       × 1.375
  moderate    × 1.55
  active      × 1.725
  very_active × 1.9

TDEE = BMR × multiplier
```

### 5.3 Goal-based calorie targets
| Goal | Calories | Protein | Fat |
|---|---|---|---|
| fat_loss | TDEE − 500 | 2.2 g/kg | 0.7 g/kg |
| maintenance | TDEE | 1.8 g/kg | 0.8 g/kg |
| weight_gain | TDEE + 300 | 1.8 g/kg | 0.9 g/kg |

### 5.4 Dynamic carbs
```
Carbs = (targetCalories − (protein × 4) − (fat × 9)) / 4
```
Carbs are always the residual macro — protein and fat are fixed first.

### 5.5 Training calorie credits
When the user logs a training session, extra calories are added back:
```
Credit pct:
  fat_loss    → 50%
  maintenance → 75%
  weight_gain → 100%

Adjusted target calories = base target + (sessionKcal × creditPct)
```

### 5.6 Fight Camp target override
Priority order (highest wins):
1. **Fight Camp Active** — macro model driven by `weighInTiming` and weeks to fight
2. **Profile Goal** (fat_loss / maintenance / weight_gain)
3. **Maintenance fallback**

Fight camp models:
- `same_day` cut: more aggressive deficit, lower carbs
- `day_before` cut: moderate deficit, carb management before rehydration window

---

## 6. AMQS — Athlete Micronutrient Quality Score

Defined in `server/lib/amqs.ts`. Returns a score 0–100 and tier label.

### 6.1 Tracked nutrients (17 total)

The micro keys used throughout the codebase (in `ingredients.json`, `MICRO_KEYS` array in `micros.ts`, and `supplement_catalog.microsPerUnit`) use the suffix format below. **Use these exact key names** when building the data model.

| DB/JSON key | Display name | L1 Baseline Target | L2 Athlete Target |
|---|---|---|---|
| `vitamin_c_mg` | Vitamin C | 90 mg | 200 mg |
| `vitamin_d_ug` | Vitamin D | 20 mcg | 50 mcg |
| `vitamin_b12_ug` | Vitamin B12 | 2.4 mcg | 4 mcg |
| `vitamin_b6_mg` | Vitamin B6 | 1.7 mg | 3 mg |
| `folate_ug` | Folate | 400 mcg | 600 mcg |
| `vitamin_a_ug` | Vitamin A | 900 mcg | 1200 mcg |
| `vitamin_b2_mg` | Vitamin B2 (Riboflavin) | 1.3 mg | 2 mg |
| `vitamin_b1_mg` | Vitamin B1 (Thiamine) | 1.2 mg | 2 mg |
| `vitamin_b3_mg` | Vitamin B3 (Niacin) | 16 mg | 25 mg |
| `iron_mg` | Iron | 8 mg (M) / 18 mg (F) | 12 mg (M) / 25 mg (F) |
| `calcium_mg` | Calcium | 1000 mg | 1300 mg |
| `magnesium_mg` | Magnesium | 420 mg (M) / 320 mg (F) | 500 mg |
| `zinc_mg` | Zinc | 11 mg (M) / 8 mg (F) | 14 mg (M) / 11 mg (F) |
| `potassium_mg` | Potassium | 3500 mg | 4700 mg |
| `iodine_ug` | Iodine | 150 mcg | 200 mcg |
| `omega3_g` | Omega-3 | 1.1 g | 3 g |
| `selenium_ug` | Selenium | 55 mcg | 70 mcg |

`ingredients.json` stores each micro as `{key}_per_100g` (e.g. `iron_mg_per_100g`). All values are per 100 g of the ingredient (cooked basis where a `cookFactor` applies).

### 6.2 Two-layer scoring model

**L1 — Baseline Adequacy (50% of score)**  
Linear 0→1 as intake moves from 0 → L1 target.

**L2 — Athlete Optimization (50% of score)**  
Linear 0→1 as intake moves from L1 target → L2 target.

Per nutrient: `nutrientScore = (L1score × 0.5) + (L2score × 0.5)`  
Total: `rawScore = average(nutrientScore × weight) × 100`

Nutrient weights vary (critical nutrients get higher weight):
- Critical (iron, calcium, vitD, magnesium, zinc): weight 1.5
- Important (omega3, vitB12, potassium, fibre, vitC): weight 1.2
- Standard: weight 1.0

### 6.3 Elite gate
A score can only reach the "Elite" tier if **all critical nutrients** (iron, calcium, vitD, magnesium, zinc) are at ≥70% of their L1 target.

### 6.4 Tier thresholds
| Score | Tier |
|---|---|
| ≥ 90 | Elite |
| ≥ 75 | Optimal |
| ≥ 55 | Good |
| ≥ 35 | Fair |
| < 35 | Basic |

### 6.5 Confidence rating
Based on % of food entries that have micronutrient data:
- 0–30%: Low
- 31–60%: Medium
- 61–100%: High

### 6.6 Supplement micros
Supplement intakes for the day are aggregated and added to the food micronutrient totals before scoring. Uses `microsPerUnit × doseAmount` from `supplement_catalog.microsPerUnit`.

---

## 7. Session Readiness Score

Defined in `server/lib/readiness.ts`. Composite score 0–100 from 4 components.

| Component | Max Points | Logic |
|---|---|---|
| Sleep | 30 | < 5h = 0; 5–6h = 15; 6–7h = 20; 7–8h = 25; ≥ 8h = 30. Sleep quality (1–5) adds up to 5 bonus pts. |
| Energy Availability | 30 | Based on yesterday's calorie intake vs target. At/above target = 30; 75–99% = 22; 50–74% = 12; <50% = 4 |
| Carb Sufficiency | 25 | Based on yesterday's carb intake vs target. ≥100% = 25; 75–99% = 18; 50–74% = 10; <50% = 3 |
| AMQS | 15 | Elite=15; Optimal=12; Good=9; Fair=5; Basic=2 |

**Labels:**
- ≥ 85 → High
- ≥ 70 → Moderate
- ≥ 55 → Low
- < 55 → Poor
- **Provisional** — if sleep or yesterday food data is missing

If data is missing, a **Provisional Check-In** card is shown on the dashboard so the user can self-report (feel: fresh/okay/tired; fueled: yes/somewhat/no; planned intensity: light/moderate/hard).

---

## 8. Fuel Availability & Glycogen Risk

Defined in `server/lib/fuel-availability.ts`. Returns a status label + supporting numbers.

Inputs used:
- Yesterday's carb intake
- Today's training plan (expected kcal burn + intensity)
- User's weight (for glycogen capacity estimates)
- Whether today is a rest day

Status labels (in descending priority):
1. **REST_DAY** — user marked today as rest
2. **NO_TRAINING** — no session logged/planned
3. **WELL_FUELLED** — carbs + reserves sufficient for planned training
4. **MODERATE_RISK** — carbs low, performance may suffer
5. **HIGH_RISK** — significant glycogen deficit, high injury/fatigue risk
6. **DEPLETED** — severely under-fuelled for the planned load

The calculation compares yesterday's carb intake against a threshold based on body weight (≈3–5 g/kg depending on intensity) minus the expected carb cost of today's session.

---

## 9. Weight-Cut Engine

Defined in `shared/weight-cut.ts` — **pure functions, no side effects**.

### 9.1 Two flows: `same_day` vs `day_before`

**same_day** — athlete competes on the same day as weigh-in:
- All weight loss must come from sustainable fat loss (1% BW/week cap)
- No water manipulation window available
- Harder: requires longer run-up

**day_before** — athlete weighs in the day before competing:
- Allows temporary water/glycogen reduction in the final 24–48h
- Fat loss component handles the structural deficit
- Temp cut component handles the final flush

### 9.2 `calculateWeightCutPlan(inputs)` — main entry point

Inputs:
```typescript
{
  currentWeight: number   // kg
  targetWeight: number    // kg
  fightDate: string       // YYYY-MM-DD
  weighInTiming: 'same_day' | 'day_before'
  manualTempReductionKg?: number  // override auto-calc of water cut portion
}
```

Returns:
```typescript
{
  totalDrop: number             // kg to lose
  fatLossDrop: number           // kg via fat loss
  tempCutDrop: number           // kg via water/glycogen (day_before only)
  weeksAvailable: number
  recommendedWeeklyRate: number // kg/week fat loss
  isAchievable: boolean
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme'
  weeklyTargets: WeeklyTarget[] // for chart
  warnings: string[]
}
```

### 9.3 `buildWeeklyTargets()`

Produces an array of `{ week, projectedWeight, caloricDeficitPerDay }` for the weight trend chart on the dashboard and in ShareMomentSheet.

### 9.4 Constraints
- Max sustainable fat loss: 1% of body weight per week (hard cap)
- Temp cut capped at 5–8% body weight (adjustable by `manualTempReductionKg`)
- Risk levels triggered by weekly rate:
  - ≤ 0.5 kg/week → low
  - ≤ 0.75 kg/week → moderate
  - ≤ 1.0 kg/week → high
  - > 1.0 kg/week → extreme

---

## 10. Training Log & Load System

### 10.1 Calorie burn estimation
Defined in `server/lib/energy.ts`.

#### Core MET formula (`kcalFromMET`)
```
kcal/min = MET × 3.5 × bodyWeightKg / 200
sessionKcal = kcal/min × durationMinutes
```
Returns 0 if any input is zero or negative.

#### Strength training METs (`getStrengthMET`)
Used when no MET value comes from the activity catalog:
```
light    → 3.5
moderate → 5.0  ← default when intensity is null/unknown
vigorous → 6.0
```

#### Session calorie calculator (`calculateSessionCalories`)
```typescript
calculateSessionCalories(
  weightKg: number,
  input: {
    durationMinutes?: number | null,
    intensity?: string | null,
    sets?: Array<{ restSeconds?: number | null }>,
    activities?: Array<{ metValue: number; durationMinutes: number }>
  }
): { totalKcal, strengthKcal, activityKcal, estimatedMinutes }
```
- If `durationMinutes` is not provided but `sets` are, duration is **estimated from sets** (see below)
- Strength kcal = `kcalFromMET(strengthMET, weight, strengthMinutes)`
- Activity/cardio kcal = sum of `kcalFromMET(activity.metValue, weight, activity.durationMinutes)` for each activity
- `totalKcal = strengthKcal + activityKcal` (rounded)

#### Duration estimation from sets (`estimateDurationFromSets`)
When `durationMinutes` is absent and sets are available:
```
avgRestSeconds = mean of provided restSeconds values,
                 or 90s default if none provided
totalSeconds   = setCount × (35s per set + avgRestSeconds)
estimatedMinutes = ceil(totalSeconds / 60)
```
Default timing constants:
- `avgSetTimeSeconds = 35`
- `defaultRestSeconds = 90`

#### RPE adjustment for cardio (`getRpeKcalAdjustmentFactor`)
Applied **only to cardio** activities when the user logs an RPE value:
```
factor = 0.9 + (clamp(rpe, 1, 10) / 10) × 0.2
  RPE 1  → ×0.92
  RPE 5  → ×1.00
  RPE 10 → ×1.10
finalKcal = baseKcal × factor
```
**Not applied to lifting** — lifting uses `estimateLiftingCalories()` which has its own RPE model.  
**Not applied to leisure/recovery activities** — these are excluded by name:

```
Excluded keywords (if activity name contains any of these, no RPE adjustment):
"leisure", "easy", "recovery", "warmup", "warm-up", "warm up",
"cooldown", "cool-down", "cool down", "mobility", "stretch",
"stretching", "gentle", "casual", "walking", "walk"
```

`shouldApplyRpeKcalAdjustment(activityName, activityType)` returns `false` for `activityType === "lifting"` or any name matching the exclusion list.

#### Lifting calorie estimation (`estimateLiftingCalories`)
Separate model used for `activityType === "lifting"` entries in `session_activities`:
```typescript
estimateLiftingCalories({
  bodyRegion: 'upper' | 'lower' | 'full',
  durationMinutes: number,
  rpe: number,       // 1–10
  bodyWeightKg: number
}): number
```
METs by body region:
```
lower → 5.5
full  → 5.0
upper → 4.5
```
RPE is baked into this model directly (not via the cardio RPE factor).

#### kcal-per-rep display (`estimateKcalPerRep`)
```typescript
estimateKcalPerRep(totalKcal: number, totalReps: number): number | null
// Returns null if either input is 0; otherwise rounds to 1 decimal
// Purely a rough reference for the user — not medically accurate
```

### 10.2 Training load (ACWR)
Defined in `server/lib/training-load.ts`.

**Acute:Chronic Workload Ratio (ACWR)**
```
acute  = average daily load over last 7 days
chronic = average daily load over last 28 days
ACWR = acute / chronic (if chronic > 0, else = acute / 1)
```

**Load score per session:**  
Based on `sessionRpe × durationMinutes` (per activity), normalised to a 0–100 scale.

**Day classifications:**
| Classification | Meaning |
|---|---|
| rest | No sessions logged |
| easy | Low load, RPE < 5 |
| moderate | Medium load |
| hard | High load, RPE ≥ 7 |
| very_hard | Extreme load |

**ACWR risk bands:**
- < 0.8 → undertraining
- 0.8–1.3 → optimal (sweet spot)
- 1.3–1.5 → caution
- > 1.5 → overtraining risk (Training Block Planner forces acknowledgment before saving)

### 10.3 `computeLoadWarnings()` — warning messages
Returns `{ acwr, warnings: string[], riskLevel }` based on load history.

---

## 11. Food Logging System

### 11.1 Entry sources
1. **Manual** — user types macros directly
2. **Core Foods Quick-Add** — pre-curated list of common meals (see §12)
3. **Open Food Facts search** — barcode or text search via `/api/foods/search`
4. **Barcode scan** — html5-qrcode → `/api/food/barcode/:code`
5. **Saved Meals (templates)** — one-tap log of a saved meal template
6. **Copy from another day** — `/api/me/meals/copy`
7. **AI Quick Log** — natural language → `AILogDialog.tsx`

### 11.2 Raw vs cooked weight
Each entry has `enteredBasis: 'raw'|'cooked'` and `isRawWeight: boolean`.  
The server applies a **cook-factor conversion** to standardise all entries to cooked weight before calculating macros/micros.  
Typical factors (stored in `ingredients.json`): rice raw→cooked ≈ 0.4, chicken raw→cooked ≈ 0.75.

### 11.3 Micronutrient resolution chain

`getFoodMicrosForDate()` in `server/lib/micros.ts` processes each food entry in this priority order:

**Step 1 — Composite food name match (highest priority)**  
Check `entry.name.toLowerCase().trim()` against the `COMPOSITE_FOODS` map (see §13).  
If matched:
- Scale each component's gram weight by `loggedGrams / referenceServing`
- Look up each component in `ingredients.json` by case-insensitive name
- Sum `(micro_per_100g × componentGrams) / 100` for each of the 17 `MICRO_KEYS`
- This path is followed for **all** core food quick-add entries

**Step 2 — OFF entry with ingredient mapping**  
If `entry.sourceType === "off"` AND `entry.microSource === "ingredient"` AND `entry.ingredientIndex` is a valid number:
- Look up `ingredients[ingredientIndex]` directly (by array position, not name)
- Sum `(micro_per_100g × entryGrams) / 100`
- This path is followed when the user has mapped a scanned barcode to an ingredient

**Step 3 — Manual entry name fallback**  
If `entry.sourceType !== "off"`:
- Case-insensitive name search in `ingredients.json` (`i.name.toLowerCase() === entry.name.toLowerCase()`)
- If matched, use that ingredient's micros
- Allows whole-food manual entries (e.g. "Chicken breast") to get micros automatically

**Step 4 — No micros**  
OFF entries without a valid mapping (`microSource !== "ingredient"`) are skipped entirely — they contribute zero to AMQS.

#### Micro key lookup helper (`getMicronutrientValue`)
```typescript
// From shared/utils.ts
getMicronutrientValue(ingredient, `${key}_per_100g`)
// Returns null if the key doesn't exist on the ingredient object
```

#### How core foods map to scanned/OFF foods
Core food quick-adds work via **name-based composite matching** (Step 1 above) — no `ingredientIndex` is needed.  
When a user scans a barcode for a product that is similar to a core food (e.g., a branded porridge), the barcode flow runs separately and the user can map it to an ingredient via `/api/food/barcode/:code/map`. The mapping writes `ingredientIndex` and `microSource: "ingredient"` to the `food_entries` row, enabling Step 2 on future lookups.

### 11.4 Barcode flow
1. Client sends barcode to `/api/food/barcode/:code`
2. Server checks `off_product_mappings` for existing mapping
3. If not found → fetches from Open Food Facts API
4. If found with high-confidence match → returns ingredient micros automatically
5. If low confidence → client shows "map to ingredient" UI for the user to pick
6. User selection saved via `/api/food/barcode/:code/map`

### 11.5 Meal sections
Meals: `breakfast`, `lunch`, `dinner`, `snack`  
Snacks are numbered with `snackIndex` (0, 1, 2…) to support multiple snack slots.

### 11.6 Macro warnings
Visual warnings appear when logged macros exceed targets by >10%.

---

## 12. Core Foods Quick-Add List

These are pre-defined in `client/src/pages/dashboard.tsx` as `CORE_FOODS`.  
No backend call needed — these are logged directly with the specified macros.

| Name | Serving (g) | Calories | Protein (g) | Carbs (g) | Fat (g) | Fibre (g) |
|---|---|---|---|---|---|---|
| Porridge (oats + milk) | 250 | 185 | 7 | 27 | 5 | 3 |
| Porridge (oats + water) | 250 | 130 | 5 | 23 | 2 | 3 |
| Cappuccino (whole milk) | 240 | 120 | 6 | 10 | 6 | 0 |
| Latte (whole milk) | 350 | 180 | 9 | 14 | 9 | 0 |
| Flat White | 200 | 120 | 6 | 10 | 6 | 0 |
| Cappuccino (oat milk) | 240 | 100 | 3 | 16 | 3 | 1 |
| Toast with Butter (white) | 45 | 155 | 3 | 17 | 8 | 1 |
| Toast without Butter (white) | 30 | 80 | 3 | 15 | 1 | 1 |
| Toast with Butter (wholemeal) | 50 | 165 | 5 | 18 | 8 | 3 |
| Mashed Potato | 200 | 180 | 4 | 30 | 5 | 2 |
| Scrambled Eggs (2 eggs, butter) | 130 | 220 | 14 | 2 | 17 | 0 |
| Protein Shake (whey + water) | 350 | 130 | 25 | 3 | 2 | 0 |
| Protein Shake (whey + milk) | 350 | 280 | 35 | 18 | 8 | 0 |
| Overnight Oats | 300 | 320 | 12 | 45 | 10 | 5 |
| Beans on Toast | 260 | 280 | 14 | 42 | 5 | 8 |
| Tuna Mayo Sandwich | 200 | 350 | 22 | 30 | 14 | 2 |
| Chicken Wrap | 250 | 380 | 28 | 35 | 12 | 2 |
| Greek Yoghurt with Honey | 170 | 180 | 14 | 22 | 5 | 0 |
| PB&J Sandwich | 130 | 380 | 12 | 45 | 16 | 3 |
| Cereal with Milk | 270 | 250 | 8 | 42 | 5 | 3 |

---

## 13. Composite Food Micronutrient Map

Defined in `server/lib/micros.ts` as `COMPOSITE_FOODS`.

**How it works:**
1. The entry name is lowercased and trimmed, then matched as a key in this map
2. Each component references an ingredient by **exact name** in `ingredients.json` (case-insensitive match)
3. Component gram weights are **per reference serving** — they are scaled proportionally if the user logged a different gram amount: `componentGrams × (loggedGrams / referenceServing)`
4. Only ingredients that have tracked micros contribute — coffee/espresso is **intentionally omitted** from all coffee drinks because it contains negligible amounts of the 17 tracked nutrients

> ⚠️ The ingredient names below are the exact strings that must exist in `ingredients.json`. If you rename any ingredient, the composite lookup silently fails (a `validateCompositeIngredients()` startup check warns in console if any are missing).

| Core Food (matched lowercase) | Ref. Serving | Components (ingredient name in ingredients.json → grams) |
|---|---|---|
| porridge (oats + milk) | 250 g | `Oats (Raw)` → 40 g · `Milk (Whole)` → 200 g |
| porridge (oats + water) | 250 g | `Oats (Raw)` → 45 g |
| cappuccino (whole milk) | 240 g | `Milk (Whole)` → 120 g *(espresso omitted — no tracked micros)* |
| latte (whole milk) | 350 g | `Milk (Whole)` → 200 g |
| flat white | 200 g | `Milk (Whole)` → 130 g |
| cappuccino (oat milk) | 240 g | `Oat Milk` → 120 g |
| toast with butter (white) | 45 g | `Bread (White Sliced)` → 30 g · `Butter` → 10 g |
| toast without butter (white) | 30 g | `Bread (White Sliced)` → 30 g |
| toast with butter (wholemeal) | 50 g | `Bread (Wholemeal)` → 36 g · `Butter` → 10 g |
| mashed potato | 200 g | `Potatoes (Boiled)` → 180 g · `Butter` → 10 g · `Milk (Whole)` → 20 g |
| scrambled eggs (2 eggs, butter) | 130 g | `Eggs, Whole (Raw)` → 100 g · `Butter` → 10 g · `Milk (Whole)` → 20 g |
| overnight oats | 300 g | `Oats (Raw)` → 50 g · `Milk (Whole)` → 150 g · `Greek Yogurt (Plain)` → 50 g |
| beans on toast | 260 g | `Baked Beans (Canned)` → 200 g · `Bread (White Sliced)` → 60 g |
| greek yoghurt with honey | 170 g | `Greek Yogurt (Plain)` → 150 g · `Honey` → 15 g |
| cereal with milk | 270 g | `Milk (Whole)` → 200 g *(cereal omitted — highly variable, no single micro profile)* |

**Note on foods without a composite entry:**  
`Tuna Mayo Sandwich`, `Chicken Wrap`, `PB&J Sandwich`, and `Protein Shake` variants are in the Quick-Add list but **not** in `COMPOSITE_FOODS`. Entries with these names fall through to Step 3 of the resolution chain (manual name fallback against `ingredients.json`) and will only get micros if an exact-name match exists there.

---

## 14. Supplement Tracker

### 14.1 User flow
1. User adds supplements to their "shelf" (from catalog or custom)
2. Optionally groups supplements into stacks
3. Sets reminders per supplement or per stack (day-of-week + time)
4. Each day, logs intake (taken/skipped) via `supplement_intakes`
5. Micronutrients from taken supplements are added to daily AMQS

### 14.2 Micro integration
`server/lib/micros.ts` aggregates supplement micros:
```
totalMicros[nutrient] += supplement.doseAmount × catalog.microsPerUnit[nutrient]
```
This runs alongside food micros before AMQS is computed.

### 14.3 Disclaimer gate
Before enabling reminders, user must accept a disclaimer (`userDisclaimerAcceptance` table, type=`'supplement_reminders'`).

---

## 15. Authentication System

### 15.1 Session auth
- `express-session` + `connect-pg-simple` (sessions stored in PostgreSQL)
- `SESSION_SECRET` env var
- Session cookie: httpOnly, sameSite: 'lax', secure in production

### 15.2 Local strategy (Passport.js)
- Username or email login
- Password hashed with **Argon2** (not bcrypt)
- Email verification required before login (Resend sends verification email)
- Forgot password → time-limited reset link via Resend

### 15.3 Google OAuth 2.0
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars
- `/auth/google` → Google consent → `/auth/google/callback`
- Creates or links `usersAuth` record on first login

### 15.4 Invite-only beta
- Beta cap controlled by `BETA_USER_LIMIT` env var (currently 200)
- Active user count from `users_auth` table
- New signups require an invite token OR the cap must not be reached
- Invite tokens stored hashed in `invites` table

### 15.5 Username rules
- 3–20 characters, alphanumeric + underscore + hyphen
- Cannot be a reserved word (list in `shared/username-validation.ts`)
- Rate-limited changes: max 2 per 30 days (tracked in `username_changes`)

### 15.6 Special account: `onboardtester`
After `POST /api/user/me/onboard` completes for username `onboardtester`, a 90-second `setTimeout` resets all profile fields to null — keeping this account perpetually ready for fresh onboarding demos in production.

---

## 16. Full API Endpoint Reference

All endpoints require an authenticated session unless noted.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Username/email + password |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/register` | Invite-gated signup |
| POST | `/api/auth/forgot-password` | Sends Resend email |
| POST | `/api/auth/reset-password` | Token + new password |
| GET  | `/api/auth/verify-email` | Email verification token |
| GET  | `/auth/google` | OAuth redirect |
| GET  | `/auth/google/callback` | OAuth callback |

### App meta
| Method | Path | Notes |
|---|---|---|
| GET | `/api/meta` | App version, environment |

### User / Profile
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/user/me` | Current user profile + targets |
| POST   | `/api/user/me/onboard` | Complete onboarding (sets all profile fields) |
| GET    | `/api/me` | Same as above (legacy) |
| PATCH  | `/api/me/username` | Change username (rate-limited) |
| PATCH  | `/api/me/body-composition` | Update bodyFatPct |
| PUT    | `/api/me/profile-photo` | Upload profile photo (Object Storage) |
| GET    | `/api/username/available?username=x` | Username availability check |

### Food Logging
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/me/food/:date` | All food entries for a date |
| GET    | `/api/me/food-entries/range?start=&end=` | Range of entries |
| POST   | `/api/food` | Create food entry |
| PATCH  | `/api/food/:id` | Edit entry |
| DELETE | `/api/food/:id` | Delete entry |
| POST   | `/api/me/meals/copy` | Copy food entry to another date/meal |

### Food Search & Barcodes
| Method | Path | Notes |
|---|---|---|
| GET  | `/api/foods/search?q=` | Open Food Facts text search |
| POST | `/api/foods/search/match` | Auto-match to ingredient by macros |
| GET  | `/api/food/barcode/:code` | Fetch barcode from OFF + mapping lookup |
| POST | `/api/food/barcode/:code/map` | User maps barcode to ingredient |
| POST | `/api/food/barcode/:code/create` | Create custom food from barcode scan |

### Custom Foods (My Foods)
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/foods/custom` | User's custom foods |
| GET    | `/api/foods/custom/:id` | Single custom food |
| POST   | `/api/foods/custom` | Create custom food |
| PUT    | `/api/foods/custom/:id` | Update custom food |
| DELETE | `/api/foods/custom/:id` | Delete custom food |
| GET    | `/api/foods/custom/barcode/:code` | Look up custom food by barcode |

### Meal Templates (Saved Meals)
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/me/meals/templates` | User's saved meals |
| POST   | `/api/me/meals/templates/from-log` | Save a logged meal as template |
| POST   | `/api/me/meals/templates/:id/log` | Log a template to a date/meal |
| DELETE | `/api/me/meals/templates/:id` | Delete template |

### Weight Logs
| Method | Path | Notes |
|---|---|---|
| GET  | `/api/me/logs` | All weight logs |
| POST | `/api/logs` | Create weight log |
| PATCH| `/api/logs/:id` | Update weight log |
| GET  | `/api/me/weights/range?start=&end=` | Weight logs for date range |

### Macro Logs
| Method | Path | Notes |
|---|---|---|
| GET  | `/api/macros/:username/:date` | Day macro totals |

### Supplements
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/me/supplements` | User's supplements |
| GET    | `/api/supplements/:username` | By username |
| POST   | `/api/supplements` | Add supplement |
| PATCH  | `/api/supplements/:id` | Update supplement |
| DELETE | `/api/supplements/:id` | Remove supplement |
| GET    | `/api/me/stacks` | User's stacks |
| GET    | `/api/me/stacks/scheduled` | Stacks with schedule |
| GET    | `/api/me/supplements/reminders` | All reminders |
| GET    | `/api/me/reminders` | Combined reminders view |
| GET    | `/api/me/reminders/today` | Today's reminders |
| GET    | `/api/me/disclaimer/:type` | Check disclaimer acceptance |
| POST   | `/api/stacks` | Create stack |
| PATCH  | `/api/stacks/:id` | Update stack |
| DELETE | `/api/stacks/:id` | Delete stack |
| POST   | `/api/stack-supplements` | Add supplement to stack |
| DELETE | `/api/stack-supplements/:id` | Remove supplement from stack |
| POST   | `/api/stack-reminders` | Add reminder to stack |
| PATCH  | `/api/stack-reminders/:id` | Update reminder |
| DELETE | `/api/stack-reminders/:id` | Delete reminder |

### Supplement Intakes (Daily Tracking)
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/me/supplement-intakes/:date` | Today's intakes |
| GET    | `/api/me/supplement-intakes/:startDate/:endDate` | Range |
| POST   | `/api/supplement-intakes` | Log an intake |
| PATCH  | `/api/supplement-intakes/:id` | Update intake |
| DELETE | `/api/supplement-intakes/:id` | Delete intake |

### Supplement Micros & AMQS
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me/supplement-micros/:date` | Supplement micro totals for date |
| GET | `/api/me/supplement-micros-range/:startDate/:endDate` | Range |
| GET | `/api/me/amqs/micros/:date` | Combined food + supplement micros |
| GET | `/api/me/amqs/score/:date` | AMQS score + tier for date |
| GET | `/api/me/amqs/score-range/:startDate/:endDate` | AMQS scores for range |
| GET | `/api/me/amqs/trend/:date` | 7-day AMQS trend ending at date |

### Ingredient catalog (for micro lookups)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/ingredients` | Full ingredients.json array |

### Training
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/exercises` | Exercise catalog |
| GET    | `/api/activities` | Activity catalog (with METs) |
| GET    | `/api/workouts/sessions?date=` | Sessions for date |
| POST   | `/api/workouts/sessions` | Create session |
| PATCH  | `/api/workouts/sessions/:id` | Update session |
| DELETE | `/api/workouts/sessions/:id` | Delete session |
| POST   | `/api/workouts/sessions/:sessionId/exercises` | Add exercise to session |
| PATCH  | `/api/workouts/exercises/:id` | Update exercise |
| DELETE | `/api/workouts/exercises/:id` | Delete exercise |
| POST   | `/api/workouts/exercises/:exerciseId/sets` | Add set |
| PATCH  | `/api/workouts/sets/:id` | Update set |
| DELETE | `/api/workouts/sets/:id` | Delete set |
| POST   | `/api/workouts/sessions/:sessionId/activities` | Add activity (cardio/lifting) |
| PATCH  | `/api/workouts/activities/:id` | Update activity |
| DELETE | `/api/workouts/activities/:id` | Delete activity |
| GET    | `/api/me/training/summary/:date` | Kcal burned + session list for date |
| POST   | `/api/me/training/manual-burn` | Log manual calorie burn |
| POST   | `/api/me/training/load` | Compute training load for a date |
| GET    | `/api/me/training-load/:date` | ACWR + load data for date |
| GET    | `/api/me/training/load-history/:date` | 28-day load history |
| POST   | `/api/me/training/load-override/:date` | Override day classification |
| GET    | `/api/training/summary/:username/:date` | By username (admin) |

### Training Blocks
| Method | Path | Notes |
|---|---|---|
| GET  | `/api/training-blocks/active` | User's active training block |
| POST | `/api/training-blocks` | Create training block (commits sessions) |
| DELETE | `/api/training-blocks/:id` | Archive/delete training block |
| POST | `/api/training-blocks/preview` | Preview ACWR without saving |

### Dashboard / Daily Status
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me/targets/effective` | Today's calorie + macro targets (fight camp override applied) |
| GET | `/api/me/morning-status/:date` | Morning check-in state |
| GET | `/api/me/readiness/:date` | Session readiness score |
| GET | `/api/me/fuel/:date` | Fuel availability status |
| PUT | `/api/me/sleep/:date` | Upsert sleep log |
| GET | `/api/me/sleep/:date` | Get sleep log |
| PUT | `/api/me/provisional-checkin/:date` | Upsert provisional check-in |
| GET | `/api/me/provisional-checkin/:date` | Get provisional check-in |
| POST | `/api/me/rest-day/:date` | Mark day as rest |
| DELETE | `/api/me/rest-day/:date` | Unmark rest day |

### Weight Cut
| Method | Path | Notes |
|---|---|---|
| GET    | `/api/me/weight-cut` | Get current weight cut plan |
| POST   | `/api/me/weight-cut` | Create weight cut plan |
| PUT    | `/api/me/weight-cut` | Update weight cut plan |
| DELETE | `/api/me/weight-cut` | Delete weight cut plan |

### Feedback
| Method | Path | Notes |
|---|---|---|
| POST | `/api/feedback` | Submit feedback |
| GET  | `/api/feedback` | List (admin) |
| POST | `/api/feedback/attachments` | Upload screenshot attachment |

### Invite System
| Method | Path | Notes |
|---|---|---|
| POST | `/api/invites` | Create invite (admin) |
| GET  | `/api/invites` | List invites (admin) |
| POST | `/api/invite-requests` | Request an invite (public) |

### Debug / Admin (protected)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/debug/db` | DB connection health |
| GET | `/api/debug/amqs/:username/:date` | AMQS breakdown for user+date |
| GET | `/api/debug/off-mapping/:barcode` | Barcode mapping debug |
| GET | `/api/debug/seed-status` | Catalog seeding status |
| GET | `/api/debug/catalog-health` | Exercise + activity catalog health |
| GET | `/api/admin/debug` | Admin user stats |

---

## 17. Frontend Pages & Components

### Pages (`client/src/pages/`)

| File | Route | Description |
|---|---|---|
| `start.tsx` | `/` | Landing page / splash |
| `login.tsx` | `/login` | Login form |
| `signup.tsx` | `/signup` | Registration form |
| `register.tsx` | `/register` | Alt registration path |
| `onboarding.tsx` | `/onboarding` | Multi-step onboarding wizard |
| `dashboard.tsx` | `/dashboard` | Main daily dashboard |
| `training.tsx` | `/training` | Training log |
| `supplements.tsx` | `/supplements` | Supplement tracker |
| `stacks.tsx` | `/stacks` | Supplement stacks |
| `micronutrients.tsx` | `/micronutrients` | Micronutrient detail view |
| `readiness.tsx` | `/readiness` | Session readiness detail |
| `playbook.tsx` | `/playbook` | Educational content |
| `profile.tsx` | `/profile` | User profile + settings |
| `load-trend.tsx` | `/load-trend` | Training load history chart |
| `feedback.tsx` | `/feedback` | Feedback form |
| `verify-email.tsx` | `/verify-email` | Email verification landing |
| `forgot-password.tsx` | `/forgot-password` | Password reset request |
| `reset-password.tsx` | `/reset-password` | Password reset form |
| `not-found.tsx` | `*` | 404 page |

### Key Components (`client/src/components/`)

| File | Description |
|---|---|
| `layout.tsx` | App shell — nav bar, bottom tab bar, page container |
| `WeightCutHero.tsx` | Fight camp hero card with countdown + progress + share |
| `MorningCheckIn.tsx` | Morning check-in card (weight, sleep, training prompt) |
| `MorningCheckInGate.tsx` | Gate wrapper — shows check-in if not yet done |
| `SessionReadiness.tsx` | Readiness score card with breakdown |
| `ReadinessSummaryCard.tsx` | Compact readiness summary |
| `FuelAvailability.tsx` | Fuel / glycogen status card |
| `AMQSCard.tsx` | AMQS score card with tier badge |
| `ProvisionalCheckIn.tsx` | Self-report card when data is missing |
| `ShareMomentSheet.tsx` | Canvas-based social card generator |
| `TrainingBlockModal.tsx` | Multi-step training block creation modal |
| `TrainingLoadWarningModal.tsx` | ACWR overtraining warning modal |
| `AILogDialog.tsx` | Natural-language food/weight/training log |
| `WeightCutPlanner.tsx` | Weight cut setup wizard |
| `weight-update-dialog.tsx` | Inline weight logging dialog |
| `ObjectUploader.tsx` | Profile photo upload (Replit Object Storage) |
| `feedback-modal.tsx` | Feedback submission modal |
| `email-verification-banner.tsx` | Banner shown when email not verified |
| `CelebrationBurst.tsx` | Confetti / celebration animation |
| `protected-route.tsx` | Route guard — redirects to login if no session |

---

## 18. Onboarding Flow

Defined in `client/src/pages/onboarding.tsx`. Multi-step wizard, ~22 steps.

### Step structure
| Step | Content |
|---|---|
| 0 | Splash — full-screen design image, orange CTA button (`data-testid="button-splash-cta"`) |
| 1–3 | Basic profile: gender, age, height |
| 4 | Current weight |
| 5 | Activity level |
| 6 | Goal selection (fat loss / maintenance / weight gain) |
| 7 | Experience level |
| 8–14 | Survey questions (cut experience, calorie knowledge, underfueling, load tracking, micro knowledge, energy score, performance) |
| 15 | Main problems multi-select (text[] saved) |
| 16 | Commitment level |
| 17 | Star rating |
| 18 | Target preview (calculated from inputs) |
| 19 | Body fat % (optional) |
| 20 | Fight camp setup (optional — date, target weight, timing) |
| 21 | Projected cut chart (uses `calculateWeightCutPlan()` with real data) |
| 22 | Done — POST to `/api/user/me/onboard` |

### Survey fields saved to `users` table
`surveyCutExperience`, `surveyCutOutcome`, `surveyCalorieKnowledge`, `surveyUnderfueling`, `surveyTrainingLoadTracking`, `surveyMicroKnowledge`, `surveyEnergyScore`, `surveyPerformance`, `surveyMainProblems` (text[]), `surveyCommitment`, `surveyStarRating`

### Splash design
- Full-screen background image fills viewport
- Orange CTA button absolutely positioned at `bottom: 4%`, overlaying baked-in button area of image
- Image file: `BD246D36-3AE7-426E-88E2-322E8390F5AB_1777318574706.png`

### Non-splash step styling
- Card: `border-0 shadow-none bg-transparent`
- Progress bar track: `bg-white/5`
- `OptionBtn` component: no `border-2`; selected = `ring-1 ring-primary/50`; unselected = `bg-secondary/60`

---

## 19. Push Notifications & Web Push

- Library: `web-push` (VAPID keys in env vars)
- `POST /api/me/push-subscription` — register device subscription
- `DELETE /api/me/push-subscription` — remove subscription
- Supplement reminder notifications triggered server-side at scheduled times
- Client registers service worker (`/sw.js`) and requests `PushManager` permission

---

## 20. Fight Camp Mode (WeightCutHero)

Displayed on the dashboard when `user.fightCampActive = true`.

### `FcModalData` type (TypeScript)
```typescript
type FcModalData = {
  milestone: string;
  value: string | number;
  unit?: string;
  chartType?: 'weight_trend' | 'projected_cut';
  projectedCut?: WeeklyTarget[];   // from calculateWeightCutPlan().weeklyTargets
  currentWeight?: number;
  targetWeight?: number;
};
```

### Triggers for fight camp modal
1. **New fight camp created** — fires modal with `chartType: 'projected_cut'` and plan data
2. **Milestone hit** — weight milestone, consistency streak, cut adherence

### WeightCutHero card content
- Countdown: days to fight
- Current vs target weight
- Weekly rate of fat loss (recommendedWeeklyRate)
- Consistency streak
- Risk level badge
- Share button → opens `ShareMomentSheet`

---

## 21. Training Block Planner

Multi-step modal in `client/src/components/TrainingBlockModal.tsx`.

### User flow
1. Name the block
2. Set start date + number of weeks (1–16)
3. For each day of the week: add activities (cardio or lifting), set RPE/intensity, set time slot
4. Preview ACWR → `POST /api/training-blocks/preview` → returns projected ACWR
5. If ACWR > 1.5: `TrainingLoadWarningModal` forces acknowledgment
6. Commit → `POST /api/training-blocks` → creates `training_blocks` + `training_block_days` records AND generates `workout_sessions` for all dates

### Active block display
- Block name shown as a header chip on the training page
- Planned load for the selected date shown in the date card

### Preview endpoint
```
POST /api/training-blocks/preview
Body: { startDate, weekCount, days: BlockActivityTemplate[] per dayOfWeek }
Returns: { acwr, riskLevel, warnings }
```

---

## 22. Share Moment / Social Card

Defined in `client/src/components/ShareMomentSheet.tsx`.

**Pure Canvas 2D rendering — no DOM elements, no screenshots.**

### Card dimensions
- 400 × 640 px logical, rendered at 2× (800 × 1280 physical) for retina

### Card layout (top to bottom)
1. **PRFMR logo bar** — brand name + tagline
2. **Achievement card** — milestone label + value + unit (e.g. "Week 3 target: 83.2 kg")
3. **Dark separator** — visual gap
4. **Chart area** — either:
   - `weight_trend` — Recharts-style line chart of actual weight logs
   - `projected_cut` — line chart from `calculateWeightCutPlan().weeklyTargets` showing projected weekly weights

### Share pipeline
1. `WeightCutHero` builds `FcModalData` with chart data
2. User taps share → `ShareMomentSheet` receives props
3. Canvas renders card
4. `canvas.toBlob()` → download or Web Share API

---

## 23. Design System & Theming

This section documents the exact design tokens, layout shell, CSS utilities, animations, and per-page component ordering sourced directly from the production source code.

---

### 23.1 Colour Tokens (CSS Custom Properties)

Dark theme only — no light-mode toggle. All values in `:root`, using H S% L% format (Tailwind HSL without the `hsl()` wrapper).

```css
/* index.css :root */
--background:          220 20%  7%;   /* near-black slate */
--foreground:          210 10% 95%;   /* near-white */

--primary:              24 100% 50%;  /* brand orange  hsl(24,100%,50%) */
--primary-foreground:    0  0% 100%;  /* white */

--secondary:           220 15% 13%;   /* dark slate */
--secondary-foreground: 210 10% 90%;

--muted:               220 12% 17%;
--muted-foreground:    215 10% 50%;

--accent:               24 100% 50%;  /* same as primary (orange) */
--accent-foreground:     0  0% 100%;

--card:                220 16% 11%;
--card-foreground:     210 10% 95%;

--popover:             220 16% 11%;
--popover-foreground:  210 10% 95%;

--destructive:           0 62% 50%;   /* red */
--destructive-foreground: 0  0% 98%;

--border:              220 10% 15%;
--input:               220 10% 15%;
--ring:                 24 100% 50%;  /* orange focus ring */

--radius: 0.5rem;  /* base border-radius (8px) */

/* Sidebar-specific tokens */
--sidebar-background:  220 18%  8%;
--sidebar-foreground:  210 10% 90%;
--sidebar-primary:      24 100% 50%;
--sidebar-accent:      220 12% 15%;
--sidebar-border:      220 12% 14%;
```

**Tailwind border-radius scale** (from `tailwind.config.ts`):
```
lg: calc(var(--radius) + 0.0625rem)  → 0.5625rem (9px)
md: calc(var(--radius) - 0.125rem)   → 0.375rem  (6px)
sm: calc(var(--radius) - 0.3125rem)  → 0.1875rem (3px)
```

---

### 23.2 Typography

Three fonts are used:

| Role | Family | Tailwind class | Load method |
|---|---|---|---|
| Body / UI | **Inter** 300/400/500/600 | `font-sans` | Google Fonts (`index.css` line 1) |
| Monospace numbers | **JetBrains Mono** 400/500 | `font-mono` | Google Fonts (`index.css` line 1) |
| Headings (h1–h6) | **Space Grotesk** | `font-display` | **Not** in the Google Fonts import — declared in `h1–h6` base rule as `font-family: 'Space Grotesk', sans-serif`. Ensure it is loaded separately (e.g. Google Fonts or self-hosted). |

```css
/* Base layer rules */
body {
  font-family: 'Inter', sans-serif;
  @apply antialiased selection:bg-accent/20;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Space Grotesk', sans-serif;
  @apply tracking-tight font-medium;
}
```

Usage patterns observed in code:
- Page titles: `text-2xl font-display font-bold` or `text-3xl font-display font-bold`
- Card section headings: `text-lg font-display font-semibold`
- Large numeric values: `text-3xl font-extrabold font-mono` or `text-4xl font-mono font-bold tracking-tight`
- Micro labels / descriptors: `text-[10px] text-muted-foreground/70 tracking-wide`
- Disclaimer text: `text-[10px] italic text-muted-foreground`

Playfair Display is **not used** anywhere — do not load it.

---

### 23.3 Custom CSS Utility Classes

All defined in `@layer components` in `index.css`:

#### `.card-elevated`
Adds depth shadow + slightly lighter border. Used on chart/meal cards.
```css
box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15);
border-color: hsl(220 12% 18% / 0.5);
```

#### `.card-hover`
Lift effect on hover (only pointer devices). Pair with `.card-elevated`.
```css
transition: box-shadow 0.2s ease, transform 0.2s ease;
/* hover: */
box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.2);
transform: translateY(-1px);
```

#### `.progress-bar-animated`
Smooth width fill for progress bars.
```css
transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
```

#### `.number-animate`
Soft value-change transition on numeric displays.
```css
transition: all 0.3s ease-out;
```

#### `.fab-shadow`
Orange glow for the floating action button (mobile Add Food FAB).
```css
box-shadow: 0 3px 10px rgba(255,122,0,0.3), 0 1px 4px rgba(0,0,0,0.25);
/* active: */
box-shadow: 0 1px 6px rgba(255,122,0,0.2), 0 1px 3px rgba(0,0,0,0.2);
transform: scale(0.95);
```

#### `.amqs-glow`
Subtle orange text glow for AMQS score displays.
```css
text-shadow: 0 0 10px hsl(var(--primary) / 0.15);
```

#### `.amqs-card-glow`
Card shadow for AMQS nutrient cards.
```css
box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1);
border: 1px solid hsl(var(--border) / 0.25);
```

#### `.amqs-card-interactive`
Hover/press transitions for interactive AMQS cards.
```css
transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
/* active: */  transform: scale(0.985);
/* hover: */   box-shadow: 0 2px 4px rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.15);
               border-color: hsl(var(--border) / 0.4);
```

#### `.amqs-highlight`
Orange pulse keyframe, fires once on new AMQS score (2 s, ease-out).
```css
@keyframes amqs-pulse {
  0%   { box-shadow: 0 0 0 0 hsl(var(--primary)/0.4);       border-color: hsl(var(--primary)/0.5); }
  30%  { box-shadow: 0 0 12px 4px hsl(var(--primary)/0.25); border-color: hsl(var(--primary)/0.5); }
  100% { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 14px rgba(0,0,0,0.15); border-color: hsl(var(--primary)/0.18); }
}
```

#### `.pb-safe`
iOS home-indicator safe area. Applied to mobile bottom nav.
```css
padding-bottom: env(safe-area-inset-bottom, 0px);
```

**Scrollbar styling** (webkit):
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 3px; }
```

---

### 23.4 Layout Shell (`Layout` component in `layout.tsx`)

```
┌─────────────────────────────────────────────────────┐
│ HEADER  sticky top-0 z-50                           │
│  h-16 · bg-background/80 backdrop-blur              │
│  [PRFMR logo h-9]          [Desktop nav links]      │
│                            Dashboard Training …     │
│                            Log out                  │
├─────────────────────────────────────────────────────┤
│ MAIN                                                │
│  container px-4 py-8 sm:px-6 lg:py-10              │
│  max-w-5xl mx-auto                                  │
│  {children}                                         │
├─────────────────────────────────────────────────────┤
│ FOOTER (desktop only, hidden on mobile)             │
│  border-t py-4 · disclaimer text · text-[11px]      │
│  Controlled by VITE_SHOW_FOOTER_TAGLINE env var     │
└─────────────────────────────────────────────────────┘
│ MOBILE BOTTOM NAV  fixed bottom-0 z-50              │
│  bg-background border-t px-1 py-2 pb-safe           │
│  flex justify-around                                │
│  [Dashboard] [Training] [Supplements]               │
│  [Playbook]  [Profile]  [Feedback]  [Log out]       │
│  icon (h-5 w-5) + label text-[9px] per tab          │
│  Active: text-primary bg-secondary rounded-lg       │
└─────────────────────────────────────────────────────┘

VERSION WATERMARK (desktop only, fixed):
  bottom:6px right:8px · font-size:10px · opacity:0.35
  font-family:monospace · z-index:40 · pointer-events:none
  Text: "v{version} • {environment}"
```

**Mobile spacer:** `<div className="md:hidden h-20" />` inserted after `<nav>` to prevent content being hidden behind the fixed bottom nav.

**Desktop nav links** (text-sm, `hover:text-primary`, active link = `text-primary`):
Dashboard → Training → Supplements → Playbook → Profile → Feedback → Log out

---

### 23.5 Route Map

| Path | Component | Guard |
|---|---|---|
| `/` | LoginPage (redirects to `/dashboard` if logged in) | PublicOnlyRoute |
| `/login` | LoginPage | PublicOnlyRoute |
| `/register` or `/start` | StartPage (invite-only entry) | PublicOnlyRoute |
| `/signup` | SignupPage | PublicOnlyRoute |
| `/verify-email` | VerifyEmailPage | None |
| `/forgot-password` | ForgotPasswordPage | PublicOnlyRoute |
| `/reset-password` | ResetPasswordPage | PublicOnlyRoute |
| `/onboarding` | OnboardingPage | OnboardingGuard |
| `/dashboard` | Dashboard | ProtectedRoute |
| `/training` | TrainingPage | ProtectedRoute |
| `/supplements` | SupplementsPage | ProtectedRoute |
| `/playbook` | PlaybookPage | ProtectedRoute |
| `/profile` | ProfilePage | ProtectedRoute |
| `/feedback` | FeedbackPage | ProtectedRoute |
| `/micronutrients` | MicronutrientsPage | ProtectedRoute |
| `/load-trend` | LoadTrendPage | ProtectedRoute |
| `/stacks` | — | Redirect → `/supplements` |

**Global component** (`App.tsx`): `<MorningCheckInGate>` renders outside the Router on every authenticated page **except** `/onboarding`. It shows the morning check-in modal when appropriate.

---

### 23.6 Dashboard Page — Exact Component Order

All components render inside `<Layout>` wrapped in `<div className="space-y-8">`.

```
1.  <CelebrationBurst />
    — Confetti animation, rendered globally (spring physics via Framer Motion)

2.  <AILogDialog open={aiLogOpen} … />
    — Full-screen modal for natural-language Quick Log
    — Triggered by "Quick Log" button (Sparkles icon) in date nav bar

3.  <EmailVerificationBanner />
    — Orange banner at top if user's email is unverified
    — Only renders when email is not verified

4.  <WeightCutHero />
    — Fight camp hero card: countdown, weight goals, fat loss breakdown
    — Only renders when fight camp plan is active
    — Styled: bg-card, fight-camp orange accents

5.  <MorningCheckIn date={selectedDate} />
    — Prompts sleep log, morning weight, session creation
    — Inline weight logging and sleep quality selector

6.  <ReadinessSummaryCard date={selectedDate} />
    — Composite readiness score (0–100), fuel availability, glycogen risk
    — Wrapped in <div className="pt-2">

7.  <ProvisionalCheckIn date={selectedDate} />
    — Self-report card for missing data
    — Only renders when data gaps are detected

8.  DAILY INTAKE ESTIMATES CARD  (shadcn Card)
    ├── CardHeader
    │   ├── Title: "Daily Intake Estimates"
    │   ├── Badge "Fight Camp" (orange, conditional)
    │   ├── Badge "+N kcal training" (outline, conditional)
    │   └── Info Popover button (ⓘ, ghost sm) → side:left popover
    │       Content: goal mode label, mode note, calculation explanation
    ├── 2×4 macro target grid (cols-2 sm:cols-4)
    │   Each cell: p-4 bg-secondary/50 rounded-lg text-center
    │   Number: text-3xl font-extrabold font-mono
    │   Label:  text-[10px] text-muted-foreground/70 tracking-wide
    │   Cells: Calories · Protein · Carbs · Fat
    ├── Fight Camp callout (conditional): bg-orange-500/8 border-orange-500/20
    ├── EA row (conditional Fight Camp): shows kcal/kg FFM
    │   → Clicking "Review →" opens EA warning Dialog
    ├── Low-carb warning row (conditional): bg-yellow-500/10
    │   → Clicking "Review →" opens Carb warning Dialog
    ├── Disclaimer p (text-[10px] italic muted)
    └── Collapsible "How estimates are calculated"
        Trigger: ghost sm button w-full justify-start (ChevronDown icon)

9.  DATE NAVIGATION BAR  (flex-col sm:flex-row justify-between)
    Left: ← prev (outline icon btn) · date <input type="date"> · next → · Today (ghost sm, hidden when today)
    Right: WeightUpdateDialog btn · FoodEntryDialog btn (primary) · Quick Log btn (Sparkles) · LogEntryDialog btn

10. GREETING HEADER
    h1 "Hello, {username}" — text-3xl font-display font-bold
    p   "Here is your daily nutrition summary." (or date string)

11. MACRO STATS GRID  (grid cols-1 sm:cols-2 lg:cols-5 gap-4)
    <StatCard> components:
    · Calories  — border-l-4 border-l-primary     (orange)  — Flame icon
    · Protein   — border-l-4 border-l-blue-500               — Beef icon
    · Carbs     — border-l-4 border-l-amber-500              — Wheat icon
    · Fat       — border-l-4 border-l-yellow-500             — Droplets icon
    · Fibre     — border-l-4 border-l-emerald-500  (target 30g) — Leaf icon

12. MACRO WARNING BANNER (conditional, one or none shows)
    A: Calories >105% of target → amber banner "Today ran a bit higher…"
       bg-amber-500/10 border-amber-500/20 rounded-xl px-4 py-3
    B: Calories <95% but a macro >110% → neutral banner
       bg-card/60 border-border/40 rounded-xl px-4 py-3

13. AMQS MINI CTA ROW  (clickable → navigates to /micronutrients)
    rounded-xl border border-border/50 bg-card p-4
    Left:  ShieldCheck icon + "Micronutrient Score" + score/tier text
    Right: ChevronRight icon
    Interaction: onClick → setLocation("/micronutrients")

14. <TodaysSupplements userId={user.id} selectedDate={selectedDate} />
    — Checklist of supplements scheduled for today
    — Checkbox per supplement; tapping marks as taken

15. <TodaysTraining selectedDate={selectedDate} />
    — Summary of training sessions for the selected date

16. 3-COLUMN GRID  (grid md:grid-cols-3 gap-6)
    Left col (md:col-span-2):
    ├── WEIGHT TREND CHART  (bg-card border border-border/40 rounded-xl p-6 card-elevated)
    │   Header: "Weight Trend" (font-display font-semibold) + "Last 7 recorded entries"
    │   Scale icon in bg-secondary p-2 rounded-lg
    │   Recharts AreaChart h-[250px]:
    │     · linearGradient fill: primary 10%→0% opacity
    │     · CartesianGrid: strokeDasharray="3 3" vertical={false}
    │     · XAxis: date labels, stroke muted-foreground
    │     · YAxis: domain [auto, auto], stroke muted-foreground
    │     · Area: stroke primary, fill "url(#colorWeight)"
    │     Empty state: centred p "Record more weight data to see trends"
    └── MEALS CARD  (bg-card border border-border/40 rounded-xl p-6 card-elevated)
        Header: "Today's Meals" or "Meals — {MMM d}" + SavedMealsDialog button
        Content: <MealGroupedEntries> (groups by Breakfast/Lunch/Dinner/Snacks)
        Empty state: Utensils icon + instructional text + dashed border
        Footer note: text-[10px] italic muted about approximate values

    Right col (1 col):
    └── CURRENT WEIGHT CARD  (bg-card border border-border/40 rounded-xl p-6 card-elevated h-fit)
        Number: text-4xl font-mono font-bold tracking-tight
        Unit "kg": text-lg font-sans font-medium text-muted-foreground
        Status text: "Recorded today" / "No weight recorded today" etc.
        Info box: bg-accent/10 border-accent/20 rounded-lg p-4
          "Weight naturally fluctuates day to day…"

17. BETA FEEDBACK CARD  (shadcn Card card-elevated)
    MessageSquare icon + "Beta Feedback" title
    → "Send Feedback" button → Link to /feedback

18. MOBILE FAB  (md:hidden, fixed)
    fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full
    bg-primary text-primary-foreground fab-shadow
    Plus icon h-6 w-6
    Interaction: clicks the hidden `[data-testid="button-add-food"]` button
                 to open the FoodEntryDialog

MODALS (rendered in the Dashboard, outside the main flow):
· EA Warning Dialog (data-testid="dialog-ea-warning"): sm:max-w-sm
  Shows current EA vs recommended; two buttons: Adjust / Keep plan
· Carb Warning Dialog: similar pattern for low carb
· FightCamp overrides managed via useFightCampOverride hook
```

---

### 23.7 Training Page — Exact Component Order

```
<Layout>
  <div className="space-y-6">

1.  PAGE HEADER  (flex-col sm:flex-row sm:justify-between)
    Left: h1 "Training Log" (text-2xl font-display font-bold)
          p "Track your workouts and activities" (text-muted-foreground)
    Right (flex flex-wrap items-center gap-2):
    ├── Fight Night chip (conditional): bg-orange-500/15 border-orange-500/30 text-orange-400
    │   "🥊 N days to fight night"  data-testid="chip-days-to-fight"
    ├── Active block chip (conditional): bg-primary/10 border-primary/25 text-primary
    │   Calendar icon + block name  data-testid="chip-active-block"
    └── Plan/Edit Block button: outline sm, border-primary/30 text-primary hover:bg-primary/10
        → Opens TrainingBlockModal

2.  DATE CARD  (shadcn Card, CardContent p-4)
    ← ChevronLeft button
    Center (flex-1 text-center):
    ├── <input type="date"> w-auto mx-auto text-center
    ├── p: formatted date (EEEE, MMMM d, yyyy)
    └── Planned load chip (conditional): colour-coded pill
        · very_hard → bg-red-500/15 text-red-400
        · hard      → bg-orange-500/15 text-orange-400
        · moderate  → bg-yellow-500/15 text-yellow-400
        · easy      → bg-green-500/15 text-green-400
        · rest      → bg-muted/30 text-muted-foreground
    → ChevronRight button

3.  REST DAY TOGGLE  (only shown when sessions.length === 0)
    flex justify-end
    Pill button: BedDouble icon
    · Default:  border-border/50 text-muted-foreground
    · Active:   bg-green-500/15 border-green-500/30 text-green-400 "Rest day ✓ (tap to undo)"
    data-testid="button-toggle-rest-day"

4.  CALORIES BURNED CARD  (bg-accent/10 border-accent/20)
    Row: Flame icon + "Estimated Calories Burned"  |  day-load Badge + "~N kcal"
    Day classification badge colours match planned-load scheme above
    Warnings: orange AlertTriangle rows (text-xs text-orange-400/70)
    Footer row: italic disclaimer | "28-day trend →" button → /load-trend
    If no currentWeight: muted note "Set your weight in profile…"

5.  SESSION SECTIONS  (3×, one per time of day)
    Rendered as Collapsible + Card:
    Morning (Sun icon) · Afternoon (Zap icon) · Evening (Moon icon)
    
    Collapsible header (CardHeader p-4, cursor-pointer):
    ├── ChevronDown (rotates -90° when closed)
    ├── Time label + icon descriptor (text-xs text-muted-foreground)
    └── Estimated kcal Badge (secondary) — only if session exists

    Collapsible content (CardContent p-4 pt-0):
    IF no session: tap-to-log button (Plus icon + text)
    IF session exists:
    ├── Session title (if set) + "Planned" badge (bg-primary/8 text-primary/80)
    ├── Intensity badge (outline) + duration (Clock icon)
    ├── Delete session button (Trash2, destructive)
    ├── Exercises subsection:
    │   Header: Dumbbell icon + "Add Exercise" button → opens AddExerciseDialog
    │   Each exercise row: name, sets×reps×weight, RPE badge
    │   → Tap exercise row: opens ExerciseDetailDialog (edit sets/reps/weight/RPE)
    ├── Cardio subsection:
    │   Header: Activity icon + "Add Cardio" button → opens AddCardioDialog
    │   Each cardio row: activity name + duration/distance + kcal estimate
    └── Manual kcal override: "Add manual calories" link → inline number input

6.  LOAD WARNING MODAL  (Dialog)
    Opens automatically after logging activities if ACWR > 1.5
    Shows ACWR value, risk level, recommendation text
    Two buttons: Acknowledge / Dismiss

7.  <TrainingBlockModal>  (Dialog, multi-step)
    Step 1: Block name + duration (weeks) + start date
    Step 2: Weekly day pattern (checkboxes for Mon–Sun)
    Step 3: Load per day (very_hard/hard/moderate/easy/rest)
    Step 4: ACWR preview chart (GET /api/training-blocks/preview)
            If ACWR >1.5: force acknowledgment checkbox before proceeding
    → Submit: POST /api/training-blocks
```

---

### 23.8 Supplements Page — Exact Component Order

```
<Layout>
  <div className="max-w-2xl mx-auto space-y-6">

1.  PAGE HEADER  (flex items-center justify-between)
    h1 "Supplements" (text-2xl font-display font-bold)
    "Add Supplement" button (primary) → opens Add Dialog

2.  CATALOG ERROR CARD  (conditional)
    Only shown if supplement catalog failed to load
    Alert variant with retry option

3.  EXPLAINER BOX
    rounded-xl bg-secondary/30 border-border/30 p-4
    BookOpen icon + heading "About Supplement Tracking"
    Expandable text explaining micronutrient integration

4.  YOUR SUPPLEMENTS CARD  (shadcn Card)
    CardHeader: "Your Supplements" + count badge
    CardContent:
    IF empty: Pill icon + "No supplements added yet" + instructional text
    IF has supplements: AnimatePresence list
      Each supplement item (motion.div):
        initial:  { opacity: 0, y: 10 }
        animate:  { opacity: 1, y: 0 }
        exit:     { opacity: 0, x: -20 }
        transition: { duration: 0.2 }
        
        Row layout:
        ├── Supplement name (font-medium)
        ├── Dosage + unit (text-sm text-muted-foreground)
        ├── Frequency badge (outline)
        ├── Edit button (Pencil icon, ghost sm) → opens Edit Dialog
        └── Delete button (Trash2, ghost sm, destructive)

5.  ADD / EDIT SUPPLEMENT DIALOG  (shadcn Dialog)
    Fields: name, brand, category, dosage, unit, frequency, notes
    Micro integration: optional per-nutrient values for micronutrient scoring
    Submit: POST /api/supplements (add) or PATCH /api/supplements/:id (edit)
```

---

### 23.9 Profile Page — Exact Component Order

```
<Layout>
  <div className="max-w-2xl mx-auto space-y-8">

1.  AVATAR / USERNAME SECTION  (text-center)
    Avatar: 80×80 circle (rounded-full)
      Shows profile photo (object storage) or initials fallback
    Username: text-xl font-semibold
    Edit pencil button: ghost sm → opens profile photo upload sheet

2.  CURRENT METRICS CARD  (shadcn Card)
    CardHeader: "Current Metrics"
    CardContent: 2-col grid
    ├── Height (cm)
    ├── Weight (kg)
    ├── Age (years)
    ├── Activity Level (badge)
    └── Body Fat % (if set)

3.  NUTRITION TARGETS CARD  (shadcn Card)
    CardHeader: "Your Nutrition Targets" + recalculate note
    CardContent:
    2-col or 4-col macro boxes (p-4 bg-secondary/50 rounded-lg text-center):
    · Calories (text-3xl font-bold font-mono)
    · Protein g
    · Carbs g
    · Fat g
    
4.  PUSH NOTIFICATIONS CARD  (shadcn Card)
    Toggle Switch to enable/disable push notifications
    Status text: "Enabled" / "Disabled"
    → Toggle calls /api/push/subscribe or /api/push/unsubscribe

5.  RECALCULATE GOALS BUTTON  (full-width or prominent)
    → Opens RecalculateDialog: confirms recalculation using current metrics
    → POST /api/user/me/recalculate → invalidates user + targets queries
```

---

### 23.10 shadcn/ui Components Inventory

Button, Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, Badge, Avatar, AvatarImage, AvatarFallback, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetHeader, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Drawer, Progress, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, ScrollArea, Separator, Switch, Slider, Alert, AlertDescription, Toast (via useToast), Tooltip, TooltipContent, TooltipTrigger, Popover, PopoverContent, PopoverTrigger, Command, CommandInput, CommandList, CommandItem, CommandEmpty, RadioGroup, RadioGroupItem, Checkbox, Label, Form, FormField, FormItem, FormLabel, FormControl, FormMessage, Collapsible, CollapsibleTrigger, CollapsibleContent

---

### 23.11 Framer Motion Patterns

- **Supplement list items**: `AnimatePresence` with `initial={opacity:0, y:10}`, `animate={opacity:1, y:0}`, `exit={opacity:0, x:-20}`, `transition={duration:0.2}`
- **CelebrationBurst**: spring physics confetti, fires on goal achievements
- **Onboarding steps**: fade + slide transitions between steps
- **Modal/Dialog**: shadcn Dialog handles its own transition (Radix UI); Framer Motion wraps content inside for staggered field reveals where used
- **Number values**: `.number-animate` CSS class (0.3s ease-out all)
- **Progress bars**: `.progress-bar-animated` CSS class (0.8s cubic-bezier width)
- **Card hover lift**: `.card-hover` CSS class (0.2s ease transform + box-shadow)
- **AMQS pulse**: `.amqs-highlight` CSS animation (2s, single-fire)
- **FAB press**: `.fab-shadow:active` CSS (scale 0.95, instant)

---

### 23.12 Key Interaction Behaviours

| User action | Result |
|---|---|
| Tap PRFMR logo | Navigate to /dashboard |
| Tap date ← / → in Dashboard | Shifts `selectedDate` by ±1 day; all data queries refresh |
| Tap AMQS mini-CTA row | Navigate to /micronutrients |
| Tap "Quick Log" (Sparkles) | Opens `<AILogDialog>` full-screen modal |
| Tap mobile FAB (+ button) | Programmatically clicks `[data-testid="button-add-food"]` to open FoodEntryDialog |
| Tap ⓘ in Daily Intake Estimates | Opens Popover (side=left) explaining goal mode |
| Tap "Review →" on EA row | Opens EA Warning Dialog (sm:max-w-sm) |
| Tap "Review →" on carb row | Opens Carb Warning Dialog |
| Tap supplement item edit | Opens Edit Supplement Dialog pre-filled |
| Tap supplement delete | Inline confirmation then DELETE mutation |
| Tap "Plan Block" / "Edit Block" | Opens `<TrainingBlockModal>` (multi-step Dialog) |
| Tap session time section | Collapsible toggle (open/close) |
| Tap "No session — tap to log" | POST creates new WorkoutSession for that time slot |
| Tap "28-day trend" on training | Navigate to /load-trend |
| Tap "Send Feedback" | Navigate to /feedback |
| Tap "Recalculate Goals" | Opens RecalculateDialog then POST /api/user/me/recalculate |
| Toggle rest day | POST/DELETE /api/me/rest-day/:date; invalidates training-load + morning-status |

---

## 24. Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | Resend email API key |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_EMAIL` | Web Push contact email |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket |
| `PRIVATE_OBJECT_DIR` | Object Storage private path |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Object Storage public path |
| `BETA_USER_LIMIT` | Max active users (default 50, set to 200) |
| `NODE_ENV` | `development` or `production` |
| `VITE_APP_VERSION` | Shown in `/api/meta` |

---

## 25. External Services

### Open Food Facts
- Base URL: `https://world.openfoodfacts.org`
- Endpoint used: `/api/v0/product/{barcode}.json` and `/cgi/search.pl`
- No API key required
- Rate-limit: be gentle; cache results in `off_product_mappings`

### Resend (email)
- Used for: email verification, password reset, invite emails
- SDK: `resend` npm package
- From address: configure in Resend dashboard

### Google OAuth
- Scopes requested: `profile`, `email`
- Callback URL: `{APP_URL}/auth/google/callback`

### Replit Object Storage
- Used for: profile photo uploads, feedback screenshots
- SDK: `@replit/object-storage` (JavaScript SDK)
- Configured via `DEFAULT_OBJECT_STORAGE_BUCKET_ID` env var
- Routes registered in `server/replit_integrations/object_storage.ts`

### Web Push (VAPID)
- Library: `web-push` npm package
- Generate keys: `web-push generate-vapid-keys`
- Service worker must be served at `/sw.js`

---

## Appendix A — `data/ingredients.json` structure

Each entry:
```json
{
  "name": "Chicken breast (cooked)",
  "cookFactor": 0.75,
  "micros": {
    "vitaminC": 0,
    "vitaminD": 0.3,
    "vitaminB12": 0.3,
    "vitaminB6": 0.9,
    "folate": 4,
    "vitaminA": 9,
    "vitaminE": 0.3,
    "vitaminK": 0,
    "iron": 1.0,
    "calcium": 15,
    "magnesium": 29,
    "zinc": 1.9,
    "potassium": 240,
    "sodium": 74,
    "omega3": 0.07,
    "fibre": 0,
    "selenium": 27
  }
}
```
All micro values are per 100g of the ingredient (cooked basis unless `cookFactor` applies).  
There are ~700+ ingredients in the file.

---

## Appendix B — Quick-start replication checklist

- [ ] Set up PostgreSQL database
- [ ] Copy `shared/schema.ts` and run `drizzle-kit push` to create all tables
- [ ] Copy `data/ingredients.json` (micronutrient database)
- [ ] Implement `server/lib/amqs.ts` scoring engine
- [ ] Implement `shared/weight-cut.ts` cut planner
- [ ] Implement `server/lib/energy.ts` MET calorie estimator
- [ ] Implement `server/lib/readiness.ts` composite score
- [ ] Implement `server/lib/fuel-availability.ts` glycogen status
- [ ] Implement `server/lib/training-load.ts` ACWR engine
- [ ] Set up Passport.js (local + Google OAuth)
- [ ] Set up Resend for transactional email
- [ ] Set up web-push VAPID keys
- [ ] Set up Replit Object Storage
- [ ] Seed exercise catalog + activity catalog (with MET values)
- [ ] Seed supplement catalog (with microsPerUnit data)
- [ ] Build all API routes per §16
- [ ] Build mobile UI following design system in §23
- [ ] Configure `BETA_USER_LIMIT` env var

---

*Last updated: 2026-06-01. Generated from PRFMR production codebase.*
