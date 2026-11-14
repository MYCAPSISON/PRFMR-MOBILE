# Native social authentication setup

The mobile client uses the existing PRFMR cookie session. Google and Apple
credentials are exchanged with the API; they are never used as a separate app
session.

## Public mobile configuration

Configure these client identifiers locally in `.env.local` and in the Expo
`production` environment used by the production build:

```text
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<Google OAuth client of type iOS>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google OAuth client of type Web application>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Google OAuth client of type Android, optional until Android ships>
```

OAuth client IDs are public identifiers. Never add `GOOGLE_CLIENT_SECRET`, an
Apple private key, Apple team/key credentials, or another provider secret to
the app or to an `EXPO_PUBLIC_` variable.

The Google iOS client must use bundle ID `link.prfmr.app`. The matching reversed
client ID is configured as `iosUrlScheme` in root `app.json`. If the Google iOS
client changes, update both the environment value and that URL scheme.

The Web client ID is passed as Google's server client ID so the native SDK
returns an ID token for backend verification. The backend must accept the
configured iOS and Web client IDs as token audiences.

For Android, register package `link.prfmr.app` and every signing-certificate
SHA-1 used by development, internal testing, and Play App Signing before
shipping the Android flow.

## Apple configuration

Root `app.json` enables `ios.usesAppleSignIn` and the
`expo-apple-authentication` plugin. Enable **Sign in with Apple** for the
`link.prfmr.app` identifier in the Apple Developer portal and let the native
build regenerate its provisioning profile.

Apple may return name and email only on the first authorization. The client
sends them when present, but the backend identifies accounts by Apple's stable
subject. Apple private-relay email addresses are passed through unchanged.

## Backend contract

```text
POST /api/auth/google/mobile
POST /api/auth/apple/mobile
```

Both requests include `Content-Type: application/json`,
`x-app-mode: standalone`, and credentials. Successful responses must create the
same `connect.sid` cookie session as password login. The current production
routes reject invalid placeholder tokens with HTTP 401.

## Testing

Native Google Sign-In is unavailable in Expo Go. After any client ID, URL
scheme, Apple capability, or native-package change, make a fresh development or
TestFlight build. Test cancellation, new and returning users, Apple relay email,
restore after relaunch, rate limits, account conflicts, and logout on real iOS
hardware before release.
