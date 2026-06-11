---
name: React Compiler disable
description: How to properly disable React Compiler in this Expo project.
---

## Rule
To disable React Compiler, set `"reactCompiler": false` in `app.json` under `experiments`. Changing `babel.config.js` or removing `babel-plugin-react-compiler` is NOT sufficient — `app.json` takes priority.

**Why:** Expo SDK 54 reads `experiments.reactCompiler` from app.json and enables/disables the compiler at the Metro/Babel pipeline level, overriding any babel.config.js settings.

**How to apply:** Always check `app.json` `experiments` block first when React Compiler behavior is unexpected. The correct setting is `"experiments": { "typedRoutes": true, "reactCompiler": false }`.
