const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude Replit-internal directories from Metro's file watcher.
// Metro walks the whole workspace root; Replit's skill/agent dirs get
// renamed or deleted at runtime, which causes ENOENT crashes in the watcher.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const localDir = escapeRegex(path.join(__dirname, ".local"));
const agentsDir = escapeRegex(path.join(__dirname, ".agents"));

const existing = config.resolver?.blockList;
const existingList = Array.isArray(existing)
  ? existing
  : existing
  ? [existing]
  : [];

config.resolver = {
  ...(config.resolver ?? {}),
  blockList: [
    ...existingList,
    new RegExp(`^${localDir}[/\\\\]`),
    new RegExp(`^${agentsDir}[/\\\\]`),
  ],
};

module.exports = config;
