/**
 * scripts/src/seedRevenueCat.ts
 * Creates all RevenueCat entities needed for PRFMR Pro subscriptions.
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seedRevenueCat.ts
 * Idempotent — safe to run multiple times.
 */
import { getUncachableRevenueCatClient, type RevenueCatClient } from "./revenueCatClient.js";

// ─── PRFMR Configuration ────────────────────────────────────────────────────

const PROJECT_NAME = "PRFMR";

const APP_STORE_BUNDLE_ID = "link.prfmr.app";
const PLAY_STORE_PACKAGE_NAME = "link.prfmr.app";

// The existing entitlement in this project uses "PRFMR Pro" as its lookup_key.
// We match on either form so the script is idempotent whether you start fresh
// or resume from an account that already has the entitlement.
const ENTITLEMENT_IDENTIFIER = "PRFMR Pro";
const ENTITLEMENT_DISPLAY_NAME = "PRFMR Pro";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "PRFMR Pro";

const PRODUCTS = [
  {
    identifier: "prfmr_pro_monthly",
    displayName: "PRFMR Pro Monthly",
    title: "PRFMR Pro Monthly",
    duration: "P1M",
    packageIdentifier: "$rc_monthly",
    packageDisplayName: "Monthly",
    prices: [{ amount_micros: 7990000, currency: "USD" }], // $7.99/month
  },
  {
    identifier: "prfmr_pro_annual",
    displayName: "PRFMR Pro Yearly",
    title: "PRFMR Pro Yearly",
    duration: "P1Y",
    packageIdentifier: "$rc_annual",
    packageDisplayName: "Annual",
    prices: [{ amount_micros: 49990000, currency: "USD" }], // $49.99/year
  },
];

// ─── Type helpers ────────────────────────────────────────────────────────────

interface RcProject { id: string; name: string }
interface RcApp { id: string; type: string; name: string }
interface RcProduct { id: string; store_identifier: string; app_id: string }
interface RcEntitlement { id: string; lookup_key: string }
interface RcOffering { id: string; lookup_key: string; is_current: boolean }
interface RcPackage { id: string; lookup_key: string }
interface RcPublicApiKey { key: string }
interface RcList<T> { items: T[] }

