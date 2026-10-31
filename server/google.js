import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { fail, required, reviewSchema } from "./domain.js";
const scope = "https://www.googleapis.com/auth/business.manage";
const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
function key(env) {
  if (!/^[a-f0-9]{64}$/i.test(env.GOOGLE_TOKEN_ENCRYPTION_KEY || ""))
    fail(503, "Google token encryption is not configured.");
  return Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY, "hex");
}
export function seal(value, env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(env), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(".");
}
export function unseal(value, env) {
  try {
    const [iv, tag, data] = value.split(".");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(env),
      Buffer.from(iv, "hex"),
    );
    cipher.setAuthTag(Buffer.from(tag, "hex"));
    return JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(data, "hex")),
        cipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    fail(
      503,
      "Google credentials could not be decrypted. Reconnect the provider.",
    );
  }
}
export function googleConfigured(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    /^[a-f0-9]{64}$/i.test(env.GOOGLE_TOKEN_ENCRYPTION_KEY || "") &&
    env.APP_ORIGIN,
  );
}
export function startGoogle(store, tenant, userId, env) {
  if (!googleConfigured(env))
    fail(503, "Google OAuth and token encryption need server configuration.");
  const state = randomBytes(32).toString("hex"),
    verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  // Store a one-way state identifier. The independent HttpOnly browser cookie binds
  // the callback to the browser that started authorization.
  const id = createHash("sha256").update(state).digest("hex");
  store.put(
    tenant,
    "oauth",
    { userId, verifier: seal(verifier, env), expiresAt: Date.now() + 600000 },
    id,
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [k, v] of Object.entries({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.APP_ORIGIN + "/api/oauth/google/callback",
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }))
    url.searchParams.set(k, v);
  return { url: url.href, state };
}
export async function finishGoogle(store, query, cookieState, env, transport) {
  if (
    typeof query.state !== "string" ||
    typeof cookieState !== "string" ||
    !/^[a-f0-9]{64}$/.test(query.state) ||
    cookieState.length !== query.state.length ||
    !timingSafeEqual(Buffer.from(query.state), Buffer.from(cookieState))
  )
    fail(400, "Google authorization state did not match this browser.");
  const id = createHash("sha256").update(query.state).digest("hex");
  const row = store.db
    .prepare("SELECT tenant FROM records WHERE kind='oauth' AND id=?")
    .get(id);
  required(row);
  const state = required(store.get(row.tenant, "oauth", id));
  store.delete(row.tenant, "oauth", id);
  if (state.expiresAt < Date.now())
    fail(400, "Google authorization expired. Please reconnect.");
  if (query.error || typeof query.code !== "string")
    fail(400, "Google authorization was not completed.");
  const tokens = await transport("https://oauth2.googleapis.com/token", {
    method: "POST",
    form: {
      code: query.code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.APP_ORIGIN + "/api/oauth/google/callback",
      grant_type: "authorization_code",
      code_verifier: unseal(state.verifier, env),
    },
  });
  if (
    typeof tokens.refresh_token !== "string" ||
    typeof tokens.access_token !== "string"
  )
    fail(
      502,
      "Google did not return offline access. Reconnect and grant review management access.",
    );
  if (
    typeof tokens.scope !== "string" ||
    !tokens.scope.split(" ").includes(scope)
  )
    fail(403, "Google did not grant review management permission.");
  store.put(
    row.tenant,
    "google_credentials",
    {
      sealed: seal(
        {
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiresAt:
            Date.now() + Math.max(0, Number(tokens.expires_in) || 0) * 1000,
        },
        env,
      ),
    },
    "oauth",
  );
  store.put(
    row.tenant,
    "integrations",
    { status: "connected", lastSyncAt: null },
    "google",
  );
  return row.tenant;
}
const refreshing = new Map();
export async function accessToken(store, tenant, env, transport) {
  const connection = required(store.get(tenant, "google_credentials", "oauth"));
  let credentials = unseal(connection.sealed, env);
  if (credentials.expiresAt > Date.now() + 60000)
    return credentials.accessToken;
  // Concurrent requests in this process share a refresh operation. Persist the
  // refresh token only after a verified successful response.
  if (refreshing.has(tenant)) return refreshing.get(tenant);
  const pending = (async () => {
    const response = await transport("https://oauth2.googleapis.com/token", {
      method: "POST",
      form: {
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      },
    });
    if (
      typeof response.access_token !== "string" ||
      !Number.isFinite(Number(response.expires_in)) ||
      Number(response.expires_in) <= 0
    )
      fail(502, "Google token refresh failed. Reconnect this source.");
    credentials = {
      refreshToken:
        typeof response.refresh_token === "string"
          ? response.refresh_token
          : credentials.refreshToken,
      accessToken: response.access_token,
      expiresAt: Date.now() + Number(response.expires_in) * 1000,
    };
    store.put(
      tenant,
      "google_credentials",
      { sealed: seal(credentials, env) },
      "oauth",
    );
    return credentials.accessToken;
  })();
  refreshing.set(tenant, pending);
  try {
    return await pending;
  } finally {
    refreshing.delete(tenant);
  }
}
async function pages(url, keyName, transport, headers) {
  const items = [],
    seen = new Set();
  let next = "",
    total = null;
  for (let i = 0; i < 100; i++) {
    const target = new URL(url);
    if (next) target.searchParams.set("pageToken", next);
    const result = await transport(target.href, { headers });
    if (result[keyName] !== undefined && !Array.isArray(result[keyName]))
      fail(502, "Google returned malformed paginated data.");
    if (keyName === "reviews") {
      if (
        !Number.isInteger(result.totalReviewCount) ||
        result.totalReviewCount < 0 ||
        (total !== null && total !== result.totalReviewCount)
      )
        fail(
          502,
          "Google returned an inconsistent review count. No partial sync was saved.",
        );
      total = result.totalReviewCount;
    }
    items.push(...(result[keyName] || []));
    if (!result.nextPageToken) {
      if (
        total !== null &&
        (items.length !== total ||
          new Set(items.map((r) => r.reviewId)).size !== total)
      )
        fail(
          502,
          "Google review collection was incomplete. No partial sync was saved.",
        );
      return items;
    }
    if (
      typeof result.nextPageToken !== "string" ||
      seen.has(result.nextPageToken)
    )
      fail(502, "Google returned an incomplete pagination sequence.");
    seen.add(result.nextPageToken);
    next = result.nextPageToken;
  }
  fail(502, "Google pagination limit reached; no partial sync was saved.");
}
export async function googleLocations(store, tenant, env, transport) {
  const token = await accessToken(store, tenant, env, transport);
  const headers = { Authorization: `Bearer ${token}` };
  const accounts = await pages(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    "accounts",
    transport,
    headers,
  );
  const locations = [];
  for (const account of accounts) {
    if (!/^accounts\/[0-9]+$/.test(account.name))
      fail(502, "Google returned an invalid account resource.");
    const rows = await pages(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      "locations",
      transport,
      headers,
    );
    for (const row of rows) {
      if (
        !/^locations\/[0-9]+$/.test(row.name) ||
        typeof row.title !== "string"
      )
        fail(502, "Google returned an invalid location resource.");
      locations.push({
        remoteId: `${account.name}/${row.name}`,
        title: row.title,
        address: row.storefrontAddress?.addressLines?.join(", ") || "",
      });
    }
  }
  store.put(tenant, "google_catalog", { locations }, "verified");
  return locations;
}
export function linkGoogleLocation(store, tenant, locationId, remoteId) {
  required(store.get(tenant, "locations", locationId));
  const catalog = required(store.get(tenant, "google_catalog", "verified"));
  const match = catalog.locations.find((l) => l.remoteId === remoteId);
  if (!match)
    fail(
      400,
      "Select a location returned by this workspace’s Google connection.",
    );
  store.put(
    tenant,
    "google_links",
    { locationId, remoteId, title: match.title },
    locationId,
  );
}
export async function fetchGoogleReviews(
  store,
  tenant,
  locationId,
  env,
  transport,
) {
  const link = required(store.get(tenant, "google_links", locationId));
  if (!/^accounts\/[0-9]+\/locations\/[0-9]+$/.test(link.remoteId))
    fail(500, "Invalid Google location binding.");
  const token = await accessToken(store, tenant, env, transport);
  const rows = await pages(
    `https://mybusiness.googleapis.com/v4/${link.remoteId}/reviews?pageSize=50`,
    "reviews",
    transport,
    { Authorization: `Bearer ${token}` },
  );
  return rows.map((row) => {
    if (
      typeof row.reviewId !== "string" ||
      !row.reviewId ||
      !ratings[row.starRating]
    )
      fail(502, "Google returned an invalid review.");
    const expected = `${link.remoteId}/reviews/${row.reviewId}`;
    if (row.name !== expected || !/^[A-Za-z0-9_-]+$/.test(row.reviewId))
      fail(502, "Google returned a review outside the linked location.");
    const item = reviewSchema.parse({
      externalId: row.reviewId,
      author: row.reviewer?.displayName || "Google customer",
      rating: ratings[row.starRating],
      text: row.comment || "",
      publishedAt: row.createTime || row.updateTime,
      sourceUpdatedAt: [
        row.updateTime,
        row.reviewReply?.updateTime,
        row.createTime,
      ]
        .filter(Boolean)
        .sort()
        .at(-1),
      recommended: true,
      contactAllowed: false,
      publishConsent: false,
      reply: row.reviewReply?.comment || "",
    });
    return { ...item, remoteName: expected };
  });
}
export async function replyToGoogle(
  store,
  tenant,
  review,
  text,
  env,
  transport,
) {
  const link = required(store.get(tenant, "google_links", review.locationId));
  const expected = `${link.remoteId}/reviews/${review.externalId}`;
  if (
    review.remoteName !== expected ||
    !/^[A-Za-z0-9_-]+$/.test(review.externalId)
  )
    fail(409, "Reconnect and sync this Google review before responding.");
  const token = await accessToken(store, tenant, env, transport);
  const result = await transport(
    `https://mybusiness.googleapis.com/v4/${expected}/reply`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: { comment: text },
    },
  );
  if (result.comment !== text || typeof result.updateTime !== "string")
    fail(502, "Google did not confirm your response.");
  return { published: true };
}
