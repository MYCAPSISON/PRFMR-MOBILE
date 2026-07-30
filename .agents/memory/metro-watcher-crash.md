---
name: Metro watcher crash fix
description: Metro's FallbackWatcher crashes with ENOENT when Replit renames or deletes skill/agent directories that Metro has already started watching.
---

## The problem
Metro walks the entire workspace root on startup and registers file watchers for every directory it finds, including `.local/skills/` and `.agents/`. When Replit's platform renames or removes a skill directory at runtime (e.g. `.old-clerk-auth-...`), the outstanding `fs.watch()` call throws `ENOENT`, crashing the Metro process.

## The fix
Add a `blockList` to `metro.config.js` that excludes `.local` and `.agents` from Metro's resolver/watcher:

```js
const localDir = escapeRegex(path.join(__dirname, ".local"));
const agentsDir = escapeRegex(path.join(__dirname, ".agents"));
config.resolver.blockList = [
  ...existingList,
  new RegExp(`^${localDir}[/\\\\]`),
  new RegExp(`^${agentsDir}[/\\\\]`),
];
```

**Why:** Metro does not need to watch Replit-internal tooling directories. Blocking them prevents any future ENOENT crash if Replit adds/removes/renames files under those paths.

**How to apply:** Any time Metro crashes with `ENOENT` on a `.local/` or `.agents/` path, confirm `metro.config.js` has this blockList. The fix is already in place at the workspace root.
