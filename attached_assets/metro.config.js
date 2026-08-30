const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Ensure Metro can resolve packages installed in the mobile artifact workspace
// (react-native-purchases, react-native-purchases-ui live there)
config.resolver = config.resolver ?? {};
config.resolver.nodeModulesPaths = [
  path.join(__dirname, "node_modules"),
  path.join(__dirname, "artifacts/prfmr-mobile/node_modules"),
];

// Exclude Replit-internal directories from Metro's file watcher.
// Metro walks the whole workspace root; Replit's skill/agent dirs get
// renamed or deleted at runtime, which causes ENOENT crashes in the watcher.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const localDir = escapeRegex(path.join(__dirname, ".local"));
const agentsDir = escapeRegex(path.join(__dirname, ".agents"));

// Also exclude RevenueCat purchases-js temp directories which get deleted at runtime
const rcPurchasesJs = escapeRegex(
  path.join(__dirname, "node_modules/.pnpm/@revenuecat+purchases-js")
);

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
    new RegExp(`^${rcPurchasesJs}.*_tmp_`),
  ],
};

module.exports = config;
