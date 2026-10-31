import { randomUUID } from "node:crypto";
import { fetchGoogleReviews, googleConfigured } from "./google.js";
import { importReviews } from "./domain.js";
import { requestJson } from "./network.js";

// Automatic reads require a still-valid, issuer-signed module entitlement.
// No browser query flag or checkout redirect can enable this worker.
export async function processSyncJobs(
  store,
  env,
  transport = requestJson,
  now = Date.now(),
) {
  if (env.ALLOW_GOOGLE_SYNC !== "true" || !googleConfigured(env))
    return { synced: 0, failed: 0, blocked: true };
  const interval =
    Math.max(300, Number(env.GOOGLE_SYNC_INTERVAL_SECONDS) || 900) * 1000;
  const credentials = store.db
    .prepare(
      "SELECT tenant FROM records WHERE kind='google_credentials' AND id='oauth'",
    )
    .all();
  let synced = 0,
    failed = 0;
  for (const { tenant } of credentials) {
    const grant = store.get(tenant, "runtime_entitlements", "canonical");
    if (
      !grant ||
      grant.expiresAt <= now ||
      !grant.modules.includes("reputation")
    )
      continue;
    for (const link of store.list(tenant, "google_links")) {
      if (synced + failed >= 5) return { synced, failed };
      const owner = randomUUID();
      const claimed = store.transaction(() => {
        const job = store.get(tenant, "sync_jobs", link.locationId);
        if (job && (job.leaseUntil > now || job.lastAttemptAt > now - interval))
          return false;
        store.put(
          tenant,
          "sync_jobs",
          { lastAttemptAt: now, leaseUntil: now + 1800000, owner },
          link.locationId,
        );
        return true;
      });
      if (!claimed) continue;
      try {
        const items = await fetchGoogleReviews(
          store,
          tenant,
          link.locationId,
          env,
          transport,
        );
        const current = store.get(tenant, "runtime_entitlements", "canonical");
        if (
          !current ||
          current.expiresAt <= Date.now() ||
          !current.modules.includes("reputation")
        )
          throw new Error("Entitlement expired during sync");
        importReviews(store, tenant, "google", link.locationId, items);
        store.put(
          tenant,
          "integrations",
          { status: "connected", lastSyncAt: new Date().toISOString() },
          "google",
        );
        synced++;
      } catch {
        const previous = store.get(tenant, "integrations", "google") || {};
        store.put(
          tenant,
          "integrations",
          { ...previous, status: "needs_attention" },
          "google",
        );
        failed++;
      } finally {
        const job = store.get(tenant, "sync_jobs", link.locationId);
        if (job?.owner === owner)
          store.put(
            tenant,
            "sync_jobs",
            { ...job, leaseUntil: 0 },
            link.locationId,
          );
      }
    }
  }
  return { synced, failed };
}
