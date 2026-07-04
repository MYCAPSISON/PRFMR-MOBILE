---
name: AMQS ingredient source tracking
description: Any food-logging surface must use the canonical ingredients-data.ts dataset and set ingredientIndex, or logged food silently contributes zero micronutrients to AMQS.
---

## Rule
Every food-entry surface (dashboard modal, nutrition tab, quick-log, barcode, custom) must resolve matched foods against the single canonical dataset (`ingredients-data.ts` / `INGREDIENTS_DATA`) and pass the resulting `ingredientIndex` through to the POST /food payload, setting `sourceType`, `macroSource`, and `microSource` to `"ingredient"` when matched.

**Why:** A duplicate, smaller ingredient dataset (`whole-foods-data.ts`) existed with no `ingredientIndex` field. One food-logging surface used it instead of the canonical dataset, so foods logged there always got `microSource: "none"` and silently never contributed to the AMQS micronutrient score — no error, just permanently degraded scores for anyone using that entry point.

**How to apply:** When adding or auditing any new food-logging surface, grep for `INGREDIENTS_DATA` and `ingredientIndex` to confirm it reuses the canonical dataset rather than a local/duplicate list. Never let two separate "whole food" datasets exist in the mobile app.
