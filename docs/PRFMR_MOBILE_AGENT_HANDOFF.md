# PRFMR Mobile Agent Handoff

## Source of truth

The authoritative Expo project is the repository root. Use the root `app.json`,
`package.json`, `pnpm-lock.yaml`, `eas.json`, and the root `app/`, `components/`,
`context/`, `lib/`, and `assets/` directories for native builds and app changes.

There is no dynamic Expo configuration. Do not add `app.config.ts`,
`app.config.js`, or another `app.config.*`; keep Expo configuration static in
`app.json`. Keep `eas.json` separate because it contains build profiles rather
than application configuration.

## Artifact copies

`artifacts/prfmr-mobile` is an artifact launcher/infrastructure wrapper, not the
authoritative source tree. Its `app.json` and dependency declarations may be
stale. Do not use or edit them to fix the native app, and do not copy their
settings into the root. Do not delete the wrapper because it registers the
mobile artifact. `artifacts/api-server` is backend infrastructure, while
`artifacts/mockup-sandbox` is only a design preview service.

## Development and verification

Run commands from the repository root:

```bash
pnpm install
pnpm start
pnpm exec expo config --type public --json
pnpm run typecheck
```

Do not start a second Expo process when one is already managed by a hosting
workflow. An Expo preview is an `exp://` native bundle; an HTTP `GET /` response
is not a valid native-app test.

The production client receives API and optional integration configuration from
environment variables. Never hardcode, print, commit, or paste Apple, OAuth,
RevenueCat, database, session, or other secret values.

## Native configuration

The intended native configuration is:

- Expo SDK 54
- iOS bundle identifier `link.prfmr.app` (never change this)
- Expo project ID `c0dd9973-ac0f-4999-8adf-7b516aadf4e6`
- New Architecture disabled
- JavaScriptCore selected instead of Hermes
- Root `app.json` is the only authoritative Expo configuration

Any native dependency, architecture, engine, plugin, entitlement, or permission
change requires a fresh native build. It cannot be delivered by a JavaScript-only
update.

## Crash history

Build 5 and build 6 had different crash signatures:

- Build 5 crashed on the TurboModule manager queue while converting an
  Objective-C exception to a JavaScript error.
- Build 6 crashed shortly after launch in Hermes stack/error handling and
  garbage collection.

Startup-sensitive native integrations must be initialized only after auth
restoration, must be guarded, and must not run as an unhandled root-module side
effect. Dynamically load notification code when needed. Observe splash-screen
promises. The final error fallback must not access `Error.stack`.

For every genuinely new TestFlight build, verify the App Store Connect build
number and crash metadata. If it crashes, compare the build version, timestamp,
launch interval, faulting thread/address, engine/framework names, and executable
UUIDs. Do not assume a changed JavaScript bundle means a fresh native executable.

## Publishing

Before publishing:

1. Verify changes in the repository root.
2. Confirm `app.json`, `package.json`, and `pnpm-lock.yaml` contain the intended
   native configuration and dependency versions.
3. Restart Expo after native configuration changes and confirm Metro starts.
4. Keep the bundle ID `link.prfmr.app`.
5. Keep secrets out of chat, logs, notes, and source control.
6. Create a fresh iOS production build using the publishing environment tied to
   this Expo project and authenticate Apple/Expo only through its secure UI or
   local credential flow.

After upload, use App Store Connect → PRFMR → TestFlight, wait for processing,
complete export-compliance questions, and confirm the build number is newer than
build 6. Public release also requires metadata, screenshots, age rating, privacy
details, review information, build selection, and Apple review.

## Invariants

- Root `app.json` is authoritative.
- Keep root `eas.json`.
- Do not create dynamic Expo config.
- Never change `link.prfmr.app`.
- Never build from `artifacts/prfmr-mobile/app.json`.
- Never expose environment secrets.
- Always create a fresh native build after native dependency or engine changes.
