# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### PRFMR Mobile (`artifacts/prfmr-mobile`)
- **Type**: Expo (React Native) mobile app
- **Preview path**: `/`
- **Stack**: Expo SDK 54, Expo Router, React Query, expo-secure-store
- **Design**: Dark premium UI (#0f1117 background, #ff7a00 orange accent), exact match to web app
- **Auth**: Session-based auth via API cookies stored in SecureStore. Login: `POST /api/auth/login { identifier, password }`
- **Tabs**: Dashboard (index), Training, Supplements (My Supplements), Playbook, Profile, Feedback (6 tabs)
- **API**: Connects to production backend at `EXPO_PUBLIC_API_URL=https://app.prfmr.link/api`
- **Key API calls**:
  - Sleep: `PUT /me/sleep/:date { hoursSlept, sleepQuality }`
  - Weight: `POST /weights { date, weight }` (NOT /me/body-composition)
  - Rest day: `POST/DELETE /me/rest-day/:date`
  - Morning status: `GET /me/morning-status/:date`
  - Provisional check-in: `POST /me/provisional-checkin`
  - Targets: `GET /me/targets/effective?date=`
  - Sessions: `GET /workouts/sessions?start=&end=`, `POST /workouts/sessions { date, timeOfDay }`
  - Activities: `POST /workouts/sessions/:id/activities { activityId, name, duration, rpe }`
- **Key files**:
  - `context/AuthContext.tsx` — session auth state
  - `lib/api.ts` — fetch wrapper with cookie session management
  - `app/(auth)/login.tsx`, `signup.tsx` — auth screens
  - `app/(tabs)/index.tsx` — Dashboard (Fight Camp Hero, Morning Check-In, ProvisionalCheckIn, Macros, Supplements, Training, Meals, Weight Trend)
  - `app/(tabs)/training.tsx` — Time-of-day sessions (Morning/Afternoon/Evening), Add Activity modal
  - `app/(tabs)/supplements.tsx` — Supplement management (CRUD)
  - `app/(tabs)/profile.tsx` — Metrics, Targets, Fight Camp status, Sign out
  - `app/(tabs)/feedback.tsx` — Beta feedback form

### API Server (`artifacts/api-server`)
- **Type**: Express API server
- **Preview path**: `/api`
- CORS configured with `origin: true, credentials: true` for Expo web compatibility
