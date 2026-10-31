import test from "node:test";
import assert from "node:assert/strict";
import { Store, ensureWorkspace } from "../server/store.js";
import {
  startGoogle,
  finishGoogle,
  seal,
  unseal,
  accessToken,
  googleLocations,
  linkGoogleLocation,
  fetchGoogleReviews,
  replyToGoogle,
} from "../server/google.js";
const env = {
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_TOKEN_ENCRYPTION_KEY: "ab".repeat(32),
  APP_ORIGIN: "https://review.example.com",
};
function setup(t) {
  const store = new Store(":memory:");
  t.after(() => store.close());
  ensureWorkspace(store, "workspace-a");
  ensureWorkspace(store, "workspace-b");
  return store;
}
function credentials(
  store,
  tenant = "workspace-a",
  expiresAt = Date.now() + 3600000,
) {
  store.put(
    tenant,
    "google_credentials",
    {
      sealed: seal(
        { accessToken: "access-test", refreshToken: "refresh-test", expiresAt },
        env,
      ),
    },
    "oauth",
  );
}
const row = (id) => ({
  reviewId: id,
  name: `accounts/123/locations/456/reviews/${id}`,
  reviewer: { displayName: "Provider Test" },
  starRating: "FOUR",
  comment: "Real API shape with fictional content.",
  createTime: "2026-10-31T12:00:00.000Z",
});

test("OAuth uses PKCE, state binds to the starting browser, tokens are encrypted and states are single-use", async (t) => {
  const store = setup(t);
  const start = startGoogle(store, "workspace-a", "owner-a", env);
  const url = new URL(start.url);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  let requests = 0;
  const transport = async (_url, options) => {
    requests++;
    assert.equal(options.form.grant_type, "authorization_code");
    assert.ok(options.form.code_verifier);
    return {
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/business.manage",
    };
  };
  await assert.rejects(
    finishGoogle(
      store,
      { state: start.state, code: "test-code" },
      "cd".repeat(32),
      env,
      transport,
    ),
    /did not match/,
  );
  assert.equal(requests, 0);
  await finishGoogle(
    store,
    { state: start.state, code: "test-code" },
    start.state,
    env,
    transport,
  );
  const stored = store.get("workspace-a", "google_credentials", "oauth");
  assert.ok(!stored.sealed.includes("refresh"));
  assert.equal(unseal(stored.sealed, env).refreshToken, "refresh");
  assert.equal(store.get("workspace-b", "google_credentials", "oauth"), null);
  await assert.rejects(
    finishGoogle(
      store,
      { state: start.state, code: "test-code" },
      start.state,
      env,
      transport,
    ),
  );
});
test("authenticated encryption detects altered ciphertext", () => {
  const encrypted = seal({ test: "secret" }, env);
  assert.throws(
    () => unseal(encrypted.slice(0, -2) + "00", env),
    /could not be decrypted/,
  );
});
test("token refresh is shared by concurrent callers and persists rotated refresh credentials", async (t) => {
  const store = setup(t);
  credentials(store, "workspace-a", 1);
  let calls = 0;
  const transport = async (_url, options) => {
    calls++;
    assert.equal(options.form.refresh_token, "refresh-test");
    await new Promise((r) => setTimeout(r, 10));
    return {
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
    };
  };
  assert.deepEqual(
    await Promise.all([
      accessToken(store, "workspace-a", env, transport),
      accessToken(store, "workspace-a", env, transport),
    ]),
    ["new-access", "new-access"],
  );
  assert.equal(calls, 1);
  assert.equal(
    unseal(store.get("workspace-a", "google_credentials", "oauth").sealed, env)
      .refreshToken,
    "new-refresh",
  );
});
test("Google locations are discovered from the token owner, and remote IDs cannot be injected", async (t) => {
  const store = setup(t);
  credentials(store);
  const transport = async (url) =>
    url.includes("accountmanagement")
      ? { accounts: [{ name: "accounts/123" }] }
      : {
          locations: [
            {
              name: "locations/456",
              title: "Fictional test location",
              storefrontAddress: { addressLines: ["Synthetic address"] },
            },
          ],
        };
  const options = await googleLocations(store, "workspace-a", env, transport);
  assert.equal(options[0].remoteId, "accounts/123/locations/456");
  linkGoogleLocation(store, "workspace-a", "main", options[0].remoteId);
  assert.equal(
    store.get("workspace-a", "google_links", "main").remoteId,
    options[0].remoteId,
  );
  assert.throws(
    () =>
      linkGoogleLocation(
        store,
        "workspace-a",
        "main",
        "accounts/999/locations/999",
      ),
    /Select a location/,
  );
  assert.throws(
    () => linkGoogleLocation(store, "workspace-b", "main", options[0].remoteId),
    /Not found/,
  );
});
test("complete multi-page review sync validates resource ownership and retains provider responses", async (t) => {
  const store = setup(t);
  credentials(store);
  store.put(
    "workspace-a",
    "google_links",
    { locationId: "main", remoteId: "accounts/123/locations/456" },
    "main",
  );
  const transport = async (url) =>
    url.includes("pageToken=next")
      ? {
          reviews: [
            { ...row("second"), reviewReply: { comment: "Prior response" } },
          ],
          totalReviewCount: 2,
        }
      : { reviews: [row("first")], nextPageToken: "next", totalReviewCount: 2 };
  const result = await fetchGoogleReviews(
    store,
    "workspace-a",
    "main",
    env,
    transport,
  );
  assert.equal(result.length, 2);
  assert.equal(result[1].reply, "Prior response");
  assert.equal(result[0].rating, 4);
  assert.equal(result[0].publishConsent, false);
  await assert.rejects(
    fetchGoogleReviews(store, "workspace-a", "main", env, async () => ({
      reviews: [
        { ...row("other"), name: "accounts/999/locations/999/reviews/other" },
      ],
      totalReviewCount: 1,
    })),
    /outside the linked location/,
  );
});
test("incomplete or repeated pagination fails without fabricating an empty complete sync", async (t) => {
  const store = setup(t);
  credentials(store);
  store.put(
    "workspace-a",
    "google_links",
    { locationId: "main", remoteId: "accounts/123/locations/456" },
    "main",
  );
  await assert.rejects(
    fetchGoogleReviews(store, "workspace-a", "main", env, async () => ({
      reviews: [],
      totalReviewCount: 5,
    })),
    /incomplete/,
  );
  await assert.rejects(
    fetchGoogleReviews(store, "workspace-a", "main", env, async () => ({
      reviews: [row("first")],
      nextPageToken: "same",
      totalReviewCount: 3,
    })),
    /pagination/,
  );
  await assert.rejects(
    fetchGoogleReviews(store, "workspace-a", "main", env, async () => ({
      reviews: [row("first"), row("first")],
      totalReviewCount: 2,
    })),
    /incomplete/,
  );
});
test("Google replies verify tenant/location ownership and require publication confirmation", async (t) => {
  const store = setup(t);
  credentials(store);
  store.put(
    "workspace-a",
    "google_links",
    { locationId: "main", remoteId: "accounts/123/locations/456" },
    "main",
  );
  const review = {
    externalId: "first",
    locationId: "main",
    remoteName: row("first").name,
  };
  let requests = 0;
  const transport = async (url, options) => {
    requests++;
    assert.equal(options.method, "PUT");
    assert.match(url, /accounts\/123\/locations\/456\/reviews\/first\/reply$/);
    return {
      comment: options.body.comment,
      updateTime: new Date().toISOString(),
    };
  };
  assert.equal(
    (
      await replyToGoogle(
        store,
        "workspace-a",
        review,
        "Thank you",
        env,
        transport,
      )
    ).published,
    true,
  );
  assert.equal(requests, 1);
  await assert.rejects(
    replyToGoogle(store, "workspace-b", review, "Do not send", env, transport),
  );
  await assert.rejects(
    replyToGoogle(
      store,
      "workspace-a",
      { ...review, remoteName: "accounts/999/locations/999/reviews/first" },
      "Do not send",
      env,
      transport,
    ),
    /Reconnect and sync/,
  );
  assert.equal(requests, 1);
  await assert.rejects(
    replyToGoogle(
      store,
      "workspace-a",
      review,
      "No confirmation",
      env,
      async () => ({}),
    ),
    /did not confirm/,
  );
});

