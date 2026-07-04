---
name: PRFMR onboarding 500 debugging
description: Debugging a persistent HTTP 500 from POST /user/me/onboard on the PRFMR production backend during the mobile onboarding wizard.
---

The production backend server (`https://app.prfmr.link/api`) is not in this repo — it cannot be
inspected or patched directly. It exposes no useful error detail to the client (`"Onboarding
failed"` for every cause, no `issues` field), so guessing from the error message alone is a dead
end.

**Definitive root cause:** `surveyEnergyScore` must be sent as a **number**, not a string. The
written spec docs claim it's an optional string, but the live server rejects/crashes on a string
value for this field and accepts a number. The client was doing `String(d.surveyEnergyScore)`,
which silently turned a valid number into a value that 500'd every time.

Two other invalid enum values were also found and fixed along the way in the same payload
(`activityLevel: "moderately_active"` → `"moderate"`; `gender` being dropped as `undefined` when
the user picked "Other"/"Prefer not to say" — now defaults to `"male"`). Neither of those alone
explained the failure; only the `surveyEnergyScore` type mismatch was the actual trigger.

**Why this matters:** the written API spec doc for this project is not fully trustworthy on field
*types* — it got `surveyEnergyScore`'s type wrong. Don't treat the doc as ground truth when a
field keeps failing after matching it exactly; verify against the live server instead.

**How to apply:** when the client payload matches spec exactly but the server still 500s with no
detail, and you have credentials, hit the real endpoint directly with curl and **bisect the
payload field-by-field** (start from only the required fields — confirm 200 — then add fields back
one at a time) rather than re-reading the docs again. This isolates the exact field/type in a few
requests instead of guessing indefinitely.
