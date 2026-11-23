import Constants from "expo-constants";
import PostHog from "posthog-react-native";

type PostHogExtra = {
  posthogProjectToken?: string;
  posthogHost?: string;
};

const posthogExtra = Constants.expoConfig?.extra as PostHogExtra | undefined;
const projectToken = posthogExtra?.posthogProjectToken;
const host = posthogExtra?.posthogHost;

if (!projectToken && __DEV__) {
  console.error(
    "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (!host && __DEV__) {
  console.error(
    "EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_HOST is configured",
  );
}

export const posthog = projectToken && host
  ? new PostHog(projectToken, {
      host,
      logs: {
        serviceName: "prfmr-mobile",
        serviceVersion: Constants.expoConfig?.version,
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
        },
      },
    })
  : undefined;

export const posthogLog = {
  info(message: string, attributes?: Record<string, string | boolean>) {
    posthog?.logger.info(message, attributes);
  },
};
