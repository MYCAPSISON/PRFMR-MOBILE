---
name: Onboarding spec
description: Key facts about the PRFMR onboarding wizard implementation (steps, assets, API).
---

## Step map (TOTAL = 34, internal steps 0–33)
- 0: Splash — full-screen image, transparent Pressable overlay on baked-in button
  - Overlay position (image-relative): bottom=1.8%, height=5.7%, left/right=2.3%
  - Splash image: `assets/onboarding-splash.jpeg` (863×1665 aspect ratio)
  - `resizeMode="stretch"` + explicit width/height (not "fill" — not valid in RN)
- 1: Problem Statement ("Be honest.")
- 2: Solution ("This is where it changes.")
- 3: First Name
- 4: Sport selection (2-col photo grid, Pexels URLs + local wrestling-action.jpg)
- 5: Competition level + sport badge preview
- 6: Age (min 15)
- 7: Gender (male/female/other/prefer_not)
- 8: Height (min 100 cm)
- 9: Current weight (> 30 kg)
- 10–15: Survey questions (cut exp, cut outcome, calorie knowledge, underfueling, load tracking, micro knowledge)
- 16: Bombshell stats (no gate, no back)
- 17: Aspiration (CTA label = "Let's build your plan →")
- 18: Energy score slider (1–10)
- 19: Performance
- 20: Problems multi-select (checkBox variant)
- 21: Reflection (mirrors step 20 selections)
- 22: Fight camp planner (target weight + fight date + timing + nonFightPrepMode pills)
- 23: Projected cut chart — SKIPPED if nonFightPrepMode set (step 22 "Next" jumps to 24)
- 24: Morning check-in demo (sleep ticks + energy emojis + readiness score)
- 25: Food log demo (4 tab cards, no real API)
- 26: First win
- 27: Star rating (gate: > 0 stars) — CTA label "Next →"
- 28: Body fat % (optional) — CTA label "Build my plan →"
- **29: Loading — submission fires here via useEffect, auto-advances to 30 on success**
- 30: Plan result — CTA "Continue →"
- 31: Commitment level — CTA "Continue →"
- 32: Motivational push (conditional on commitment) — CTA "Continue →"
- 33: Final snapshot — CTA "Start tracking →" → router.replace("/(tabs)")

## API payload (`POST /user/me/onboard`)
- Required: gender, age (int), height (float), currentWeight (float), activityLevel (defaults to "moderately_active"), goal
- goal derived from: nonFightPrepMode || (fightDate set ? "fat_loss" : "fat_loss")
- experienceLevel mapped: "pro" → "advanced", "semi/inter" → "intermediate", else → "beginner"
- bodyFatPct sent as decimal (e.g. 14% → 0.14)
- activityLevel NOT in any step — hardcoded to "moderately_active"

## Assets
- Sport icons: assets/boxing.png, mma.png, muay-thai.png, kickboxing.png, bjj.png, wrestling.png, traditional.png
- Sport icon tintColor="#fff" opacity=0.9 for white rendering
- Wrestling photo: assets/wrestling-action.jpg (local)
- Other sport photos: Pexels URLs
- Logo: assets/logo-main.png (height 34, left-aligned, 20px padding)

## Global shell styling
- Background: #0a0a0a
- Progress bar: 1px tall, rgba(255,255,255,0.05) track, #F97316 fill
- OptionBtn unselected: rgba(39,39,42,0.6); selected: rgba(249,115,22,0.15) + border rgba(249,115,22,0.5)
- Back button hidden on steps ≤ 1 and step 29
