---
name: AMQS ingredient source tracking + barcode fallback
description: Any food-logging surface must use the canonical ingredients-data.ts dataset and set ingredientIndex, or logged food silently contributes zero micronutrients to AMQS. Barcode lookup has a direct OFF fallback.
---

## Rule 1 — Ingredient dataset
Every food-entry surface (dashboard modal, nutrition tab, quick-log, barcode, custom) must resolve matched foods against the single canonical dataset (`ingredients-data.ts` / `INGREDIENTS_DATA`) and pass the resulting `ingredientIndex` through to the POST /food payload, setting `sourceType`, `macroSource`, and `microSource` to `"ingredient"` when matched.

**Why:** A duplicate, smaller ingredient dataset (`whole-foods-data.ts`) existed with no `ingredientIndex` field. One food-logging surface used it instead of the canonical dataset, so foods logged there always got `microSource: "none"` and silently never contributed to the AMQS micronutrient score — no error, just permanently degraded scores for anyone using that entry point.

**How to apply:** When adding or auditing any new food-logging surface, grep for `INGREDIENTS_DATA` and `ingredientIndex` to confirm it reuses the canonical dataset rather than a local/duplicate list. Never let two separate "whole food" datasets exist in the mobile app.

## Rule 2 — Barcode lookup fallback
The production backend's `/food/barcode/:code` endpoint may return empty/no result for valid barcodes that exist in Open Food Facts (OFF). The mobile `lookupBarcode()` function must fall back to calling OFF directly:
`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`

**Why:** Production backend barcode mapping table (`off_product_mappings`) won't have every product. Calling OFF directly gives much broader coverage. OFF response: `{ status: 1, product: { product_name, nutriments: { "energy-kcal_100g", proteins_100g, carbohydrates_100g, fat_100g, fiber_100g } } }`.

**How to apply:** In `lookupBarcode()`, try the backend first. If result is falsy or has no `name`/`product_name`, call OFF directly and construct a `NormalizedFood` from the OFF response. Set `sourceType: "off"` and `offBarcode: code` on the result.
