---
name: ShareCard ViewShot image rendering
description: How to make bundled PNG assets render reliably in off-screen react-native-view-shot captures
---

## The rule
Call `Asset.loadAsync(require('...'))` at module import time in the file that owns the ViewShot capture (e.g. FcModal.native.tsx). This puts the asset in the native image cache before any capture runs. Then use a normal `<Image source={require('...')} />` in the ShareCard — it will render correctly.

**Why:** React Native can skip painting `<Image>` components that are positioned off-screen (`left: -9999`). `Asset.loadAsync` forces the native layer to resolve and cache the asset synchronously at startup, so it's ready when ViewShot fires regardless of paint timing.

**How to apply:** In any modal or screen that owns a ViewShot of a hidden card, add at module scope:
```ts
import { Asset } from "expo-asset";
Asset.loadAsync(require("../assets/logo-main.png")).catch(() => {});
```
Then keep a 350–600 ms `setTimeout` before `capture()` to let layout settle.

## What NOT to do
- Do not shrink the logo to icon size (22×22) — logo-main.png is a wide 3:1 asset, render at 108×36.
- Do not reconstruct the logo in View/Text as a workaround — the PNG preload approach is reliable and preserves the real brand mark.
- Do not rely on `Image.resolveAssetSource()` alone — that resolves the URI but doesn't guarantee the native image cache has loaded it before capture.