function ok<T>(res: { data: T | null; error: unknown }, label: string): T {
  if (res.error || res.data === null) {
    throw new Error(`${label}: ${JSON.stringify(res.error)}`);
  }
  return res.data;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();
  console.log("Connected to RevenueCat API\n");

  // 1. Project ─────────────────────────────────────────────────────────────
  const projectList = ok(
    await client.get<RcList<RcProject>>({
      url: "/v2/projects",
      query: { limit: 20 },
    }),
    "list projects"
  );

  let project = projectList.items.find((p) => p.name === PROJECT_NAME);
  if (project) {
    console.log(`Project already exists: ${project.id}`);
  } else {
    project = ok(
      await client.post<RcProject>({
        url: "/v2/projects",
        body: { name: PROJECT_NAME },
      }),
      "create project"
    );
    console.log(`Created project: ${project.id}`);
  }

  // 2. Apps ─────────────────────────────────────────────────────────────────
  const appList = ok(
    await client.get<RcList<RcApp>>({
      url: "/v2/projects/{project_id}/apps",
      path: { project_id: project.id },
      query: { limit: 20 },
    }),
    "list apps"
  );

  let testApp = appList.items.find((a) => a.type === "test_store");
  let appStoreApp = appList.items.find((a) => a.type === "app_store");
  let playStoreApp = appList.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test_store app found in project");
  console.log(`Test store app:  ${testApp.id}`);

  if (!appStoreApp) {
    appStoreApp = ok(
      await client.post<RcApp>({
        url: "/v2/projects/{project_id}/apps",
        path: { project_id: project.id },
        body: { name: "PRFMR iOS", type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
      }),
      "create App Store app"
    );
    console.log(`Created App Store app: ${appStoreApp.id}`);
  } else {
    console.log(`App Store app:   ${appStoreApp.id}`);
  }

  if (!playStoreApp) {
    playStoreApp = ok(
      await client.post<RcApp>({
        url: "/v2/projects/{project_id}/apps",
        path: { project_id: project.id },
        body: { name: "PRFMR Android", type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
      }),
      "create Play Store app"
    );
    console.log(`Created Play Store app: ${playStoreApp.id}`);
  } else {
    console.log(`Play Store app:  ${playStoreApp.id}`);
  }

  // 3. Products ──────────────────────────────────────────────────────────────
  const productList = ok(
    await client.get<RcList<RcProduct>>({
      url: "/v2/projects/{project_id}/products",
      path: { project_id: project.id },
      query: { limit: 100 },
    }),
    "list products"
  );

  const allProductIds: string[] = [];
  const productIds: Record<string, { test: string; ios: string; android?: string }> = {};

  for (const cfg of PRODUCTS) {
    console.log(`\nSetting up: ${cfg.identifier}`);

    const ensureProduct = async (app: RcApp, storeId: string, isTest: boolean) => {
      const existing = productList.items.find(
        (p) => p.store_identifier === storeId && p.app_id === app.id
      );
      if (existing) {
        console.log(`  ${app.type}: already exists (${existing.id})`);
        return existing;
      }
      const body: Record<string, unknown> = {
        store_identifier: storeId,
        app_id: app.id,
        type: "subscription",
        display_name: cfg.displayName,
      };
      if (isTest) {
        body.subscription = { duration: cfg.duration };
        body.title = cfg.title;
      }
      const created = ok(
        await client.post<RcProduct>({
          url: "/v2/projects/{project_id}/products",
          path: { project_id: project!.id },
          body,
        }),
        `create ${app.type} product`
      );
      console.log(`  ${app.type}: created (${created.id})`);
      return created;
    };

    const testProduct = await ensureProduct(testApp, cfg.identifier, true);
    const iosProduct = await ensureProduct(appStoreApp, cfg.identifier, false);
    // Google Play product/base-plan IDs are not confirmed yet. Never create
    // or attach guessed Android products from this seed script.

    allProductIds.push(testProduct.id, iosProduct.id);
    productIds[cfg.identifier] = {
      test: testProduct.id,
      ios: iosProduct.id,
    };

    // Set test store prices
    const priceRes = await client.post<unknown>({
      url: "/v2/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProduct.id },
      body: { prices: cfg.prices },
    });
    if (priceRes.error) {
      const e = priceRes.error as any;
      if (e?.type === "resource_already_exists") {
        console.log(`  Test store prices already set`);
      } else {
        console.warn(`  Warning: could not set prices: ${JSON.stringify(priceRes.error)}`);
      }
    } else {
      console.log(`  Test store prices set: ${JSON.stringify(cfg.prices)}`);
    }
  }

  // 4. Entitlement ───────────────────────────────────────────────────────────
  console.log("\nSetting up entitlement…");
  const entitlementList = ok(
    await client.get<RcList<RcEntitlement>>({
      url: "/v2/projects/{project_id}/entitlements",
      path: { project_id: project.id },
      query: { limit: 20 },
    }),
    "list entitlements"
  );

  // Match on lookup_key OR display_name to handle pre-existing entitlements
  let entitlement = entitlementList.items?.find(
    (e) => e.lookup_key === ENTITLEMENT_IDENTIFIER || e.display_name === ENTITLEMENT_DISPLAY_NAME
  );
  if (entitlement) {
    console.log(`  Already exists: ${entitlement.id}`);
  } else {
    const createEntRes = await client.post<RcEntitlement>({
      url: "/v2/projects/{project_id}/entitlements",
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (createEntRes.error) {
      const e = createEntRes.error as any;
      if (e?.type === "resource_already_exists") {
        // Already exists — fetch it with a higher limit in case it was paginated out
        const retry = ok(
          await client.get<RcList<RcEntitlement>>({
            url: "/v2/projects/{project_id}/entitlements",
            path: { project_id: project.id },
            query: { limit: 100 },
          }),
          "re-list entitlements"
        );
        entitlement = retry.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
        if (!entitlement) throw new Error("Entitlement exists but could not be found in list");
        console.log(`  Found existing: ${entitlement.id}`);
      } else {
        throw new Error(`create entitlement: ${JSON.stringify(e)}`);
      }
    } else {
      entitlement = createEntRes.data!;
      console.log(`  Created: ${entitlement.id}`);
    }
  }

  const attachEntRes = await client.post<unknown>({
    url: "/v2/projects/{project_id}/entitlements/{entitlement_id}/product_ids",
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntRes.error) {
    const e = attachEntRes.error as any;
    if (e?.type !== "unprocessable_entity_error") {
      console.warn(`  Warning attaching products to entitlement: ${JSON.stringify(e)}`);
    } else {
      console.log("  Products already attached to entitlement");
    }
  } else {
    console.log("  Products attached to entitlement");
  }

  // 5. Offering ──────────────────────────────────────────────────────────────
  console.log("\nSetting up offering…");
  const offeringList = ok(
    await client.get<RcList<RcOffering>>({
      url: "/v2/projects/{project_id}/offerings",
      path: { project_id: project.id },
      query: { limit: 20 },
    }),
    "list offerings"
  );

  let offering = offeringList.items.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (offering) {
    console.log(`  Already exists: ${offering.id}`);
  } else {
    offering = ok(
      await client.post<RcOffering>({
        url: "/v2/projects/{project_id}/offerings",
        path: { project_id: project.id },
        body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
      }),
      "create offering"
    );
    console.log(`  Created: ${offering.id}`);
  }

  if (!offering.is_current) {
    ok(
      await client.patch<RcOffering>({
        url: "/v2/projects/{project_id}/offerings/{offering_id}",
        path: { project_id: project.id, offering_id: offering.id },
        body: { is_current: true },
      }),
      "set offering as current"
    );
    console.log("  Set as current offering");
  }

  // 6. Packages ──────────────────────────────────────────────────────────────
  console.log("\nSetting up packages…");
  const packageList = ok(
    await client.get<RcList<RcPackage>>({
      url: "/v2/projects/{project_id}/offerings/{offering_id}/packages",
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 20 },
    }),
    "list packages"
  );

  for (const cfg of PRODUCTS) {
    const ids = productIds[cfg.identifier];

    let pkg = packageList.items.find((p) => p.lookup_key === cfg.packageIdentifier);
    if (pkg) {
      console.log(`  Package ${cfg.packageIdentifier}: already exists (${pkg.id})`);
    } else {
      pkg = ok(
        await client.post<RcPackage>({
          url: "/v2/projects/{project_id}/offerings/{offering_id}/packages",
          path: { project_id: project.id, offering_id: offering.id },
          body: { lookup_key: cfg.packageIdentifier, display_name: cfg.packageDisplayName },
        }),
        `create package ${cfg.packageIdentifier}`
      );
      console.log(`  Package ${cfg.packageIdentifier}: created (${pkg.id})`);
    }

    const attachPkgRes = await client.post<unknown>({
      url: "/v2/projects/{project_id}/packages/{package_id}/products",
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: ids.test, eligibility_criteria: "all" },
          { product_id: ids.ios, eligibility_criteria: "all" },
          ...(ids.android
            ? [{ product_id: ids.android, eligibility_criteria: "all" }]
            : []),
        ],
      },
    });
    if (attachPkgRes.error) {
      const e = attachPkgRes.error as any;
      const isAlready =
        e?.type === "unprocessable_entity_error" &&
        typeof e?.message === "string" &&
        e.message.includes("Cannot attach product");
      if (!isAlready) {
        console.warn(`  Warning: ${JSON.stringify(e)}`);
      } else {
        console.log(`  Package ${cfg.packageIdentifier}: products already attached`);
      }
    } else {
      console.log(`  Package ${cfg.packageIdentifier}: products attached`);
    }
  }

  // 7. Fetch API keys ────────────────────────────────────────────────────────
  console.log("\nFetching API keys…");
  const [testKeys, iosKeys, androidKeys] = await Promise.all([
    client.get<RcList<RcPublicApiKey>>({
      url: "/v2/projects/{project_id}/apps/{app_id}/api_keys/public",
      path: { project_id: project.id, app_id: testApp.id },
    }),
    client.get<RcList<RcPublicApiKey>>({
      url: "/v2/projects/{project_id}/apps/{app_id}/api_keys/public",
      path: { project_id: project.id, app_id: appStoreApp.id },
    }),
    client.get<RcList<RcPublicApiKey>>({
      url: "/v2/projects/{project_id}/apps/{app_id}/api_keys/public",
      path: { project_id: project.id, app_id: playStoreApp.id },
    }),
  ]);

  const testKey = testKeys.data?.items?.[0]?.key ?? "N/A";
  const iosKey = iosKeys.data?.items?.[0]?.key ?? "N/A";
  const androidKey = androidKeys.data?.items?.[0]?.key ?? "N/A";

  const SEP = "=".repeat(62);
  console.log(`\n${SEP}`);
  console.log("PRFMR RevenueCat setup complete!");
  console.log(SEP);
  console.log("Project ID:              ", project.id);
  console.log("Test Store App ID:       ", testApp.id);
  console.log("App Store App ID:        ", appStoreApp.id);
  console.log("Play Store App ID:       ", playStoreApp.id);
  console.log("Entitlement Identifier:  ", ENTITLEMENT_IDENTIFIER);
  console.log(`\nEnvironment variables — copy these into your secrets:\n`);
  console.log(`  REVENUECAT_PROJECT_ID                  = ${project.id}`);
  console.log(`  REVENUECAT_TEST_STORE_APP_ID           = ${testApp.id}`);
  console.log(`  REVENUECAT_APPLE_APP_STORE_APP_ID      = ${appStoreApp.id}`);
  console.log(`  REVENUECAT_GOOGLE_PLAY_STORE_APP_ID    = ${playStoreApp.id}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY    = ${testKey}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY     = ${iosKey}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = ${androidKey}`);
  console.log(SEP + "\n");
}

seedRevenueCat().catch((err) => {
  console.error("Seed failed:", err?.message ?? err);
  process.exit(1);
});
