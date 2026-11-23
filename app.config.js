const appConfig = require("./app.json");

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...appConfig.expo.extra,
    ...config.extra,
    posthogProjectToken: process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  },
});
