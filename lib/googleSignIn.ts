import Constants, { ExecutionEnvironment } from "expo-constants";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

let cachedModule: GoogleSignInModule | null | undefined;

/**
 * Expo Go does not ship RNGoogleSignin. Loading the package there throws at
 * module evaluation time and prevents the entire auth screen from rendering.
 * Standalone, preview and development-client builds include the config plugin
 * and can safely load the native module.
 */
export function getGoogleSignInModule(): GoogleSignInModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cachedModule = null;
    return cachedModule;
  }

  try {
    cachedModule = require("@react-native-google-signin/google-signin") as GoogleSignInModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}
