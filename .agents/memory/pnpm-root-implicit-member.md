---
name: pnpm root project is an implicit workspace member
description: Root package.json (next to pnpm-workspace.yaml) is treated as a workspace package even though it's not matched by the "packages" globs — watch for name collisions and overly broad tsconfig includes there.
---

In a pnpm workspace, the directory containing `pnpm-workspace.yaml` is always an implicit
workspace project, in addition to whatever the `packages:` globs match. This is easy to miss
when a repo also keeps a legacy/root-level copy of an app that has since moved into
`artifacts/<name>` or similar.

**Why:** Confirmed via `pnpm -r list --depth -1` showing both the root package.json and an
`artifacts/*` package resolving under the exact same `name` field. Duplicate names across
workspace members are ambiguous for `pnpm --filter <name>` and other name-based tooling, even
if one call happened to resolve to the expected package.

**How to apply:** When merging a legacy root-level app back in from (or keeping it in sync
with) an `artifacts/*` package, give the root package.json a distinct `name` (e.g. drop the
`@workspace/` prefix) so it can never collide with the real workspace member. Also check the
root's own `tsconfig.json` — if `include` uses a broad glob like `**/*.ts` with no `exclude`,
`tsc` run from that root will pull in every other package in the monorepo (artifacts/*, lib/*),
producing a wall of unrelated errors. Add an explicit `exclude` for sibling directories
(`artifacts`, `lib`, `scripts`, `node_modules`, etc.) to scope the check correctly.
