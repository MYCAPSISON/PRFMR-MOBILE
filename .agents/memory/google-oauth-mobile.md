---
name: Google OAuth Mobile Flow
description: How native Google OAuth is implemented in the PRFMR Expo app and what server-side setup is required to complete it.
---

## Implementation (mobile side)
- Uses `expo-auth-session/providers/google` (`Google.useAuthRequest`) — **NOT** `WebBrowser.openBrowserAsync` (that opens the web app's browser)
- `WebBrowser.maybeCompleteAuthSession()` called at module level in login.tsx
- After user completes native Google sheet, `response.authentication.idToken` is sent via XHR to `POST /api/auth/google/mobile`
- `loginWithGoogleToken(idToken)` in `lib/api.ts` handles the XHR call and captures Set-Cookie headers (same pattern as `loginWithXhr`)

## Required env vars (set in Replit Secrets / .env)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — iOS OAuth 2.0 client from Google Cloud Console
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — Android OAuth 2.0 client
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — web client (same `GOOGLE_CLIENT_ID` used by server)

## Required server-side change (app.prfmr.link)
Add `POST /api/auth/google/mobile` per §29.12.2 of the replication guide:
- Body: `{ idToken: string }`
- Server verifies idToken via `https://oauth2.googleapis.com/tokeninfo?id_token=TOKEN`
- Runs same account-merge logic as web Google strategy
- Returns session cookie (Set-Cookie: connect.sid)

## Google Cloud Console setup
- Add iOS Bundle ID → generates `iosClientId`
- Add Android package + SHA-1 → generates `androidClientId`
- Add `https://auth.expo.io/@<username>/prfmr` to Authorised redirect URIs

**Why:** `openBrowserAsync` opens the PRFMR web app in a browser (cookies not shared with RN fetch). Native `expo-auth-session` flow gets the idToken in-process, avoids the browser entirely.