test("automatic sync requires a current signed entitlement, respects its schedule, and never imports partial failures", async (t) => {
  const { processSyncJobs } = await import("../server/sync.js");
  const store = setup(t);
  credentials(store);
  store.put(
    "workspace-a",
    "google_links",
    { locationId: "main", remoteId: "accounts/123/locations/456" },
    "main",
  );
  const enabled = { ...env, ALLOW_GOOGLE_SYNC: "true" };
  let calls = 0;
  const transport = async () => {
    calls++;
    return { reviews: [row("worker-review")], totalReviewCount: 1 };
  };
  assert.equal((await processSyncJobs(store, enabled, transport)).synced, 0);
  assert.equal(calls, 0);
  store.put(
    "workspace-a",
    "runtime_entitlements",
    { expiresAt: Date.now() + 3600000, modules: ["reputation"] },
    "canonical",
  );
  assert.equal((await processSyncJobs(store, enabled, transport)).synced, 1);
  assert.equal(store.list("workspace-a", "reviews").length, 1);
  assert.equal((await processSyncJobs(store, enabled, transport)).synced, 0);
  assert.equal(calls, 1);
  store.put(
    "workspace-a",
    "runtime_entitlements",
    { expiresAt: 1, modules: ["reputation"] },
    "canonical",
  );
  assert.equal(
    (await processSyncJobs(store, enabled, transport, Date.now() + 1000000))
      .synced,
    0,
  );
});
