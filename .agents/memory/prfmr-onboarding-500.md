---
name: PRFMR onboarding 500 debugging
description: Debugging a persistent HTTP 500 from POST /user/me/onboard on the PRFMR production backend during the mobile onboarding wizard.
---

The production backend server (`https://app.prfmr.link/api`) is not in this repo — it cannot be
inspected or patched directly. It exposes no useful error detail to the client (`"Onboarding
failed"` for every cause), so root-causing 500s must be done by diffing the exact client payload
against the documented Zod schema, not from the error message.

Two separate causes were found and fixed in the same payload, uncovered one at a time:

1. `activityLevel` sent as `"moderately_active"` instead of the actual enum value `"moderate"`.
2. `gender` sent as `undefined` (dropped by `JSON.stringify`) whenever the user picked "Other" or
   "Prefer not to say" in the gender step. `gender` is a **required** enum (`"male"|"female"`)
   server-side with no sanitisation default (unlike age/height/weight, which the server defaults
   to 25/170/70 if null/NaN) — omitting it is a strong candidate for an unhandled exception / 500
   rather than a clean 400.

**Why this matters:** fixing the first obviously-wrong enum value does not guarantee the 500 is
resolved — there can be more than one invalid/missing field in the same payload. Audit *every*
enum/required field against the spec table before declaring the bug fixed, not just the first one
found.

**How to apply:** when debugging opaque 500s against an external/production API with a documented
request schema, build a field-by-field checklist (required vs optional, exact enum values, type)
and verify the actual client payload against all of it — don't stop at the first mismatch.
