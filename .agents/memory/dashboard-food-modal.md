---
name: Dashboard food modal
description: The Dashboard (index.tsx) has its own Add Food modal with its own CORE_FOODS array, completely separate from nutrition.tsx's WholeFoodTab.
---

## Rule
When users tap "+ Add Food" on the Dashboard, it opens the modal defined in `index.tsx`, NOT the one in `nutrition.tsx`. Any changes to whole food lists must be made to `CORE_FOODS` in `index.tsx`.

**Why:** There are two separate Add Food modals — one in the Dashboard (index.tsx) and one in the Nutrition tab (nutrition.tsx). The Dashboard one is what most users encounter first. Previous debugging sessions wasted time editing nutrition.tsx when the user was always opening index.tsx's modal.

**How to apply:** Before editing WholeFoodTab code, grep for "Filter foods" or "CORE_FOODS" to confirm which file the user is looking at. Dashboard modal uses "Filter foods…" placeholder; nutrition.tsx uses "Search whole foods…".
